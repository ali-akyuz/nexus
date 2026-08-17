import { useState, useEffect } from 'react';
import { realtimeClient, JobSnapshot, JobEventPayload, JobLogPayload, JobStatus } from '@/lib/realtime';
import { useAuth } from '@/components/auth/AuthProvider';

export function useJobRealtime(jobId: string) {
  const { accessToken } = useAuth();
  
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [logs, setLogs] = useState<JobLogPayload[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  
  useEffect(() => {
    if (!accessToken || !jobId) return;

    // Connect global socket using token
    realtimeClient.connect(accessToken);
    
    // Subscribe to specific job
    realtimeClient.subscribeToJob(jobId);

    const handleSnapshot = (data: JobSnapshot) => {
      if (data.jobId === jobId) {
        setStatus(data.status);
        setProgress(data.progress);
        setUpdatedAt(data.updatedAt);
      }
    };

    const handleEvent = (data: JobEventPayload) => {
      if (data.jobId === jobId) {
        setStatus(data.status);
        if (data.progress !== undefined) setProgress(data.progress);
        setUpdatedAt(data.updatedAt);
      }
    };

    const handleLog = (data: JobLogPayload) => {
      if (data.jobId === jobId) {
        setLogs(prev => [...prev, data]);
      }
    };

    realtimeClient.onSnapshot(handleSnapshot);
    realtimeClient.onJobEvent('job.started', handleEvent);
    realtimeClient.onJobEvent('job.progress', handleEvent);
    realtimeClient.onJobEvent('job.completed', handleEvent);
    realtimeClient.onJobEvent('job.failed', handleEvent);
    realtimeClient.onJobLog(handleLog);

    return () => {
      // Cleanup: realistically we might want to keep the connection alive if we're on a dashboard,
      // but we should unsubscribe from the specific job room.
      realtimeClient.unsubscribeFromJob(jobId);
    };
  }, [jobId, accessToken]);

  return {
    status,
    progress,
    logs,
    updatedAt,
  };
}
