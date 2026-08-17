import { Test, type TestingModule } from '@nestjs/testing';
import { JobsService } from './jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { getQueueToken } from '@nestjs/bullmq';
import { JobStatus, JobPriority } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('JobsService', () => {
  let service: JobsService;
  let prismaService: any;
  let defaultQueue: any;

  beforeEach(async () => {
    const mockPrismaService = {
      job: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const mockQueue = {
      add: jest.fn(),
      getJob: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: getQueueToken('default'), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
    prismaService = module.get(PrismaService);
    defaultQueue = module.get(getQueueToken('default'));
  });

  describe('createJob', () => {
    it('should return existing job if idempotency key matches', async () => {
      const mockJob = { id: '1', userId: 'user-1', idempotencyKey: 'key-1' };
      prismaService.job.findUnique.mockResolvedValue(mockJob);

      const result = await service.createJob('user-1', { type: 'DATA', idempotencyKey: 'key-1' });
      expect(result).toEqual(mockJob);
      expect(prismaService.job.create).not.toHaveBeenCalled();
    });

    it('should create a job and enqueue it', async () => {
      prismaService.job.findUnique.mockResolvedValue(null);
      
      const newJob = { id: 'job-2', userId: 'user-1', type: 'DATA', priority: JobPriority.HIGH, maxAttempts: 3 };
      prismaService.job.create.mockResolvedValue(newJob);

      await service.createJob('user-1', { type: 'DATA', priority: JobPriority.HIGH });
      
      expect(prismaService.job.create).toHaveBeenCalled();
      expect(defaultQueue.add).toHaveBeenCalledWith('DATA', expect.any(Object), expect.objectContaining({
        jobId: 'job-2',
        priority: 2,
      }));
    });

    it('should mark job as FAILED if enqueuing throws an error', async () => {
      prismaService.job.findUnique.mockResolvedValue(null);
      const newJob = { id: 'job-3' };
      prismaService.job.create.mockResolvedValue(newJob);
      
      defaultQueue.add.mockRejectedValue(new Error('Redis connection failed'));

      await expect(service.createJob('user-1', { type: 'DATA' })).rejects.toThrow(BadRequestException);
      
      expect(prismaService.job.update).toHaveBeenCalledWith({
        where: { id: 'job-3' },
        data: { status: JobStatus.FAILED, error: expect.any(String) },
      });
    });
  });

  describe('cancelJob', () => {
    it('should remove from queue and update status to CANCELLED', async () => {
      const mockDbJob = { id: 'job-1', userId: 'user-1', status: JobStatus.QUEUED };
      prismaService.job.findUnique.mockResolvedValue(mockDbJob);
      
      const mockBullJob = { remove: jest.fn() };
      defaultQueue.getJob.mockResolvedValue(mockBullJob);

      await service.cancelJob('user-1', 'job-1');

      expect(mockBullJob.remove).toHaveBeenCalled();
      expect(prismaService.job.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: { status: JobStatus.CANCELLED },
      });
    });

    it('should throw BadRequestException if job is not QUEUED', async () => {
      const mockDbJob = { id: 'job-1', userId: 'user-1', status: JobStatus.PROCESSING };
      prismaService.job.findUnique.mockResolvedValue(mockDbJob);

      await expect(service.cancelJob('user-1', 'job-1')).rejects.toThrow(BadRequestException);
    });
  });
});
