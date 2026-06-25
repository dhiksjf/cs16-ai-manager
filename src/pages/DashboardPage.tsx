import { useData } from '@/context/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Wrench,
  Clock,
  CheckCircle2,
  DollarSign,
  Users,
  TrendingUp,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

export function DashboardPage() {
  const { getDashboardStats, getMonthlyData, getStatusCounts, repairs, getCustomerById } = useData();
  const stats = getDashboardStats();
  const monthlyData = getMonthlyData();
  const statusCounts = getStatusCounts();
  const recentRepairs = repairs.slice(0, 6);

  const statCards = [
    { title: 'Total Repairs', value: stats.totalRepairs, icon: Wrench, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'Pending', value: stats.pendingRepairs, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { title: 'Completed', value: stats.completedRepairs, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Total Revenue', value: `$${stats.totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-violet-500', bg: 'bg-violet-500/10' },
    { title: 'This Month', value: `$${stats.monthlyRevenue.toLocaleString()}`, icon: TrendingUp, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { title: 'Customers', value: stats.totalCustomers, icon: Users, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
  ];

  const statusColors: Record<string, string> = {
    pending: '#f59e0b',
    diagnosing: '#3b82f6',
    in_progress: '#8b5cf6',
    waiting_parts: '#f97316',
    completed: '#10b981',
    delivered: '#06b6d4',
    cancelled: '#ef4444',
  };

  const statusLabels: Record<string, string> = {
    pending: 'Pending',
    diagnosing: 'Diagnosing',
    in_progress: 'In Progress',
    waiting_parts: 'Waiting Parts',
    completed: 'Completed',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                </div>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{card.title}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={2} fill="url(#revenueGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Repairs Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                />
                <Bar dataKey="repairs" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Total" />
                <Bar dataKey="completed" fill="#10b981" radius={[4, 4, 0, 0]} name="Completed" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={statusCounts.filter(s => s.count > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={2}
                  dataKey="count"
                >
                  {statusCounts.filter(s => s.count > 0).map((entry) => (
                    <Cell key={entry.status} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                  formatter={(value: number, _name: string, props: any) => [value, props?.payload?.label || '']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {statusCounts.filter(s => s.count > 0).map((s) => (
                <div key={s.status} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-muted-foreground">{s.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Recent Repairs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentRepairs.map((repair) => {
                const customer = getCustomerById(repair.customerId);
                return (
                  <Link
                    key={repair.id}
                    to={`/repairs/${repair.id}`}
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-accent transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Wrench className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {repair.brand} {repair.model}
                        </span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 shrink-0" style={{ borderColor: statusColors[repair.status], color: statusColors[repair.status] }}>
                          {statusLabels[repair.status]}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown'} &middot; {repair.issue.substring(0, 60)}...
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                      {formatDistanceToNow(new Date(repair.createdAt), { addSuffix: true })}
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
