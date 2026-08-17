import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { JobsService } from '../jobs/jobs.service';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS === '*' ? '*' : (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly jobsService: JobsService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = this.extractTokenFromSocket(client);
      if (!token) {
        throw new Error('No authentication token provided');
      }

      const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
      const payload = this.jwtService.verify(token, { secret });

      // Attach user to socket
      client.data.user = payload;

      // Join user-specific room
      const userRoom = `user:${payload.sub}`;
      client.join(userRoom);

      this.logger.log(`Client connected: ${client.id} (User: ${payload.sub})`);
    } catch (error) {
      this.logger.warn(`Authentication failed for client ${client.id}: ${error.message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribeToJob')
  async handleSubscribeToJob(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { jobId: string },
  ) {
    try {
      const user = client.data.user;
      if (!user) {
        return { event: 'error', data: 'Unauthorized' };
      }

      const jobId = data?.jobId;
      if (!jobId) {
        return { event: 'error', data: 'jobId is required' };
      }

      // Verify the user owns the job or is an admin
      const job = await this.jobsService.findUserJobById(user.sub, jobId);
      
      const jobRoom = `job:${jobId}`;
      client.join(jobRoom);
      
      this.logger.log(`Client ${client.id} subscribed to job ${jobId}`);

      // Emit a snapshot to the client who just joined so they can recover state
      client.emit('job.snapshot', {
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        updatedAt: job.updatedAt,
        result: job.result,
        error: job.error,
      });

      return { event: 'subscribed', data: { jobId } };
    } catch (error) {
      this.logger.warn(`Failed to subscribe client ${client.id} to job ${data?.jobId}: ${error.message}`);
      return { event: 'error', data: error.message };
    }
  }

  /**
   * Helper method for the QueueEvents listener to broadcast to a specific job room.
   */
  broadcastToJob(jobId: string, event: string, payload: any) {
    this.server.to(`job:${jobId}`).emit(event, payload);
  }

  /**
   * Helper method to broadcast to admins (could be used for worker events).
   */
  broadcastToAdmins(event: string, payload: any) {
    this.server.to('role:ADMIN').emit(event, payload); // Setup requires adding admins to this room
  }

  private extractTokenFromSocket(client: Socket): string | null {
    // 1. Check handshake.auth
    if (client.handshake.auth && client.handshake.auth.token) {
      return client.handshake.auth.token;
    }
    // 2. Check headers (extraHeaders in client)
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.split(' ')[1];
    }
    return null;
  }
}
