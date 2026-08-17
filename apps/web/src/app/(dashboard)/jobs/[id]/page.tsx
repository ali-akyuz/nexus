'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { RealtimeJobCard } from '@/components/jobs/RealtimeJobCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function JobDetailPage({ params }: { params: { id: string } }) {
  const { data: job, isLoading, isError } = useQuery({
    queryKey: ['job', params.id],
    queryFn: async () => {
      const res = await api.get(`/jobs/${params.id}`);
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !job) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
        <div className="text-destructive font-medium">Failed to load job details.</div>
        <Link href="/jobs">
          <Button variant="outline">Back to Jobs</Button>
        </Link>
      </div>
    );
  }

  const renderResult = () => {
    if (!job.result) return null;

    if (job.type === 'DATA_ANALYSIS') {
      const metrics = job.result?.metrics;
      if (!metrics) return <pre className="p-4 rounded-lg bg-muted border font-mono text-xs overflow-auto">{JSON.stringify(job.result, null, 2)}</pre>;
      
      return (
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-muted border text-center">
            <div className="text-2xl font-bold">{metrics.row_count}</div>
            <div className="text-xs text-muted-foreground uppercase mt-1">Rows</div>
          </div>
          <div className="p-4 rounded-lg bg-muted border text-center">
            <div className="text-2xl font-bold">{metrics.column_count}</div>
            <div className="text-xs text-muted-foreground uppercase mt-1">Columns</div>
          </div>
          <div className="p-4 rounded-lg bg-muted border text-center">
            <div className="text-2xl font-bold">{metrics.missing_values}</div>
            <div className="text-xs text-muted-foreground uppercase mt-1">Missing Values</div>
          </div>
          {metrics.numeric_statistics && (
            <div className="col-span-3 mt-4">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Numeric Statistics</h4>
              <pre className="p-4 rounded-lg bg-muted border font-mono text-xs overflow-auto">
                {JSON.stringify(metrics.numeric_statistics, null, 2)}
              </pre>
            </div>
          )}
        </div>
      );
    }

    if (job.type === 'CUSTOMER_SEGMENTATION') {
      const sizes = job.result?.cluster_sizes;
      if (!sizes) return <pre className="p-4 rounded-lg bg-muted border font-mono text-xs overflow-auto">{JSON.stringify(job.result, null, 2)}</pre>;

      return (
        <div className="space-y-4">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Cluster Distribution</h4>
          <div className="grid gap-2">
            {Object.entries(sizes).map(([clusterId, count]: [string, any]) => (
              <div key={clusterId} className="flex justify-between items-center p-3 rounded-lg bg-muted border">
                <span className="font-medium">Cluster {clusterId}</span>
                <Badge variant="secondary">{count} customers</Badge>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Fallback for Credit Risk or Unknown types
    return (
      <pre className="p-4 rounded-lg bg-muted border border-green-500/20 font-mono text-xs overflow-auto">
        {JSON.stringify(job.result, null, 2)}
      </pre>
    );
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div>
        <Link href="/jobs" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Jobs
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Job Details</h1>
      </div>

      <RealtimeJobCard 
        jobId={job.id} 
        initialStatus={job.status} 
        initialProgress={job.progress} 
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <Badge variant="secondary">{job.type}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Priority</span>
              <span className="font-medium">{job.priority}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Worker Node</span>
              <span className="font-mono">{job.workerId || 'Unassigned'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Timestamps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{new Date(job.createdAt).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Started</span>
              <span>{job.startedAt ? new Date(job.startedAt).toLocaleString() : 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Completed</span>
              <span>{job.completedAt ? new Date(job.completedAt).toLocaleString() : 'N/A'}</span>
            </div>
            {job.startedAt && (
              <div className="flex justify-between font-medium mt-2 pt-2 border-t">
                <span className="text-muted-foreground">Queue Wait</span>
                <span>{((new Date(job.startedAt).getTime() - new Date(job.createdAt).getTime()) / 1000).toFixed(1)}s</span>
              </div>
            )}
            {job.startedAt && job.completedAt && (
              <div className="flex justify-between font-medium text-primary">
                <span className="text-muted-foreground">Processing Time</span>
                <span>{((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000).toFixed(1)}s</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Processing Result</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {job.result && (
              <div>
                {renderResult()}
              </div>
            )}
            {job.error && (
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Error</h4>
                <div className="p-4 rounded-lg bg-destructive/10 text-destructive font-mono text-xs overflow-auto">
                  {job.error}
                </div>
              </div>
            )}
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Input Payload</h4>
              <pre className="p-4 rounded-lg bg-muted font-mono text-xs overflow-auto">
                {JSON.stringify(job.payload, null, 2)}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
