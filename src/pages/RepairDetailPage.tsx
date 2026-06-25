import { useParams, useNavigate, Link } from 'react-router-dom';
import { useData } from '@/context/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft, Wrench, Calendar, DollarSign, User, Phone, Mail,
  MapPin, Plus, Trash2, CheckCircle2, Package, ClipboardList,
} from 'lucide-react';
import { useState } from 'react';
import type { RepairStatus, Part } from '@/types';

const statusColors: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  diagnosing: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  in_progress: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  waiting_parts: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  completed: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  delivered: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  cancelled: 'bg-red-500/10 text-red-600 border-red-500/20',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending', diagnosing: 'Diagnosing', in_progress: 'In Progress',
  waiting_parts: 'Waiting Parts', completed: 'Completed', delivered: 'Delivered', cancelled: 'Cancelled',
};

const deviceLabels: Record<string, string> = {
  smartphone: 'Smartphone', tablet: 'Tablet', laptop: 'Laptop',
  desktop: 'Desktop', tv: 'TV', console: 'Console', audio: 'Audio', other: 'Other',
};

export function RepairDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getRepairById, getCustomerById, updateRepair, deleteRepair, invoices } = useData();
  const repair = getRepairById(id || '');
  const customer = repair ? getCustomerById(repair.customerId) : undefined;

  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<RepairStatus>('pending');
  const [diagnosis, setDiagnosis] = useState('');
  const [solution, setSolution] = useState('');
  const [finalCost, setFinalCost] = useState('');
  const [notes, setNotes] = useState('');

  const [partName, setPartName] = useState('');
  const [partQty, setPartQty] = useState('1');
  const [partPrice, setPartPrice] = useState('');

  if (!repair || !customer) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Repair not found</p>
        <Button variant="link" onClick={() => navigate('/repairs')}>Back to Repairs</Button>
      </div>
    );
  }

  const relatedInvoices = invoices.filter(i => i.repairId === repair.id);

  const startEdit = () => {
    setStatus(repair.status);
    setDiagnosis(repair.diagnosis);
    setSolution(repair.solution);
    setFinalCost(String(repair.finalCost));
    setNotes(repair.notes);
    setEditing(true);
  };

  const saveChanges = () => {
    const updates: Parameters<typeof updateRepair>[1] = {
      status,
      diagnosis,
      solution,
      finalCost: Number(finalCost) || 0,
      notes,
    };
    if (status === 'completed' || status === 'delivered') {
      updates.completedAt = new Date().toISOString();
    }
    updateRepair(repair.id, updates);
    setEditing(false);
  };

  const addPart = () => {
    if (!partName || !partPrice) return;
    const newPart: Part = {
      id: Date.now().toString(36),
      name: partName,
      quantity: Number(partQty) || 1,
      unitPrice: Number(partPrice),
      totalPrice: (Number(partQty) || 1) * Number(partPrice),
    };
    updateRepair(repair.id, { partsUsed: [...repair.partsUsed, newPart] });
    setPartName('');
    setPartQty('1');
    setPartPrice('');
  };

  const removePart = (partId: string) => {
    updateRepair(repair.id, { partsUsed: repair.partsUsed.filter(p => p.id !== partId) });
  };

  const totalPartsCost = repair.partsUsed.reduce((sum, p) => sum + p.totalPrice, 0);

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/repairs')} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex gap-2">
          {!editing && <Button variant="outline" size="sm" onClick={startEdit}>Edit</Button>}
          {editing && <Button size="sm" onClick={saveChanges}><CheckCircle2 className="w-4 h-4 mr-1" /> Save</Button>}
          {editing && <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>}
          <Button variant="destructive" size="sm" onClick={() => { deleteRepair(repair.id); navigate('/repairs'); }}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Wrench className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{repair.brand} {repair.model}</CardTitle>
                    <p className="text-sm text-muted-foreground">{deviceLabels[repair.deviceType]} &middot; SN: {repair.serialNumber || 'N/A'}</p>
                  </div>
                </div>
                {editing ? (
                  <Select value={status} onValueChange={(v) => setStatus(v as RepairStatus)}>
                    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(statusLabels).map((s) => (
                        <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="outline" className={statusColors[repair.status]}>{statusLabels[repair.status]}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Issue</Label>
                <p className="mt-1 text-sm">{repair.issue}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide">Diagnosis</Label>
                  {editing ? (
                    <Textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} className="mt-1" rows={3} />
                  ) : (
                    <p className="mt-1 text-sm">{repair.diagnosis || <span className="text-muted-foreground italic">No diagnosis yet</span>}</p>
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide">Solution</Label>
                  {editing ? (
                    <Textarea value={solution} onChange={(e) => setSolution(e.target.value)} className="mt-1" rows={3} />
                  ) : (
                    <p className="mt-1 text-sm">{repair.solution || <span className="text-muted-foreground italic">No solution yet</span>}</p>
                  )}
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Notes</Label>
                {editing ? (
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" rows={2} />
                ) : (
                  <p className="mt-1 text-sm">{repair.notes || <span className="text-muted-foreground italic">No notes</span>}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Package className="w-4 h-4" /> Parts Used</CardTitle>
            </CardHeader>
            <CardContent>
              {repair.partsUsed.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No parts added</p>
              ) : (
                <div className="space-y-2">
                  {repair.partsUsed.map((part) => (
                    <div key={part.id} className="flex items-center justify-between p-2 rounded bg-accent/50">
                      <div>
                        <span className="font-medium text-sm">{part.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">x{part.quantity} @ ${part.unitPrice}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">${part.totalPrice}</span>
                        {editing && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removePart(part.id)}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t border-border">
                    <span className="font-medium">Total Parts Cost</span>
                    <span className="font-bold">${totalPartsCost}</span>
                  </div>
                </div>
              )}
              {editing && (
                <div className="mt-4 p-3 rounded-lg border border-dashed border-border space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Add Part</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Input placeholder="Part name" value={partName} onChange={(e) => setPartName(e.target.value)} className="col-span-1" />
                    <Input type="number" placeholder="Qty" value={partQty} onChange={(e) => setPartQty(e.target.value)} />
                    <Input type="number" placeholder="Price $" value={partPrice} onChange={(e) => setPartPrice(e.target.value)} />
                  </div>
                  <Button size="sm" variant="outline" onClick={addPart} className="w-full gap-1">
                    <Plus className="w-3.5 h-3.5" /> Add Part
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4" /> Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="font-medium">{customer.firstName} {customer.lastName}</p>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                  <Phone className="w-3.5 h-3.5" /> {customer.phone}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                  <Mail className="w-3.5 h-3.5" /> {customer.email}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                  <MapPin className="w-3.5 h-3.5" /> {customer.city}
                </div>
              </div>
              <Link to={`/customers/${customer.id}`}>
                <Button variant="outline" size="sm" className="w-full">View Customer</Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><DollarSign className="w-4 h-4" /> Cost</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Estimated</span>
                <span>${repair.estimatedCost}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Parts Total</span>
                <span>${totalPartsCost}</span>
              </div>
              <div className="flex justify-between font-medium pt-2 border-t border-border">
                <span>Final Cost</span>
                {editing ? (
                  <Input type="number" value={finalCost} onChange={(e) => setFinalCost(e.target.value)} className="w-24 h-8 text-right" />
                ) : (
                  <span>${repair.finalCost || repair.estimatedCost}</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4" /> Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{new Date(repair.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Updated</span>
                <span>{new Date(repair.updatedAt).toLocaleDateString()}</span>
              </div>
              {repair.completedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Completed</span>
                  <span>{new Date(repair.completedAt).toLocaleDateString()}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {relatedInvoices.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Invoices</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {relatedInvoices.map((inv) => (
                  <Link key={inv.id} to={`/invoices/${inv.id}`}>
                    <div className="p-2 rounded bg-accent/50 hover:bg-accent transition-colors">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{inv.invoiceNumber}</span>
                        <Badge variant="outline" className="text-[10px]">{inv.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">${inv.total}</p>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
