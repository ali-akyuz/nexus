'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Search, Filter } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';

interface Job {
  id: string;
  type: string;
  status: string;
  priority: string;
  progress: number;
  createdAt: string;
}

export default function JobsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const buildQuery = () => {
    const params = new URLSearchParams({ page: page.toString(), limit: '10' });
    if (search) params.append('search', search);
    if (statusFilter) params.append('status', statusFilter);
    if (typeFilter) params.append('type', typeFilter);
    return params.toString();
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['jobs', page, search, statusFilter, typeFilter],
    queryFn: async () => {
      const res = await api.get(`/jobs?${buildQuery()}`);
      return res.data;
    },
    staleTime: 5000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const rows = [
        [25, 30000, 50000],
        [42, 70000, 120000],
        [35, 95000, 45000],
        [29, null, 15000],
        [55, 120000, 200000]
      ];
      const res = await api.post('/jobs', {
        type: 'DATA_ANALYSIS',
        priority: 'NORMAL',
        payload: { columns: ['age', 'income', 'loan_amount'], rows }
      });
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] }),
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <Badge variant="default" className="bg-green-500">{status}</Badge>;
      case 'FAILED': return <Badge variant="destructive">{status}</Badge>;
      case 'PROCESSING': return <Badge variant="default" className="bg-blue-500">{status}</Badge>;
      case 'QUEUED': return <Badge variant="secondary">{status}</Badge>;
      case 'CANCELLED': return <Badge variant="outline">{status}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
          <p className="text-muted-foreground">Manage and track your background jobs.</p>
        </div>
        <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
          {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Create Test Job
        </Button>
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by ID or Type..."
                className="pl-8"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <div className="flex gap-2">
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              >
                <option value="">All Statuses</option>
                <option value="QUEUED">Queued</option>
                <option value="PROCESSING">Processing</option>
                <option value="COMPLETED">Completed</option>
                <option value="FAILED">Failed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              >
                <option value="">All Types</option>
                <option value="DATA_ANALYSIS">Data Analysis</option>
                <option value="CUSTOMER_SEGMENTATION">Customer Segmentation</option>
                <option value="CREDIT_RISK">Credit Risk</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : isError ? (
            <div className="text-destructive py-8 text-center">Failed to load jobs.</div>
          ) : data?.data?.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center">No jobs found matching filters.</div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 font-medium">ID</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Priority</th>
                    <th className="px-4 py-3 font-medium hidden sm:table-cell">Created</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.data?.map((job: Job) => (
                    <tr key={job.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{job.id.slice(0, 8)}</td>
                      <td className="px-4 py-3 font-medium">{job.type}</td>
                      <td className="px-4 py-3">{getStatusBadge(job.status)}</td>
                      <td className="px-4 py-3 text-xs">{job.priority}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                        {new Date(job.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/jobs/${job.id}`}>
                          <Button variant="ghost" size="sm">View</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data?.meta && data.meta.totalPages > 0 && (
            <div className="flex items-center justify-between mt-6">
              <span className="text-xs text-muted-foreground font-medium">
                Showing {data.data.length} of {data.meta.total} results
              </span>
              <div className="space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <span className="text-xs px-2 text-muted-foreground">
                  Page {data.meta.page} of {data.meta.totalPages}
                </span>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= data.meta.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
