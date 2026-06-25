import { useState } from 'react';
import { useData } from '@/context/DataContext';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Wrench, Plus, Search, Phone } from 'lucide-react';
import type { RepairPriority, DeviceType } from '@/types';

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

const deviceIcons: Record<string, string> = {
  smartphone: 'Smartphone', tablet: 'Tablet', laptop: 'Laptop',
  desktop: 'Desktop', tv: 'TV', console: 'Console', audio: 'Audio', other: 'Other',
};

export function RepairsPage() {
  const { repairs, customers, addRepair, getCustomerById } = useData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [formData, setFormData] = useState({
    customerId: '', deviceType: 'smartphone' as DeviceType,
    brand: '', model: '', serialNumber: '',
    issue: '', priority: 'medium' as RepairPriority,
    estimatedCost: '', notes: '',
  });

  const filtered = repairs.filter((r) => {
    const customer = getCustomerById(r.customerId);
    const text = `${r.brand} ${r.model} ${r.issue} ${customer?.firstName || ''} ${customer?.lastName || ''}`.toLowerCase();
    const matchesSearch = text.includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSubmit = () => {
    if (!formData.customerId || !formData.brand || !formData.model || !formData.issue) return;
    addRepair({
      customerId: formData.customerId,
      deviceType: formData.deviceType,
      brand: formData.brand,
      model: formData.model,
      serialNumber: formData.serialNumber,
      issue: formData.issue,
      diagnosis: '',
      solution: '',
      status: 'pending',
      priority: formData.priority,
      estimatedCost: Number(formData.estimatedCost) || 0,
      finalCost: 0,
      partsUsed: [],
      completedAt: null,
      notes: formData.notes,
    });
    setFormData({ customerId: '', deviceType: 'smartphone', brand: '', model: '', serialNumber: '', issue: '', priority: 'medium', estimatedCost: '', notes: '' });
    setIsAddOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search repairs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {Object.entries(statusLabels).map(([val, label]) => (
              <SelectItem key={val} value={val}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              New Repair
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Repair</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Customer *</Label>
                <Select value={formData.customerId} onValueChange={(v) => setFormData({ ...formData, customerId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName} - {c.phone}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Device Type</Label>
                  <Select value={formData.deviceType} onValueChange={(v) => setFormData({ ...formData, deviceType: v as DeviceType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(deviceIcons).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Priority</Label>
                  <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v as RepairPriority })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Brand *</Label><Input value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} placeholder="Apple, Samsung..." /></div>
                <div><Label>Model *</Label><Input value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} placeholder="iPhone 15 Pro..." /></div>
              </div>
              <div><Label>Serial Number</Label><Input value={formData.serialNumber} onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })} placeholder="Optional" /></div>
              <div><Label>Issue *</Label><Textarea value={formData.issue} onChange={(e) => setFormData({ ...formData, issue: e.target.value })} placeholder="Describe the problem..." rows={3} /></div>
              <div><Label>Estimated Cost ($)</Label><Input type="number" value={formData.estimatedCost} onChange={(e) => setFormData({ ...formData, estimatedCost: e.target.value })} placeholder="0" /></div>
              <div><Label>Notes</Label><Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Internal notes..." rows={2} /></div>
              <Button onClick={handleSubmit} className="w-full" disabled={!formData.customerId || !formData.brand || !formData.model || !formData.issue}>
                Create Repair
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {filtered.map((repair) => {
          const customer = getCustomerById(repair.customerId);
          return (
            <Link key={repair.id} to={`/repairs/${repair.id}`}>
              <Card className="hover:shadow-md transition-all cursor-pointer group">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Wrench className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{repair.brand} {repair.model}</span>
                        <Badge variant="outline" className={`text-[10px] ${statusColors[repair.status]}`}>
                          {statusLabels[repair.status]}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">{deviceIcons[repair.deviceType]}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 truncate">{repair.issue}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown'}
                        </span>
                        {repair.estimatedCost > 0 && (
                          <span>Est: ${repair.estimatedCost}</span>
                        )}
                        <span>Priority: <span className={repair.priority === 'urgent' ? 'text-red-500 font-medium' : repair.priority === 'high' ? 'text-amber-500' : ''}>{repair.priority}</span></span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Wrench className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No repairs found</p>
          </div>
        )}
      </div>
    </div>
  );
}
