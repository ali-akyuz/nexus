import { io, Socket } from 'socket.io-client';

export type JobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface JobSnapshot {
  jobId: string;
  status: JobStatus;
  progress: number;
  updatedAt: string;
  result?: any;
  error?: string;
}

export interface JobEventPayload {
  jobId: string;
  status: JobStatus;
  progress?: number;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
  errorCode?: string;
  resultAvailable?: boolean;
}

export interface JobLogPayload {
  jobId: string;
  message: string;
  timestamp: string;
}

export class RealtimeClient {
  private socket: Socket | null = null;
  private readonly url: string;
  private token: string | null = null;

  constructor(url: string = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') {
    this.url = url;
  }

  /**
   * Connect to the WebSocket server using the provided JWT token.
   */
  connect(token: string) {
    this.token = token;
    
    if (this.socket?.connected) {
      this.socket.disconnect();
    }

    this.socket = io(this.url, {
      auth: { token },
      extraHeaders: {
        Authorization: `Bearer ${token}` // Fallback for some clients
      },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('Connected to realtime server', this.socket?.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('Disconnected from realtime server:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
    });
  }

  /**
   * Subscribe to real-time events for a specific job.
   */
  subscribeToJob(jobId: string) {
    if (!this.socket?.connected) {
      console.warn('Socket not connected. Cannot subscribe to job.');
      return;
    }
    this.socket.emit('subscribeToJob', { jobId });
  }

  /**
   * Unsubscribe from job events (optional, managed by standard socket cleanup on disconnect).
   */
  unsubscribeFromJob(jobId: string) {
    if (this.socket?.connected) {
      this.socket.emit('unsubscribeFromJob', { jobId });
    }
  }

  /**
   * Listen for initial job state snapshots.
   */
  onSnapshot(callback: (data: JobSnapshot) => void) {
    this.socket?.on('job.snapshot', callback);
  }

  /**
   * Listen for state change events (started, progress, completed, failed).
   */
  onJobEvent(eventName: 'job.started' | 'job.progress' | 'job.completed' | 'job.failed', callback: (data: JobEventPayload) => void) {
    this.socket?.on(eventName, callback);
  }

  /**
   * Listen for live logs from the worker.
   */
  onJobLog(callback: (data: JobLogPayload) => void) {
    this.socket?.on('job.log', callback);
  }

  /**
   * Disconnect the client entirely.
   */
  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}

// Singleton instance for easy frontend usage
export const realtimeClient = new RealtimeClient();
