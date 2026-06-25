import { useState } from 'react';
import { useData } from '@/context/DataContext';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { FileText, Plus, Search, Calendar, DollarSign, User } from 'lucide-react';

const statusColors: Record<string, string> = {
  draft: 'bg-slate-500/10 text-slate-600',
  sent: 'bg-blue-500/10 text-blue-600',
  paid: 'bg-emerald-500/10 text-emerald-600',
  overdue: 'bg-red-500/10 text-red-600',
  cancelled: 'bg-gray-500/10 text-gray-600',
};

export function InvoicesPage() {
  const { invoices, repairs, addInvoice, getRepairById, getCustomerById } = useData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [form, setForm] = useState({
    repairId: '', customerId: '', taxRate: '8', discount: '0', notes: '',
  });

  const filtered = invoices.filter((inv) => {
    const customer = getCustomerById(inv.customerId);
    const text = `${inv.invoiceNumber} ${customer?.firstName || ''} ${customer?.lastName || ''}`.toLowerCase();
    const matchesSearch = text.includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleRepairChange = (repairId: string) => {
    const repair = getRepairById(repairId);
    if (repair) {
      setForm({ ...form, repairId, customerId: repair.customerId });
    }
  };

  const handleSubmit = () => {
    if (!form.repairId || !form.customerId) return;
    const repair = getRepairById(form.repairId);
    if (!repair) return;

    const partsTotal = repair.partsUsed.reduce((s, p) => s + p.totalPrice, 0);
    const labor = repair.finalCost > 0 ? repair.finalCost - partsTotal : repair.estimatedCost - partsTotal;
    const items = repair.partsUsed.map((p, i) => ({
      id: `item-${i}`, description: p.name, quantity: p.quantity, unitPrice: p.unitPrice, total: p.totalPrice,
    }));
    if (labor > 0) {
      items.push({ id: 'item-labor', description: 'Labor', quantity: 1, unitPrice: Math.max(0, labor), total: Math.max(0, labor) });
    }
    if (items.length === 0) {
      items.push({ id: 'item-1', description: `Repair: ${repair.brand} ${repair.model}`, quantity: 1, unitPrice: repair.estimatedCost, total: repair.estimatedCost });
    }

    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const taxRate = Number(form.taxRate) || 0;
    const discount = Number(form.discount) || 0;
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmount - discount;

    const now = new Date();
    const due = new Date(now);
    due.setDate(due.getDate() + 14);

    const invoiceCount = invoices.length + 1;
    const invoiceNumber = `INV-${now.getFullYear()}-${String(invoiceCount).padStart(3, '0')}`;

    addInvoice({
      repairId: form.repairId,
      customerId: form.customerId,
      invoiceNumber,
      items,
      subtotal,
      taxRate,
      taxAmount,
      discount,
      total,
      amountPaid: 0,
      status: 'draft',
      dueAt: due.toISOString(),
      paidAt: null,
      notes: form.notes,
    });

    setForm({ repairId: '', customerId: '', taxRate: '8', discount: '0', notes: '' });
    setIsAddOpen(false);
  };

  const completedRepairs = repairs.filter(r => r.status === 'completed' || r.status === 'delivered');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search invoices..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Create</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Create Invoice</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <Label>Repair *</Label>
                <Select value={form.repairId} onValueChange={handleRepairChange}>
                  <SelectTrigger><SelectValue placeholder="Select completed repair" /></SelectTrigger>
                  <SelectContent>
                    {completedRepairs.map((r) => {
                      const c = getCustomerById(r.customerId);
                      return <SelectItem key={r.id} value={r.id}>{r.brand} {r.model} - {c?.firstName} {c?.lastName}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Tax Rate (%)</Label><Input type="number" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} /></div>
                <div><Label>Discount ($)</Label><Input type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} /></div>
              </div>
              <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <Button onClick={handleSubmit} className="w-full" disabled={!form.repairId}>Create Invoice</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {filtered.map((inv) => {
          const customer = getCustomerById(inv.customerId);
          return (
            <Link key={inv.id} to={`/invoices/${inv.id}`}>
              <Card className="hover:shadow-md transition-all cursor-pointer group">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{inv.invoiceNumber}</span>
                        <Badge variant="outline" className={`text-[10px] ${statusColors[inv.status]}`}>{inv.status}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><User className="w-3 h-3" />{customer?.firstName} {customer?.lastName}</span>
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(inv.issuedAt).toLocaleDateString()}</span>
                        <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{inv.items.length} items</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-lg">${inv.total.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{inv.status === 'paid' ? 'Paid' : `Due ${new Date(inv.dueAt).toLocaleDateString()}`}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No invoices found</p>
          </div>
        )}
      </div>
    </div>
  );
}
