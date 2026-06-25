import { useParams, useNavigate, Link } from 'react-router-dom';
import { useData } from '@/context/DataContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, FileText,
  CheckCircle2, Trash2, Printer,
} from 'lucide-react';

const statusColors: Record<string, string> = {
  draft: 'bg-slate-500/10 text-slate-600',
  sent: 'bg-blue-500/10 text-blue-600',
  paid: 'bg-emerald-500/10 text-emerald-600',
  overdue: 'bg-red-500/10 text-red-600',
  cancelled: 'bg-gray-500/10 text-gray-600',
};

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getInvoiceById, getRepairById, getCustomerById, updateInvoice, deleteInvoice } = useData();
  const invoice = getInvoiceById(id || '');
  const customer = invoice ? getCustomerById(invoice.customerId) : undefined;
  const repair = invoice ? getRepairById(invoice.repairId) : undefined;

  if (!invoice || !customer) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Invoice not found</p>
        <Button variant="link" onClick={() => navigate('/invoices')}>Back to Invoices</Button>
      </div>
    );
  }

  const markPaid = () => {
    updateInvoice(invoice.id, { status: 'paid', amountPaid: invoice.total, paidAt: new Date().toISOString() });
  };

  const markSent = () => {
    updateInvoice(invoice.id, { status: 'sent' });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between no-print">
        <Button variant="ghost" size="sm" onClick={() => navigate('/invoices')} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex gap-2">
          {invoice.status === 'draft' && <Button size="sm" variant="outline" onClick={markSent}>Mark Sent</Button>}
          {(invoice.status === 'draft' || invoice.status === 'sent' || invoice.status === 'overdue') && (
            <Button size="sm" onClick={markPaid} className="gap-1"><CheckCircle2 className="w-4 h-4" /> Mark Paid</Button>
          )}
          <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1"><Printer className="w-4 h-4" /> Print</Button>
          <Button size="sm" variant="destructive" onClick={() => { deleteInvoice(invoice.id); navigate('/invoices'); }}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Card className="print:shadow-none">
        <CardContent className="p-8">
          <div className="flex items-start justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">RepairPro</h1>
                  <p className="text-xs text-muted-foreground">Electronics Repair Management</p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold">INVOICE</h2>
              <p className="text-sm text-muted-foreground">{invoice.invoiceNumber}</p>
              <Badge variant="outline" className={`mt-2 ${statusColors[invoice.status]}`}>{invoice.status.toUpperCase()}</Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Bill To</p>
              <p className="font-medium">{customer.firstName} {customer.lastName}</p>
              <p className="text-sm text-muted-foreground">{customer.phone}</p>
              {customer.email && <p className="text-sm text-muted-foreground">{customer.email}</p>}
              {customer.address && <p className="text-sm text-muted-foreground">{customer.address}, {customer.city}</p>}
            </div>
            <div className="text-right">
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Issue Date</span>
                  <span>{new Date(invoice.issuedAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Due Date</span>
                  <span>{new Date(invoice.dueAt).toLocaleDateString()}</span>
                </div>
                {invoice.paidAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Paid Date</span>
                    <span className="text-emerald-600 font-medium">{new Date(invoice.paidAt).toLocaleDateString()}</span>
                  </div>
                )}
                {repair && (
                  <div className="flex justify-between text-sm mt-2 pt-2 border-t border-border">
                    <span className="text-muted-foreground">Related Repair</span>
                    <Link to={`/repairs/${repair.id}`} className="text-primary hover:underline">{repair.brand} {repair.model}</Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Description</th>
                  <th className="text-center p-3 font-medium w-24">Qty</th>
                  <th className="text-right p-3 font-medium w-28">Unit Price</th>
                  <th className="text-right p-3 font-medium w-28">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="p-3">{item.description}</td>
                    <td className="p-3 text-center">{item.quantity}</td>
                    <td className="p-3 text-right">${item.unitPrice.toFixed(2)}</td>
                    <td className="p-3 text-right font-medium">${item.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <div className="w-72 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${invoice.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax ({invoice.taxRate}%)</span>
                <span>${invoice.taxAmount.toFixed(2)}</span>
              </div>
              {invoice.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-red-500">-${invoice.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
                <span>Total</span>
                <span>${invoice.total.toFixed(2)}</span>
              </div>
              {invoice.amountPaid > 0 && (
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>Amount Paid</span>
                  <span>${invoice.amountPaid.toFixed(2)}</span>
                </div>
              )}
              {invoice.amountPaid > 0 && invoice.amountPaid < invoice.total && (
                <div className="flex justify-between text-sm text-red-500">
                  <span>Balance Due</span>
                  <span>${(invoice.total - invoice.amountPaid).toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          {invoice.notes && (
            <div className="mt-8 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm">{invoice.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          aside { display: none !important; }
          header { display: none !important; }
          main { margin: 0 !important; padding: 0 !important; }
        }
      `}</style>
    </div>
  );
}
