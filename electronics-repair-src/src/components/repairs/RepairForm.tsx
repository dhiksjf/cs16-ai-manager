import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useData } from '@/context/DataContext';
import type { Repair, DeviceType, RepairPriority, RepairStatus } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  editRepair?: Repair | null;
}

const deviceTypes: DeviceType[] = ['smartphone', 'tablet', 'laptop', 'desktop', 'tv', 'console', 'audio', 'other'];
const priorities: RepairPriority[] = ['low', 'medium', 'high', 'urgent'];
const statuses: RepairStatus[] = ['pending', 'diagnosing', 'in_progress', 'waiting_parts', 'completed', 'delivered', 'cancelled'];

export const RepairForm: React.FC<Props> = ({ open, onClose, editRepair }) => {
  const { t } = useTranslation();
  const { customers, addRepair, updateRepair } = useData();

  const [customerId, setCustomerId] = useState(editRepair?.customerId || '');
  const [deviceType, setDeviceType] = useState<DeviceType>(editRepair?.deviceType || 'smartphone');
  const [brand, setBrand] = useState(editRepair?.brand || '');
  const [model, setModel] = useState(editRepair?.model || '');
  const [serialNumber, setSerialNumber] = useState(editRepair?.serialNumber || '');
  const [issue, setIssue] = useState(editRepair?.issue || '');
  const [diagnosis, setDiagnosis] = useState(editRepair?.diagnosis || '');
  const [solution, setSolution] = useState(editRepair?.solution || '');
  const [status, setStatus] = useState<RepairStatus>(editRepair?.status || 'pending');
  const [priority, setPriority] = useState<RepairPriority>(editRepair?.priority || 'medium');
  const [estimatedCost, setEstimatedCost] = useState(editRepair?.estimatedCost?.toString() || '');
  const [notes, setNotes] = useState(editRepair?.notes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !brand || !model || !issue) return;

    const data = {
      customerId,
      deviceType,
      brand,
      model,
      serialNumber,
      issue,
      diagnosis,
      solution,
      status,
      priority,
      estimatedCost: parseFloat(estimatedCost) || 0,
      finalCost: editRepair?.finalCost || 0,
      partsUsed: editRepair?.partsUsed || [],
      completedAt: status === 'completed' || status === 'delivered' ? new Date().toISOString() : null,
      notes,
    };

    if (editRepair) {
      updateRepair(editRepair.id, data);
    } else {
      addRepair(data);
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editRepair ? t('repairs.editRepair') : t('repairs.newRepair')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('customers.customer')} *</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName} — {c.phone}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('repairs.device')}</Label>
              <Select value={deviceType} onValueChange={(v) => setDeviceType(v as DeviceType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {deviceTypes.map(d => <SelectItem key={d} value={d}>{t(`device.${d}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t('repairs.brand')} *</Label>
              <Input value={brand} onChange={e => setBrand(e.target.value)} placeholder="Apple, Samsung..." required />
            </div>
            <div className="space-y-2">
              <Label>{t('repairs.model')} *</Label>
              <Input value={model} onChange={e => setModel(e.target.value)} placeholder="iPhone 15..." required />
            </div>
            <div className="space-y-2">
              <Label>{t('repairs.serialNumber')}</Label>
              <Input value={serialNumber} onChange={e => setSerialNumber(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('repairs.issue')} *</Label>
            <Textarea value={issue} onChange={e => setIssue(e.target.value)} placeholder="Describe the issue..." required rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('repairs.priority')}</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as RepairPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {priorities.map(p => <SelectItem key={p} value={p}>{t(`priority.${p}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('repairs.status')}</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as RepairStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statuses.map(s => <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('repairs.estimatedCost')} (DZD)</Label>
            <Input type="number" value={estimatedCost} onChange={e => setEstimatedCost(e.target.value)} placeholder="0" />
          </div>

          <div className="space-y-2">
            <Label>{t('repairs.diagnosis')}</Label>
            <Textarea value={diagnosis} onChange={e => setDiagnosis(e.target.value)} rows={2} />
          </div>

          <div className="space-y-2">
            <Label>{t('repairs.solution')}</Label>
            <Textarea value={solution} onChange={e => setSolution(e.target.value)} rows={2} />
          </div>

          <div className="space-y-2">
            <Label>{t('repairs.notes')}</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit">{editRepair ? t('common.update') : t('common.create')}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
