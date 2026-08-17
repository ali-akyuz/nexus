import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';

interface JobTypeDistributionProps {
  data: any[];
  isLoading: boolean;
}

export function JobTypeDistribution({ data, isLoading }: JobTypeDistributionProps) {
  if (isLoading) {
    return (
      <Card className="w-full h-[350px]">
        <CardHeader><CardTitle>Jobs by Type</CardTitle></CardHeader>
        <CardContent className="h-full flex items-center justify-center">
          <div className="animate-pulse bg-muted w-full h-[250px] rounded-md"></div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="w-full h-[350px]">
        <CardHeader><CardTitle>Jobs by Type</CardTitle></CardHeader>
        <CardContent className="h-[250px] flex items-center justify-center text-muted-foreground">
          No data available.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full h-[350px]">
      <CardHeader>
        <CardTitle>Jobs by Type</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground)/0.2)" />
              <XAxis 
                dataKey="type" 
                stroke="#888888" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false}
              />
              <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                cursor={{ fill: 'hsl(var(--muted))' }}
              />
              <Legend />
              <Bar dataKey="COMPLETED" name="Completed" stackId="a" fill="#22c55e" radius={[0, 0, 4, 4]} />
              <Bar dataKey="FAILED" name="Failed" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
              <Bar dataKey="PROCESSING" name="Processing" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
