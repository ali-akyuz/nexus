import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { type UsersService } from '../users/users.service';
import { type JwtService } from '@nestjs/jwt';
import { type ConfigService } from '@nestjs/config';
import { type PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { type RegisterDto } from './dto/register.dto';
import { type LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await argon2.hash(dto.password);
    
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });

    return this.generateAuthResponse(user.id, user.email, user.role);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    
    // Fail securely without leaking account existence explicitly (though we throw Unauthorized either way)
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.generateAuthResponse(user.id, user.email, user.role);
  }

  async logout(userId: string, refreshTokenStr?: string) {
    if (refreshTokenStr) {
      const tokenHash = crypto.createHash('sha256').update(refreshTokenStr).digest('hex');
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { success: true };
  }

  async refreshTokens(refreshTokenStr: string) {
    const tokenHash = crypto.createHash('sha256').update(refreshTokenStr).digest('hex');
    
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if token was revoked (Possible token reuse / stolen token)
    if (tokenRecord.revokedAt) {
      // Invalidate the entire token family for this user to protect them
      await this.prisma.refreshToken.updateMany({
        where: { userId: tokenRecord.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Token reuse detected. All sessions revoked.');
    }

    if (tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }
    
    if (!tokenRecord.user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Revoke the used token (Token Rotation)
    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revokedAt: new Date() },
    });

    return this.generateAuthResponse(tokenRecord.user.id, tokenRecord.user.email, tokenRecord.user.role);
  }

  private async generateAuthResponse(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };
    
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN'),
    });

    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

    // Default expiration (e.g., 7 days) if parsing fails, otherwise use ms helper
    // Simplified expiration logic: add 7 days
    // Simplified expiration logic: add 7 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: refreshTokenHash,
        userId: userId,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: { id: userId, email, role },
    };
  }
}
