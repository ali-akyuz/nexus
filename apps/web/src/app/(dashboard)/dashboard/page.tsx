'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { realtimeClient } from '@/lib/realtime';
import { OverviewCards } from '@/components/analytics/OverviewCards';
import { TimeSeriesChart } from '@/components/analytics/TimeSeriesChart';
import { JobTypeDistribution } from '@/components/analytics/JobTypeDistribution';
import { DateRangePicker, DateRange } from '@/components/analytics/DateRangePicker';

export default function DashboardPage() {
  const [range, setRange] = useState<DateRange>('7d');
  const queryClient = useQueryClient();

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: async () => (await api.get('/analytics/overview')).data,
    staleTime: 60000,
  });

  const { data: timeSeries, isLoading: timeSeriesLoading } = useQuery({
    queryKey: ['analytics', 'jobs', range],
    queryFn: async () => (await api.get(`/analytics/jobs?range=${range}`)).data,
    staleTime: 60000,
  });

  const { data: types, isLoading: typesLoading } = useQuery({
    queryKey: ['analytics', 'types'],
    queryFn: async () => (await api.get('/analytics/types')).data,
    staleTime: 60000,
  });

  // Realtime integration to invalidate caches incrementally without polling
  useEffect(() => {
    const handleEvent = () => {
      // Debounce or directly invalidate the overview to catch new counts
      queryClient.invalidateQueries({ queryKey: ['analytics', 'overview'] });
    };

    realtimeClient.onJobEvent('job.created', handleEvent);
    realtimeClient.onJobEvent('job.completed', handleEvent);
    realtimeClient.onJobEvent('job.failed', handleEvent);

    return () => {
      realtimeClient.offJobEvent('job.created', handleEvent);
      realtimeClient.offJobEvent('job.completed', handleEvent);
      realtimeClient.offJobEvent('job.failed', handleEvent);
    };
  }, [queryClient]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Operations overview and real-time analytics.</p>
        </div>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      <OverviewCards data={overview} isLoading={overviewLoading} />

      <div className="grid gap-4 md:grid-cols-2">
        <TimeSeriesChart data={timeSeries} isLoading={timeSeriesLoading} range={range} />
        <JobTypeDistribution data={types} isLoading={typesLoading} />
      </div>
    </div>
  );
}
