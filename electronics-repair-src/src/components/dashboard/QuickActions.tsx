import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wrench, Users, FileText } from 'lucide-react';

export const QuickActions: React.FC = () => {
  const { t } = useTranslation();

  const actions = [
    { label: t('dashboard.newRepair'), icon: Wrench, to: '/repairs?action=new', color: 'bg-blue-500 hover:bg-blue-600' },
    { label: t('dashboard.newCustomer'), icon: Users, to: '/customers?action=new', color: 'bg-emerald-500 hover:bg-emerald-600' },
    { label: t('dashboard.newInvoice'), icon: FileText, to: '/invoices?action=new', color: 'bg-violet-500 hover:bg-violet-600' },
  ];

  return (
    <Card className="col-span-1">
      <CardContent className="p-4 space-y-2">
        <p className="text-sm font-medium mb-3">{t('dashboard.quickActions')}</p>
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.label}
              asChild
              className={`w-full justify-start gap-2 ${action.color} text-white`}
              size="sm"
            >
              <Link to={action.to}>
                <Icon className="h-4 w-4" />
                {action.label}
              </Link>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
};
