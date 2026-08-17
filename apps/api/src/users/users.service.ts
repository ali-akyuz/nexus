import { Injectable, ConflictException } from '@nestjs/common';
import { type PrismaService } from '../prisma/prisma.service';
import { Prisma, type User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.UserCreateInput): Promise<Omit<User, 'passwordHash'>> {
    try {
      const user = await this.prisma.user.create({
        data,
      });
      return this.excludePasswordHash(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Email already exists');
        }
      }
      throw error;
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string): Promise<Omit<User, 'passwordHash'> | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    
    if (!user) {
      return null;
    }

    return this.excludePasswordHash(user);
  }

  private excludePasswordHash(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash: _passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
