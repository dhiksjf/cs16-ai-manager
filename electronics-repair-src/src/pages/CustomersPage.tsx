import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useData } from '@/context/DataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Eye, Phone, Mail } from 'lucide-react';
import { toast } from 'sonner';
import type { Customer } from '@/types';

export const CustomersPage: React.FC = () => {
  const { t } = useTranslation();
  const { customers, addCustomer, updateCustomer, deleteCustomer, getRepairsByCustomer } = useData();
  const [searchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(searchParams.get('action') === 'new');
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [search, setSearch] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', phone: '', email: '', address: '', city: '', notes: '',
  });

  const resetForm = () => {
    setFormData({ firstName: '', lastName: '', phone: '', email: '', address: '', city: '', notes: '' });
    setEditCustomer(null);
  };

  const openEdit = (c: Customer) => {
    setEditCustomer(c);
    setFormData({
      firstName: c.firstName, lastName: c.lastName, phone: c.phone,
      email: c.email, address: c.address, city: c.city, notes: c.notes,
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName || !formData.phone) return;
    if (editCustomer) {
      updateCustomer(editCustomer.id, formData);
      toast.success(t('common.success'));
    } else {
      addCustomer(formData);
      toast.success(t('common.success'));
    }
    resetForm();
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    if (confirm(t('common.confirm'))) {
      deleteCustomer(id);
      toast.success(t('common.success'));
    }
  };

  const filtered = useMemo(() => {
    return customers.filter(c => {
      if (!search) return true;
      const q = search.toLowerCase();
      return `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        c.phone.includes(q) || c.email.toLowerCase().includes(q) || c.city.toLowerCase().includes(q);
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [customers, search]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('customers.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('customers.subtitle')}</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> {t('customers.newCustomer')}
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t('customers.search')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('customers.firstName')}</TableHead>
              <TableHead>{t('customers.phone')}</TableHead>
              <TableHead>{t('customers.email')}</TableHead>
              <TableHead>{t('customers.city')}</TableHead>
              <TableHead>{t('customers.totalRepairs')}</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">{t('common.noData')}</TableCell></TableRow>
            )}
            {filtered.map((c) => {
              const repairs = getRepairsByCustomer(c.id);
              return (
                <TableRow key={c.id} className="group">
                  <TableCell>
                    <Link to={`/customers/${c.id}`} className="font-medium hover:underline">{c.firstName} {c.lastName}</Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{c.phone}</div>
                  </TableCell>
                  <TableCell>
                    {c.email ? <div className="flex items-center gap-1.5 text-sm"><Mail className="h-3.5 w-3.5 text-muted-foreground" />{c.email}</div> : '—'}
                  </TableCell>
                  <TableCell className="text-sm">{c.city || '—'}</TableCell>
                  <TableCell className="text-sm">{repairs.length}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild><Link to={`/customers/${c.id}`} className="gap-2"><Eye className="h-4 w-4" /> {t('customers.view')}</Link></DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(c)} className="gap-2"><Pencil className="h-4 w-4" /> {t('customers.edit')}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(c.id)} className="gap-2 text-destructive"><Trash2 className="h-4 w-4" /> {t('customers.delete')}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showForm} onOpenChange={(v) => { if (!v) { resetForm(); setShowForm(false); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editCustomer ? t('customers.editCustomer') : t('customers.newCustomer')}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>{t('customers.firstName')} *</Label><Input value={formData.firstName} onChange={e => setFormData(p => ({ ...p, firstName: e.target.value }))} required /></div>
              <div className="space-y-2"><Label>{t('customers.lastName')} *</Label><Input value={formData.lastName} onChange={e => setFormData(p => ({ ...p, lastName: e.target.value }))} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>{t('customers.phone')} *</Label><Input value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} required /></div>
              <div className="space-y-2"><Label>{t('customers.email')}</Label><Input type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>{t('customers.address')}</Label><Input value={formData.address} onChange={e => setFormData(p => ({ ...p, address: e.target.value }))} /></div>
              <div className="space-y-2"><Label>{t('customers.city')}</Label><Input value={formData.city} onChange={e => setFormData(p => ({ ...p, city: e.target.value }))} /></div>
            </div>
            <div className="space-y-2"><Label>{t('customers.customerNotes')}</Label><textarea className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[60px]" value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { resetForm(); setShowForm(false); }}>{t('common.cancel')}</Button>
              <Button type="submit">{editCustomer ? t('common.update') : t('common.create')}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};
