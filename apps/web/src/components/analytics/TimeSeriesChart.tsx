import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format } from 'date-fns';

interface TimeSeriesChartProps {
  data: any[];
  isLoading: boolean;
  range: string;
}

export function TimeSeriesChart({ data, isLoading, range }: TimeSeriesChartProps) {
  if (isLoading) {
    return (
      <Card className="w-full h-[350px]">
        <CardHeader><CardTitle>Job Volume over Time</CardTitle></CardHeader>
        <CardContent className="h-full flex items-center justify-center">
          <div className="animate-pulse bg-muted w-full h-[250px] rounded-md"></div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="w-full h-[350px]">
        <CardHeader><CardTitle>Job Volume over Time</CardTitle></CardHeader>
        <CardContent className="h-[250px] flex items-center justify-center text-muted-foreground">
          No data available for this range.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full h-[350px]">
      <CardHeader>
        <CardTitle>Job Volume over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(val) => {
                  const d = new Date(val);
                  return range === '24h' ? format(d, 'HH:mm') : format(d, 'MMM dd');
                }} 
                stroke="#888888" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false}
              />
              <YAxis 
                stroke="#888888" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false}
              />
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground)/0.2)" />
              <Tooltip 
                contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                labelFormatter={(val) => format(new Date(val), 'PPP p')}
              />
              <Area type="monotone" dataKey="COMPLETED" stroke="#22c55e" fillOpacity={1} fill="url(#colorCompleted)" name="Completed" />
              <Area type="monotone" dataKey="FAILED" stroke="#ef4444" fillOpacity={1} fill="url(#colorFailed)" name="Failed" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
