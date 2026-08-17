import { Test, TestingModule } from '@nestjs/testing';
import { JobsSweeper } from './jobs.sweeper';
import { PrismaService } from '../prisma/prisma.service';
import { getQueueToken } from '@nestjs/bullmq';
import { JobStatus, JobPriority } from '@prisma/client';

describe('JobsSweeper', () => {
  let sweeper: JobsSweeper;
  let prisma: PrismaService;
  let mockQueue: any;

  beforeEach(async () => {
    mockQueue = {
      getJob: jest.fn(),
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsSweeper,
        {
          provide: PrismaService,
          useValue: {
            job: {
              findMany: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: getQueueToken('default'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    sweeper = module.get<JobsSweeper>(JobsSweeper);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should recover ghost jobs missing from the queue', async () => {
    // Mock a ghost job (QUEUED, > 5 mins old)
    const ghostJob = {
      id: 'ghost-123',
      userId: 'user-123',
      type: 'DATA_ANALYSIS',
      payload: {},
      priority: JobPriority.NORMAL,
      maxAttempts: 3,
    };
    
    (prisma.job.findMany as jest.Mock).mockResolvedValue([ghostJob]);
    mockQueue.getJob.mockResolvedValue(null); // Not in queue!

    await sweeper.sweepGhostJobs();

    // Verify it was re-enqueued
    expect(mockQueue.add).toHaveBeenCalledWith(
      'process-job',
      expect.objectContaining({
        type: 'DATA_ANALYSIS',
      }),
      expect.objectContaining({
        jobId: 'ghost-123',
      }),
    );
    
    // Verify DB updated
    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: 'ghost-123' },
      data: { updatedAt: expect.any(Date) },
    });
  });

  it('should ignore QUEUED jobs that are actually active in the queue', async () => {
    const ghostJob = { id: 'ghost-456' };
    
    (prisma.job.findMany as jest.Mock).mockResolvedValue([ghostJob]);
    mockQueue.getJob.mockResolvedValue({ id: 'ghost-456' }); // Found in queue!

    await sweeper.sweepGhostJobs();

    // Verify it was NOT re-enqueued
    expect(mockQueue.add).not.toHaveBeenCalled();
    
    // Verify DB was just touched to prevent sweeping repeatedly
    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: 'ghost-456' },
      data: { updatedAt: expect.any(Date) },
    });
  });
});
