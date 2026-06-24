import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useData } from '@/context/DataContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Phone, Mail, MapPin, Calendar, Wrench, FileText } from 'lucide-react';
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

export const CustomerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { getCustomerById, getRepairsByCustomer, getInvoicesByCustomer } = useData();

  const customer = getCustomerById(id || '');
  const repairs = customer ? getRepairsByCustomer(customer.id) : [];
  const invoices = customer ? getInvoicesByCustomer(customer.id) : [];
  const totalSpent = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0);

  if (!customer) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">{t('common.noData')}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/customers">{t('common.back')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" asChild><Link to="/customers"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div>
          <h1 className="text-2xl font-bold">{customer.firstName} {customer.lastName}</h1>
          <p className="text-sm text-muted-foreground">{t('customers.customerDetails')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">{t('customers.customerInfo')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{customer.phone}</span></div>
            {customer.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{customer.email}</span></div>}
            {customer.address && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{customer.address}{customer.city ? `, ${customer.city}` : ''}</span></div>}
            <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{t('customers.lastVisit')}: {new Date(customer.createdAt).toLocaleDateString()}</span></div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-2 bg-muted rounded-lg"><p className="text-lg font-bold">{repairs.length}</p><p className="text-xs text-muted-foreground">{t('customers.totalRepairs')}</p></div>
              <div className="text-center p-2 bg-muted rounded-lg"><p className="text-lg font-bold">{totalSpent.toLocaleString()} DZD</p><p className="text-xs text-muted-foreground">{t('customers.totalSpent')}</p></div>
            </div>
            {customer.notes && <p className="text-xs text-muted-foreground bg-muted rounded-lg p-2">{customer.notes}</p>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Wrench className="h-4 w-4" />{t('customers.repairHistory')}</CardTitle>
            <Button size="sm" variant="outline" asChild><Link to={`/repairs?action=new`}>{t('repairs.newRepair')}</Link></Button>
          </CardHeader>
          <CardContent>
            {repairs.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">{t('common.noData')}</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[70px]">#</TableHead>
                    <TableHead>{t('repairs.device')}</TableHead>
                    <TableHead>{t('repairs.issue')}</TableHead>
                    <TableHead>{t('repairs.status')}</TableHead>
                    <TableHead>{t('repairs.finalCost')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repairs.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">#{r.id.slice(-4)}</TableCell>
                      <TableCell className="text-sm">{r.brand} {r.model}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{r.issue}</TableCell>
                      <TableCell><Badge variant="outline" className={cn('text-[10px]', getStatusClass(r.status))}>{t(`status.${r.status}`)}</Badge></TableCell>
                      <TableCell className="text-sm tabular-nums">{r.finalCost.toLocaleString()} DZD</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" />{t('invoices.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('invoices.invoiceNumber')}</TableHead>
                  <TableHead>{t('invoices.total')}</TableHead>
                  <TableHead>{t('invoices.status')}</TableHead>
                  <TableHead>{t('invoices.issuedDate')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                    <TableCell className="text-sm tabular-nums font-medium">{inv.total.toLocaleString()} DZD</TableCell>
                    <TableCell><Badge variant="outline" className={cn('text-[10px]', inv.status === 'paid' ? 'inv-paid' : inv.status === 'overdue' ? 'inv-overdue' : inv.status === 'sent' ? 'inv-sent' : 'inv-draft')}>{t(`invoiceStatus.${inv.status}`)}</Badge></TableCell>
                    <TableCell className="text-sm">{new Date(inv.issuedAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
};
