import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useData } from '@/context/DataContext';
import { RepairForm } from '@/components/repairs/RepairForm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  ArrowLeft, Pencil, Trash2, FileText, Clock, Calendar, User, Phone, Mail, MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Repair } from '@/types';

const getStatusClass = (status: Repair['status']) => {
  const map: Record<string, string> = {
    pending: 'status-pending', diagnosing: 'status-diagnosing', in_progress: 'status-in_progress',
    waiting_parts: 'status-waiting_parts', completed: 'status-completed',
    delivered: 'status-delivered', cancelled: 'status-cancelled',
  };
  return map[status] || 'status-pending';
};

export const RepairDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { getRepairById, getCustomerById, deleteRepair } = useData();
  const [showEdit, setShowEdit] = useState(false);

  const repair = getRepairById(id || '');
  const customer = repair ? getCustomerById(repair.customerId) : null;

  if (!repair) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">{t('common.noData')}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/repairs">{t('common.back')}</Link>
        </Button>
      </div>
    );
  }

  const handleDelete = () => {
    if (confirm(t('common.confirm'))) {
      deleteRepair(repair.id);
      toast.success(t('common.success'));
      navigate('/repairs');
    }
  };

  const handleGenerateInvoice = () => {
    navigate(`/invoices?action=new&repairId=${repair.id}&customerId=${repair.customerId}`);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild>
            <Link to="/repairs"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{t('repairs.repairDetails')} #{repair.id.slice(-6).toUpperCase()}</h1>
              <Badge variant="outline" className={cn(getStatusClass(repair.status))}>
                {t(`status.${repair.status}`)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{new Date(repair.createdAt).toLocaleString()}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowEdit(true)} className="gap-1">
            <Pencil className="h-3.5 w-3.5" /> {t('common.edit')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleGenerateInvoice} className="gap-1">
            <FileText className="h-3.5 w-3.5" /> {t('repairs.generateInvoice')}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete} className="gap-1">
            <Trash2 className="h-3.5 w-3.5" /> {t('common.delete')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-sm">{t('repairs.deviceInfo')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-muted-foreground">{t('repairs.device')}</p><p className="font-medium">{t(`device.${repair.deviceType}`)}</p></div>
              <div><p className="text-xs text-muted-foreground">{t('repairs.brand')}</p><p className="font-medium">{repair.brand}</p></div>
              <div><p className="text-xs text-muted-foreground">{t('repairs.model')}</p><p className="font-medium">{repair.model}</p></div>
              <div><p className="text-xs text-muted-foreground">{t('repairs.serialNumber')}</p><p className="font-medium">{repair.serialNumber || '—'}</p></div>
            </div>
            <Separator />
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t('repairs.issue')}</p>
              <p className="text-sm bg-muted rounded-lg p-3">{repair.issue}</p>
            </div>
            {repair.diagnosis && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t('repairs.diagnosis')}</p>
                <p className="text-sm bg-muted rounded-lg p-3">{repair.diagnosis}</p>
              </div>
            )}
            {repair.solution && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t('repairs.solution')}</p>
                <p className="text-sm bg-muted rounded-lg p-3">{repair.solution}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">{t('repairs.customerInfo')}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {customer ? (
                <>
                  <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" />
                    <Link to={`/customers/${customer.id}`} className="font-medium hover:underline">{customer.firstName} {customer.lastName}</Link>
                  </div>
                  <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{customer.phone}</span></div>
                  {customer.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{customer.email}</span></div>}
                  {customer.address && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{customer.address}, {customer.city}</span></div>}
                </>
              ) : <p className="text-sm text-muted-foreground">{t('common.noData')}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">{t('repairs.repairInfo')}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{t('repairs.priority')}</span>
                <Badge variant="outline" className={cn(repair.priority === 'urgent' ? 'priority-urgent' : repair.priority === 'high' ? 'priority-high' : repair.priority === 'medium' ? 'priority-medium' : 'priority-low')}>
                  {t(`priority.${repair.priority}`)}
                </Badge>
              </div>
              <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{t('repairs.estimatedCost')}</span><span className="font-medium">{repair.estimatedCost.toLocaleString()} DZD</span></div>
              <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{t('repairs.finalCost')}</span><span className="font-medium">{repair.finalCost.toLocaleString()} DZD</span></div>
              <Separator />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" /> {t('repairs.created')}: {new Date(repair.createdAt).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> {t('repairs.updated')}: {new Date(repair.updatedAt).toLocaleDateString()}
              </div>
            </CardContent>
          </Card>

          {repair.notes && (
            <Card>
              <CardHeader><CardTitle className="text-sm">{t('repairs.notes')}</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">{repair.notes}</p></CardContent>
            </Card>
          )}
        </div>
      </div>

      <RepairForm open={showEdit} onClose={() => setShowEdit(false)} editRepair={repair} />
    </motion.div>
  );
};
