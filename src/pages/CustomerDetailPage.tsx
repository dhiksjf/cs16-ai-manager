import { useParams, useNavigate, Link } from 'react-router-dom';
import { useData } from '@/context/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft, Phone, Mail, MapPin, Calendar, Wrench,
  FileText, Trash2, CheckCircle2, Edit3,
} from 'lucide-react';
import { useState } from 'react';

const statusColors: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600',
  diagnosing: 'bg-blue-500/10 text-blue-600',
  in_progress: 'bg-violet-500/10 text-violet-600',
  waiting_parts: 'bg-orange-500/10 text-orange-600',
  completed: 'bg-emerald-500/10 text-emerald-600',
  delivered: 'bg-cyan-500/10 text-cyan-600',
  cancelled: 'bg-red-500/10 text-red-600',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending', diagnosing: 'Diagnosing', in_progress: 'In Progress',
  waiting_parts: 'Waiting Parts', completed: 'Completed', delivered: 'Delivered', cancelled: 'Cancelled',
};

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getCustomerById, updateCustomer, deleteCustomer, getRepairsByCustomer, getInvoicesByCustomer } = useData();
  const customer = getCustomerById(id || '');
  const repairs = getRepairsByCustomer(id || '');
  const invoices = getInvoicesByCustomer(id || '');

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', email: '', address: '', city: '', notes: '' });

  if (!customer) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Customer not found</p>
        <Button variant="link" onClick={() => navigate('/customers')}>Back to Customers</Button>
      </div>
    );
  }

  const startEdit = () => {
    setForm({
      firstName: customer.firstName, lastName: customer.lastName, phone: customer.phone,
      email: customer.email, address: customer.address, city: customer.city, notes: customer.notes,
    });
    setEditing(true);
  };

  const saveEdit = () => {
    updateCustomer(customer.id, form);
    setEditing(false);
  };

  const initials = `${customer.firstName[0]}${customer.lastName[0]}`.toUpperCase();

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/customers')} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex gap-2">
          {!editing && <Button variant="outline" size="sm" onClick={startEdit}><Edit3 className="w-4 h-4 mr-1" /> Edit</Button>}
          {editing && <Button size="sm" onClick={saveEdit}><CheckCircle2 className="w-4 h-4 mr-1" /> Save</Button>}
          {editing && <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>}
          <Button variant="destructive" size="sm" onClick={() => { deleteCustomer(customer.id); navigate('/customers'); }}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary mb-4">
                  {initials}
                </div>
                {editing ? (
                  <div className="w-full space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label className="text-xs">First</Label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
                      <div><Label className="text-xs">Last</Label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
                    </div>
                    <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                    <div><Label className="text-xs">Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                    <div><Label className="text-xs">Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                    <div><Label className="text-xs">City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                    <div><Label className="text-xs">Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
                  </div>
                ) : (
                  <>
                    <h2 className="text-xl font-semibold">{customer.firstName} {customer.lastName}</h2>
                    <div className="mt-4 space-y-2 w-full text-left">
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>{customer.phone}</span>
                      </div>
                      {customer.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <span>{customer.email}</span>
                        </div>
                      )}
                      {customer.address && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <span>{customer.address}{customer.city ? `, ${customer.city}` : ''}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>Customer since {new Date(customer.createdAt).toLocaleDateString()}</span>
                      </div>
                      {customer.notes && (
                        <div className="mt-3 p-3 bg-accent/50 rounded-lg text-sm">
                          <Label className="text-xs text-muted-foreground">Notes</Label>
                          <p className="mt-1">{customer.notes}</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">{repairs.length}</p>
                <p className="text-xs text-muted-foreground">Repairs</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">{invoices.length}</p>
                <p className="text-xs text-muted-foreground">Invoices</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">${invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0)}</p>
                <p className="text-xs text-muted-foreground">Paid</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Wrench className="w-4 h-4" /> Repair History</CardTitle>
            </CardHeader>
            <CardContent>
              {repairs.length === 0 ? (
                <p className="text-sm text-muted-foreground italic text-center py-6">No repairs yet</p>
              ) : (
                <div className="space-y-2">
                  {repairs.map((r) => (
                    <Link key={r.id} to={`/repairs/${r.id}`}>
                      <div className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{r.brand} {r.model}</span>
                            <Badge variant="outline" className={`text-[10px] ${statusColors[r.status]}`}>{statusLabels[r.status]}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{r.issue.substring(0, 60)}...</p>
                        </div>
                        <span className="text-sm font-medium">{r.estimatedCost > 0 ? `$${r.estimatedCost}` : ''}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4" /> Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground italic text-center py-6">No invoices yet</p>
              ) : (
                <div className="space-y-2">
                  {invoices.map((inv) => (
                    <Link key={inv.id} to={`/invoices/${inv.id}`}>
                      <div className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{inv.invoiceNumber}</span>
                            <Badge variant="outline" className="text-[10px]">{inv.status}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{inv.items.length} items</p>
                        </div>
                        <span className="text-sm font-medium">${inv.total.toFixed(2)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
