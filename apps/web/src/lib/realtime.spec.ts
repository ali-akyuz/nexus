import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RealtimeClient } from './realtime';

vi.mock('socket.io-client', () => {
  return {
    io: vi.fn(() => ({
      on: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
      connected: true,
    })),
  };
});

import { io } from 'socket.io-client';

describe('RealtimeClient', () => {
  let client: RealtimeClient;

  beforeEach(() => {
    client = new RealtimeClient('http://localhost:3001');
    vi.clearAllMocks();
  });

  it('should connect with provided token', () => {
    client.connect('test-token');
    expect(io).toHaveBeenCalledWith('http://localhost:3001', expect.objectContaining({
      auth: { token: 'test-token' },
    }));
  });

  it('should subscribe to job if connected', () => {
    client.connect('test-token');
    
    const mockSocket = vi.mocked(io).mock.results[0].value;
    
    client.subscribeToJob('job-123');
    
    expect(mockSocket.emit).toHaveBeenCalledWith('subscribeToJob', { jobId: 'job-123' });
  });

  it('should register event handlers correctly', () => {
    client.connect('test-token');
    const mockSocket = vi.mocked(io).mock.results[0].value;

    const cb = vi.fn();
    client.onSnapshot(cb);
    
    expect(mockSocket.on).toHaveBeenCalledWith('job.snapshot', cb);
  });
});
