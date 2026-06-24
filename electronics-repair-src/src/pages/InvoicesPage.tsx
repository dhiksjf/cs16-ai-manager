import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useData } from '@/context/DataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, Search, Eye, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { InvoiceItem } from '@/types';

export const InvoicesPage: React.FC = () => {
  const { t } = useTranslation();
  const { invoices, customers, getRepairById, addInvoice, deleteInvoice } = useData();
  const [searchParams, setSearchParams] = useSearchParams();

  const [showForm, setShowForm] = useState(searchParams.get('action') === 'new');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Pre-fill from URL
  const prefilledRepairId = searchParams.get('repairId') || '';
  const prefilledCustomerId = searchParams.get('customerId') || '';

  // Form state
  const [formCustomerId, setFormCustomerId] = useState(prefilledCustomerId);
  const [formRepairId, setFormRepairId] = useState(prefilledRepairId);
  const [items, setItems] = useState<InvoiceItem[]>([{ id: '1', description: '', quantity: 1, unitPrice: 0, total: 0 }]);
  const [taxRate, setTaxRate] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [invNotes, setInvNotes] = useState('');

  useEffect(() => {
    if (prefilledRepairId && prefilledCustomerId) {
      const repair = getRepairById(prefilledRepairId);
      if (repair) {
        setItems([{
          id: '1',
          description: `Repair: ${repair.brand} ${repair.model} — ${repair.issue.slice(0, 50)}`,
          quantity: 1,
          unitPrice: repair.estimatedCost || repair.finalCost || 0,
          total: repair.estimatedCost || repair.finalCost || 0,
        }]);
      }
    }
  }, [prefilledRepairId]);

  const addItem = () => {
    setItems(prev => [...prev, { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0, total: 0 }]);
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: string | number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        updated.total = updated.quantity * updated.unitPrice;
      }
      return updated;
    }));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.length > 1 ? prev.filter(i => i.id !== id) : prev);
  };

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount - discount;

  const resetForm = () => {
    setFormCustomerId('');
    setFormRepairId('');
    setItems([{ id: '1', description: '', quantity: 1, unitPrice: 0, total: 0 }]);
    setTaxRate(0);
    setDiscount(0);
    setInvNotes('');
    setSearchParams({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerId || items.some(i => !i.description)) return;

    const invoiceNum = `INV-${Date.now().toString(36).toUpperCase()}`;
    const now = new Date();
    const due = new Date(now);
    due.setDate(due.getDate() + 30);

    addInvoice({
      repairId: formRepairId || '',
      customerId: formCustomerId,
      invoiceNumber: invoiceNum,
      items: items.map(i => ({ ...i, total: i.quantity * i.unitPrice })),
      subtotal,
      taxRate,
      taxAmount,
      discount,
      total,
      amountPaid: 0,
      status: 'draft',
      dueAt: due.toISOString(),
      paidAt: null,
      notes: invNotes,
    });

    toast.success(t('common.success'));
    resetForm();
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    if (confirm(t('common.confirm'))) {
      deleteInvoice(id);
      toast.success(t('common.success'));
    }
  };

  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      const customer = customers.find(c => c.id === inv.customerId);
      const matchesSearch = !search ||
        inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
        `${customer?.firstName} ${customer?.lastName}`.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
      return matchesSearch && matchesStatus;
    }).sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
  }, [invoices, customers, search, statusFilter]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('invoices.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('invoices.subtitle')}</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> {t('invoices.newInvoice')}
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t('invoices.search')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder={t('invoices.filterStatus')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('invoices.allStatuses')}</SelectItem>
            {(['draft', 'sent', 'paid', 'overdue', 'cancelled'] as const).map(s => <SelectItem key={s} value={s}>{t(`invoiceStatus.${s}`)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('invoices.invoiceNumber')}</TableHead>
              <TableHead>{t('invoices.customer')}</TableHead>
              <TableHead>{t('invoices.total')}</TableHead>
              <TableHead>{t('invoices.status')}</TableHead>
              <TableHead>{t('invoices.issuedDate')}</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">{t('common.noData')}</TableCell></TableRow>}
            {filtered.map(inv => {
              const customer = customers.find(c => c.id === inv.customerId);
              return (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-sm font-medium">{inv.invoiceNumber}</TableCell>
                  <TableCell className="text-sm">{customer ? `${customer.firstName} ${customer.lastName}` : '—'}</TableCell>
                  <TableCell className="text-sm tabular-nums font-semibold">{inv.total.toLocaleString()} DZD</TableCell>
                  <TableCell><Badge variant="outline" className={cn('text-[10px]', inv.status === 'paid' ? 'inv-paid' : inv.status === 'overdue' ? 'inv-overdue' : inv.status === 'sent' ? 'inv-sent' : 'inv-draft')}>{t(`invoiceStatus.${inv.status}`)}</Badge></TableCell>
                  <TableCell className="text-sm">{new Date(inv.issuedAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild><Link to={`/invoices/${inv.id}`}><Eye className="h-4 w-4" /></Link></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(inv.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* New Invoice Dialog */}
      <Dialog open={showForm} onOpenChange={(v) => { if (!v) { resetForm(); setShowForm(false); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('invoices.newInvoice')}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('invoices.customer')} *</Label>
                <Select value={formCustomerId} onValueChange={setFormCustomerId}>
                  <SelectTrigger><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                  <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('repairs.repairInfo')}</Label>
                <Select value={formRepairId} onValueChange={setFormRepairId}>
                  <SelectTrigger><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                  <SelectContent><SelectItem value="">{t('common.none')}</SelectItem>{formCustomerId && (
                    <>{/* Would need repairs list here */}</>
                  )}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label>{t('invoices.items')}</Label><Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1"><Plus className="h-3.5 w-3.5" />{t('invoices.addItem')}</Button></div>
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5"><Input value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} placeholder={t('invoices.description')} /></div>
                    <div className="col-span-2"><Input type="number" min={1} value={item.quantity} onChange={e => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)} /></div>
                    <div className="col-span-3"><Input type="number" value={item.unitPrice} onChange={e => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)} placeholder={t('invoices.unitPrice')} /></div>
                    <div className="col-span-2 text-right">
                      <span className="text-sm font-medium">{item.total.toLocaleString()} DZD</span>
                      {items.length > 1 && <Button type="button" variant="ghost" size="sm" className="h-6 text-destructive" onClick={() => removeItem(item.id)}><Trash2 className="h-3 w-3" /></Button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2"><Label>{t('invoices.taxRate')} (%)</Label><Input type="number" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)} /></div>
              <div className="space-y-2"><Label>{t('invoices.discountAmount')} (DZD)</Label><Input type="number" value={discount} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} /></div>
              <div className="space-y-2"><Label>{t('invoices.notes')}</Label><Input value={invNotes} onChange={e => setInvNotes(e.target.value)} /></div>
            </div>

            <div className="bg-muted rounded-lg p-4 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{t('invoices.subtotal')}</span><span>{subtotal.toLocaleString()} DZD</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t('invoices.tax')} ({taxRate}%)</span><span>{taxAmount.toLocaleString()} DZD</span></div>
              {discount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t('invoices.discount')}</span><span>-{discount.toLocaleString()} DZD</span></div>}
              <div className="flex justify-between text-lg font-bold pt-1 border-t"><span>{t('invoices.total')}</span><span>{total.toLocaleString()} DZD</span></div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { resetForm(); setShowForm(false); }}>{t('common.cancel')}</Button>
              <Button type="submit">{t('common.create')}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};
