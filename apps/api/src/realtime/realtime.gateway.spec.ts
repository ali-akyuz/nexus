import { Test, TestingModule } from '@nestjs/testing';
import { RealtimeGateway } from './realtime.gateway';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JobsService } from '../jobs/jobs.service';
import { Socket } from 'socket.io';

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;
  let jwtService: any;
  let jobsService: any;
  let mockClient: any;

  beforeEach(async () => {
    const mockJwtService = {
      verify: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue('secret'),
    };

    const mockJobsService = {
      findUserJobById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealtimeGateway,
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: JobsService, useValue: mockJobsService },
      ],
    }).compile();

    gateway = module.get<RealtimeGateway>(RealtimeGateway);
    jwtService = module.get(JwtService);
    jobsService = module.get(JobsService);

    mockClient = {
      id: 'socket-1',
      data: {},
      handshake: {
        auth: { token: 'valid-token' },
        headers: {},
      },
      join: jest.fn(),
      disconnect: jest.fn(),
      emit: jest.fn(),
    };
  });

  describe('handleConnection', () => {
    it('should connect and join user room if token is valid', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1' });

      await gateway.handleConnection(mockClient as unknown as Socket);

      expect(jwtService.verify).toHaveBeenCalledWith('valid-token', { secret: 'secret' });
      expect(mockClient.data.user).toEqual({ sub: 'user-1' });
      expect(mockClient.join).toHaveBeenCalledWith('user:user-1');
      expect(mockClient.disconnect).not.toHaveBeenCalled();
    });

    it('should disconnect if token is invalid', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await gateway.handleConnection(mockClient as unknown as Socket);

      expect(mockClient.disconnect).toHaveBeenCalledWith(true);
      expect(mockClient.join).not.toHaveBeenCalled();
    });
  });

  describe('handleSubscribeToJob', () => {
    beforeEach(() => {
      mockClient.data.user = { sub: 'user-1' };
    });

    it('should subscribe to job and emit snapshot if user owns job', async () => {
      jobsService.findUserJobById.mockResolvedValue({
        id: 'job-1',
        status: 'QUEUED',
        progress: 0,
        updatedAt: new Date(),
      });

      const response = await gateway.handleSubscribeToJob(mockClient as unknown as Socket, { jobId: 'job-1' });

      expect(jobsService.findUserJobById).toHaveBeenCalledWith('user-1', 'job-1');
      expect(mockClient.join).toHaveBeenCalledWith('job:job-1');
      expect(mockClient.emit).toHaveBeenCalledWith('job.snapshot', expect.any(Object));
      expect(response).toEqual({ event: 'subscribed', data: { jobId: 'job-1' } });
    });

    it('should return error if user does not own the job', async () => {
      jobsService.findUserJobById.mockRejectedValue(new Error('Job not found'));

      const response = await gateway.handleSubscribeToJob(mockClient as unknown as Socket, { jobId: 'job-1' });

      expect(mockClient.join).not.toHaveBeenCalled();
      expect(response).toEqual({ event: 'error', data: 'Job not found' });
    });
  });
});
