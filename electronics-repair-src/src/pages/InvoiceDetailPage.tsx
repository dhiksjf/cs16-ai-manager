import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useData } from '@/context/DataContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { ArrowLeft, FileText, Printer, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export const InvoiceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { getInvoiceById, getCustomerById, getRepairById, updateInvoice } = useData();
  const invoice = getInvoiceById(id || '');
  const customer = invoice ? getCustomerById(invoice.customerId) : null;
  const repair = invoice?.repairId ? getRepairById(invoice.repairId) : null;

  if (!invoice) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">{t('common.noData')}</p>
        <Button asChild variant="outline" className="mt-4"><Link to="/invoices">{t('common.back')}</Link></Button>
      </div>
    );
  }

  const handleMarkPaid = () => {
    updateInvoice(invoice.id, { status: 'paid', amountPaid: invoice.total, paidAt: new Date().toISOString() });
    toast.success(t('common.success'));
  };

  const handlePrint = () => {
    window.print();
  };

  const balance = invoice.total - invoice.amountPaid;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild><Link to="/invoices"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{invoice.invoiceNumber}</h1>
              <Badge variant="outline" className={cn('text-[10px]',
                invoice.status === 'paid' ? 'inv-paid' : invoice.status === 'overdue' ? 'inv-overdue' :
                invoice.status === 'sent' ? 'inv-sent' : 'inv-draft'
              )}>{t(`invoiceStatus.${invoice.status}`)}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{new Date(invoice.issuedAt).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <Button size="sm" onClick={handleMarkPaid} className="gap-1"><CheckCircle className="h-3.5 w-3.5" /> {t('invoices.markPaid')}</Button>
          )}
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1"><Printer className="h-3.5 w-3.5" /> {t('common.print')}</Button>
        </div>
      </div>

      <Card className="p-8 print:shadow-none print:border-none">
        {/* Invoice Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold">{t('app.name')}</h2>
            </div>
            <p className="text-sm text-muted-foreground">{t('app.tagline')}</p>
          </div>
          <div className="text-right">
            <h3 className="text-lg font-bold">{t('invoices.title')}</h3>
            <p className="text-sm font-mono">{invoice.invoiceNumber}</p>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Bill To */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">{t('invoices.customer')}</p>
            {customer ? (
              <>
                <p className="font-bold">{customer.firstName} {customer.lastName}</p>
                <p className="text-sm text-muted-foreground">{customer.phone}</p>
                {customer.email && <p className="text-sm text-muted-foreground">{customer.email}</p>}
                {customer.address && <p className="text-sm text-muted-foreground">{customer.address}</p>}
                {customer.city && <p className="text-sm text-muted-foreground">{customer.city}</p>}
              </>
            ) : <p className="text-sm text-muted-foreground">—</p>}
          </div>
          <div className="text-right">
            <div className="space-y-1">
              <div className="flex justify-between gap-8"><span className="text-sm text-muted-foreground">{t('invoices.issuedDate')}:</span><span className="text-sm">{new Date(invoice.issuedAt).toLocaleDateString()}</span></div>
              <div className="flex justify-between gap-8"><span className="text-sm text-muted-foreground">{t('invoices.dueDate')}:</span><span className="text-sm">{new Date(invoice.dueAt).toLocaleDateString()}</span></div>
              {invoice.paidAt && <div className="flex justify-between gap-8"><span className="text-sm text-muted-foreground">{t('invoices.paidDate')}:</span><span className="text-sm">{new Date(invoice.paidAt).toLocaleDateString()}</span></div>}
              {repair && <div className="flex justify-between gap-8"><span className="text-sm text-muted-foreground">{t('repairs.repairInfo')}:</span><span className="text-sm">#{repair.id.slice(-6).toUpperCase()}</span></div>}
            </div>
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full mb-8">
          <thead>
            <tr className="border-b-2 border-foreground">
              <th className="text-left py-2 text-xs font-semibold uppercase">{t('invoices.description')}</th>
              <th className="text-right py-2 text-xs font-semibold uppercase w-[80px]">{t('invoices.quantity')}</th>
              <th className="text-right py-2 text-xs font-semibold uppercase w-[120px]">{t('invoices.unitPrice')}</th>
              <th className="text-right py-2 text-xs font-semibold uppercase w-[120px]">{t('invoices.total')}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, i) => (
              <tr key={i} className="border-b border-muted">
                <td className="py-3 text-sm">{item.description}</td>
                <td className="py-3 text-sm text-right">{item.quantity}</td>
                <td className="py-3 text-sm text-right tabular-nums">{item.unitPrice.toLocaleString()} DZD</td>
                <td className="py-3 text-sm text-right tabular-nums font-medium">{item.total.toLocaleString()} DZD</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-72 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('invoices.subtotal')}</span><span className="tabular-nums">{invoice.subtotal.toLocaleString()} DZD</span></div>
            {invoice.taxAmount > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('invoices.tax')} ({invoice.taxRate}%)</span><span className="tabular-nums">{invoice.taxAmount.toLocaleString()} DZD</span></div>}
            {invoice.discount > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('invoices.discount')}</span><span className="tabular-nums text-destructive">-{invoice.discount.toLocaleString()} DZD</span></div>}
            <Separator />
            <div className="flex justify-between text-lg font-bold"><span>{t('invoices.total')}</span><span className="tabular-nums">{invoice.total.toLocaleString()} DZD</span></div>
            {invoice.amountPaid > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('invoices.amountPaid')}</span><span className="tabular-nums text-emerald-600">{invoice.amountPaid.toLocaleString()} DZD</span></div>}
            {balance > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('invoices.balance')}</span><span className="tabular-nums font-semibold text-amber-600">{balance.toLocaleString()} DZD</span></div>}
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="bg-muted rounded-lg p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">{t('invoices.notes')}</p>
            <p className="text-sm">{invoice.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-muted-foreground">
          <p>{t('app.name')} — {t('app.tagline')}</p>
          <p className="mt-1">{t('common.currency')}: DZD (Algerian Dinar)</p>
        </div>
      </Card>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          main { padding: 0 !important; margin: 0 !important; }
        }
      `}</style>
    </motion.div>
  );
};
