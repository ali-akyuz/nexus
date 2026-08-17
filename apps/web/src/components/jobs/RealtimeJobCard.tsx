'use client';

import { useJobRealtime } from '@/hooks/useJobRealtime';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface RealtimeJobCardProps {
  jobId: string;
  initialStatus: string;
  initialProgress: number;
}

export function RealtimeJobCard({ jobId, initialStatus, initialProgress }: RealtimeJobCardProps) {
  const { status, progress, logs } = useJobRealtime(jobId);

  const currentStatus = status || initialStatus;
  const currentProgress = status ? progress : initialProgress;
  const latestLog = logs.length > 0 ? logs[logs.length - 1].message : 'Waiting for worker...';

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'COMPLETED': return <Badge variant="default" className="bg-green-500">{s}</Badge>;
      case 'FAILED': return <Badge variant="destructive">{s}</Badge>;
      case 'PROCESSING': return <Badge variant="default" className="bg-blue-500">{s}</Badge>;
      case 'QUEUED': return <Badge variant="secondary">{s}</Badge>;
      case 'CANCELLED': return <Badge variant="outline">{s}</Badge>;
      default: return <Badge variant="outline">{s}</Badge>;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Job Execution</CardTitle>
          <CardDescription className="font-mono text-xs mt-1">ID: {jobId}</CardDescription>
        </div>
        {getStatusBadge(currentStatus)}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm font-medium">
            <span>Progress</span>
            <span>{currentProgress}%</span>
          </div>
          <div className="w-full bg-secondary h-3 rounded-full overflow-hidden">
            <div 
              className="bg-primary h-full transition-all duration-500 ease-out" 
              style={{ width: `${currentProgress}%` }} 
            />
          </div>
        </div>
        
        <div className="rounded-md bg-muted p-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {currentStatus === 'PROCESSING' && <Loader2 className="h-4 w-4 animate-spin" />}
            <span className="font-mono text-xs">{latestLog}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
