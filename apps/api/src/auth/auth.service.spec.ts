import { Test, type TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import * as argon2 from 'argon2';

jest.mock('argon2');
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomBytes: jest.fn().mockReturnValue(Buffer.from('mocked-token')),
  createHash: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('hashed-mocked-token'),
  }),
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let _jwtService: jest.Mocked<JwtService>;
  let _configService: jest.Mocked<ConfigService>;
  let prismaService: any; // mocked

  beforeEach(async () => {
    const mockUsersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue('mock-secret'),
    };

    const mockPrismaService = {
      user: {
        update: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    _jwtService = module.get(JwtService);
    _configService = module.get(ConfigService);
    prismaService = module.get(PrismaService);
  });

  describe('register', () => {
    it('should throw ConflictException if user exists', async () => {
      usersService.findByEmail.mockResolvedValue({ id: '1', email: 'test@test.com' } as any);
      
      await expect(service.register({ email: 'test@test.com', password: 'pass' })).rejects.toThrow(ConflictException);
    });

    it('should register a new user successfully', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      (argon2.hash as jest.Mock).mockResolvedValue('hashed-pass');
      usersService.create.mockResolvedValue({ id: '1', email: 'test@test.com', role: 'USER' } as any);
      
      const result = await service.register({ email: 'test@test.com', password: 'pass' });
      
      expect(usersService.create).toHaveBeenCalledWith({
        email: 'test@test.com',
        passwordHash: 'hashed-pass',
        firstName: undefined,
        lastName: undefined,
      });
      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.refreshToken).toBeDefined();
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException on invalid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      await expect(service.login({ email: 'test@test.com', password: 'pass' })).rejects.toThrow(UnauthorizedException);
    });

    it('should login successfully', async () => {
      usersService.findByEmail.mockResolvedValue({ id: '1', email: 'test@test.com', passwordHash: 'hash', role: 'USER', isActive: true } as any);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      
      const result = await service.login({ email: 'test@test.com', password: 'pass' });
      
      expect(result.accessToken).toBe('mock-jwt-token');
      expect(prismaService.user.update).toHaveBeenCalled();
    });
  });
});
