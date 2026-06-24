import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useData } from '@/context/DataContext';
import { RepairForm } from '@/components/repairs/RepairForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Repair, RepairStatus, RepairPriority } from '@/types';

const getStatusClass = (status: Repair['status']) => {
  const map: Record<string, string> = {
    pending: 'status-pending',
    diagnosing: 'status-diagnosing',
    in_progress: 'status-in_progress',
    waiting_parts: 'status-waiting_parts',
    completed: 'status-completed',
    delivered: 'status-delivered',
    cancelled: 'status-cancelled',
  };
  return map[status] || 'status-pending';
};

const getPriorityClass = (priority: Repair['priority']) => {
  const map: Record<string, string> = {
    low: 'priority-low',
    medium: 'priority-medium',
    high: 'priority-high',
    urgent: 'priority-urgent',
  };
  return map[priority] || 'priority-low';
};

export const RepairsPage: React.FC = () => {
  const { t } = useTranslation();
  const { repairs, customers, deleteRepair } = useData();
  const [searchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(searchParams.get('action') === 'new');
  const [editRepair, setEditRepair] = useState<Repair | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    return repairs.filter(r => {
      const customer = customers.find(c => c.id === r.customerId);
      const matchesSearch = !search ||
        r.brand.toLowerCase().includes(search.toLowerCase()) ||
        r.model.toLowerCase().includes(search.toLowerCase()) ||
        r.issue.toLowerCase().includes(search.toLowerCase()) ||
        `${customer?.firstName} ${customer?.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        r.id.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || r.priority === priorityFilter;
      return matchesSearch && matchesStatus && matchesPriority;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [repairs, customers, search, statusFilter, priorityFilter]);

  const handleDelete = (id: string) => {
    if (confirm(t('common.confirm'))) {
      deleteRepair(id);
      toast.success(t('common.success'));
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('repairs.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('repairs.subtitle')}</p>
        </div>
        <Button onClick={() => { setEditRepair(null); setShowForm(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> {t('repairs.newRepair')}
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('repairs.search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t('repairs.filterStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('repairs.allStatuses')}</SelectItem>
            {(['pending', 'diagnosing', 'in_progress', 'waiting_parts', 'completed', 'delivered', 'cancelled'] as RepairStatus[]).map(s => (
              <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t('repairs.filterPriority')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('repairs.allPriorities')}</SelectItem>
            {(['low', 'medium', 'high', 'urgent'] as RepairPriority[]).map(p => (
              <SelectItem key={p} value={p}>{t(`priority.${p}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">{t('repairs.ticketNumber')}</TableHead>
              <TableHead>{t('repairs.customer')}</TableHead>
              <TableHead>{t('repairs.device')}</TableHead>
              <TableHead className="max-w-[200px]">{t('repairs.issue')}</TableHead>
              <TableHead>{t('repairs.status')}</TableHead>
              <TableHead>{t('repairs.priority')}</TableHead>
              <TableHead>{t('repairs.estimatedCost')}</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                  {t('common.noData')}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((repair) => {
              const customer = customers.find(c => c.id === repair.customerId);
              return (
                <TableRow key={repair.id} className="group">
                  <TableCell className="font-medium text-xs">#{repair.id.slice(-6).toUpperCase()}</TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{customer ? `${customer.firstName} ${customer.lastName}` : '—'}</div>
                    <div className="text-xs text-muted-foreground">{customer?.phone}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{repair.brand} {repair.model}</div>
                    <div className="text-xs text-muted-foreground">{t(`device.${repair.deviceType}`)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm truncate max-w-[200px]">{repair.issue}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn('text-[10px]', getStatusClass(repair.status))}>
                      {t(`status.${repair.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn('text-[10px]', getPriorityClass(repair.priority))}>
                      {t(`priority.${repair.priority}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">{repair.estimatedCost.toLocaleString()} DZD</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/repairs/${repair.id}`} className="gap-2">
                            <Eye className="h-4 w-4" /> {t('repairs.view')}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setEditRepair(repair); setShowForm(true); }} className="gap-2">
                          <Pencil className="h-4 w-4" /> {t('repairs.edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(repair.id)} className="gap-2 text-destructive">
                          <Trash2 className="h-4 w-4" /> {t('repairs.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <RepairForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditRepair(null); }}
        editRepair={editRepair}
      />
    </motion.div>
  );
};
