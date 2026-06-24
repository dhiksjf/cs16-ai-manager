import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Wrench,
  Clock,
  CheckCircle2,
  Banknote,
  TrendingUp,
  Users,
  UserPlus,
  Timer,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { DashboardStats } from '@/types';

interface Props {
  stats: DashboardStats;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
};

export const StatsCards: React.FC<Props> = ({ stats }) => {
  const { t } = useTranslation();

  const cards = [
    {
      label: t('dashboard.totalRepairs'),
      value: stats.totalRepairs,
      icon: Wrench,
      color: 'text-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-950/30',
    },
    {
      label: t('dashboard.pendingRepairs'),
      value: stats.pendingRepairs,
      icon: Clock,
      color: 'text-amber-500',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
    },
    {
      label: t('dashboard.completedRepairs'),
      value: stats.completedRepairs,
      icon: CheckCircle2,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    },
    {
      label: t('dashboard.monthlyRevenue'),
      value: `${stats.monthlyRevenue.toLocaleString()} DZD`,
      icon: Banknote,
      color: 'text-violet-500',
      bg: 'bg-violet-50 dark:bg-violet-950/30',
    },
    {
      label: t('dashboard.totalRevenue'),
      value: `${stats.totalRevenue.toLocaleString()} DZD`,
      icon: TrendingUp,
      color: 'text-rose-500',
      bg: 'bg-rose-50 dark:bg-rose-950/30',
    },
    {
      label: t('dashboard.totalCustomers'),
      value: stats.totalCustomers,
      icon: Users,
      color: 'text-cyan-500',
      bg: 'bg-cyan-50 dark:bg-cyan-950/30',
    },
    {
      label: t('dashboard.newCustomers'),
      value: stats.newCustomersThisMonth,
      icon: UserPlus,
      color: 'text-teal-500',
      bg: 'bg-teal-50 dark:bg-teal-950/30',
    },
    {
      label: t('dashboard.avgRepairTime'),
      value: `${stats.avgRepairTime} ${t('dashboard.days')}`,
      icon: Timer,
      color: 'text-orange-500',
      bg: 'bg-orange-50 dark:bg-orange-950/30',
    },
  ];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
    >
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <motion.div key={card.label} variants={item}>
            <Card className="p-4 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
                  <p className="text-2xl font-bold tracking-tight">{card.value}</p>
                </div>
                <div className={`h-10 w-10 rounded-lg ${card.bg} flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 ${card.color}`} />
                </div>
              </div>
            </Card>
          </motion.div>
        );
      })}
    </motion.div>
  );
};
