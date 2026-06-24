import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { cn } from '@/lib/utils';
import type { Repair } from '@/types';

const getStatusClass = (status: Repair['status']) => {
  const map: Record<string, string> = {
    pending: 'status-pending',
    diagnosing: 'status-diagnosing',
    in_progress: 'status-in_progress',
    waiting_parts: 'status-waiting_parts',
    completed: 'status-completed',
    delivered: 'status-delivered',
    cancelled: 'status-cancelled',
  };
  return map[status] || 'status-pending';
};

export const RecentRepairs: React.FC = () => {
  const { t } = useTranslation();
  const { repairs, getCustomerById } = useData();

  const recent = [...repairs]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  return (
    <Card className="col-span-1 lg:col-span-3">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">{t('dashboard.recentRepairs')}</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/repairs" className="gap-1 text-xs">
            {t('dashboard.viewAll')} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {recent.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">{t('common.noData')}</p>
          )}
          {recent.map((repair, i) => {
            const customer = getCustomerById(repair.customerId);
            return (
              <motion.div
                key={repair.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  to={`/repairs/${repair.id}`}
                  className="flex items-center justify-between rounded-lg p-2.5 hover:bg-accent transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">#{repair.id.slice(-4)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {repair.brand} {repair.model} — {repair.issue.slice(0, 40)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-medium tabular-nums">{repair.estimatedCost.toLocaleString()} DZD</span>
                    <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0.5', getStatusClass(repair.status))}>
                      {t(`status.${repair.status}`)}
                    </Badge>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
