import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useData } from '@/context/DataContext';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { RepairsChart } from '@/components/dashboard/RepairsChart';
import { StatusPieChart } from '@/components/dashboard/StatusPieChart';
import { RecentRepairs } from '@/components/dashboard/RecentRepairs';
import { QuickActions } from '@/components/dashboard/QuickActions';

export const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { getDashboardStats, getMonthlyData, getStatusCounts } = useData();

  const stats = getDashboardStats();
  const monthlyData = getMonthlyData();
  const statusCounts = getStatusCounts();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('dashboard.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('dashboard.subtitle')}</p>
      </div>

      <StatsCards stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <RevenueChart data={monthlyData} />
        <QuickActions />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <RepairsChart data={monthlyData} />
        <StatusPieChart data={statusCounts} />
      </div>

      <RecentRepairs />
    </motion.div>
  );
};
