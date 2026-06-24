import React, { createContext, useContext, useCallback, useEffect, useRef } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { Repair, Customer, Invoice, DashboardStats, MonthlyData, StatusCount } from '@/types';

interface DataContextType {
  repairs: Repair[];
  customers: Customer[];
  invoices: Invoice[];
  addRepair: (repair: Omit<Repair, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateRepair: (id: string, repair: Partial<Repair>) => void;
  deleteRepair: (id: string) => void;
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => void;
  updateCustomer: (id: string, customer: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  addInvoice: (invoice: Omit<Invoice, 'id' | 'issuedAt'>) => void;
  updateInvoice: (id: string, invoice: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  getCustomerById: (id: string) => Customer | undefined;
  getRepairById: (id: string) => Repair | undefined;
  getInvoiceById: (id: string) => Invoice | undefined;
  getRepairsByCustomer: (customerId: string) => Repair[];
  getInvoicesByCustomer: (customerId: string) => Invoice[];
  getDashboardStats: () => DashboardStats;
  getMonthlyData: () => MonthlyData[];
  getStatusCounts: () => StatusCount[];
  generateId: () => string;
  syncToServer: () => Promise<void>;
  lastSync: number;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const API_BASE = '/api/repair';

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [repairs, setRepairs] = useLocalStorage<Repair[]>('repairpro-repairs', []);
  const [customers, setCustomers] = useLocalStorage<Customer[]>('repairpro-customers', []);
  const [invoices, setInvoices] = useLocalStorage<Invoice[]>('repairpro-invoices', []);
  const [lastSync, setLastSync] = useLocalStorage<number>('repairpro-lastsync', 0);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval>>(undefined as unknown as ReturnType<typeof setInterval>);

  const generateId = useCallback(() => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5).toUpperCase();
  }, []);

  // Load data from server on mount
  useEffect(() => {
    const loadFromServer = async () => {
      try {
        const res = await fetch(`${API_BASE}/data`);
        if (res.ok) {
          const data = await res.json();
          if (data.repairs && data.repairs.length > 0) setRepairs(data.repairs);
          if (data.customers && data.customers.length > 0) setCustomers(data.customers);
          if (data.invoices && data.invoices.length > 0) setInvoices(data.invoices);
          setLastSync(Date.now());
        }
      } catch {
        // Server not available, use local data
      }
    };
    loadFromServer();
  }, []);

  // Auto-sync to server every 10 seconds
  useEffect(() => {
    syncIntervalRef.current = setInterval(() => {
      syncToServer();
    }, 10000);
    return () => clearInterval(syncIntervalRef.current);
  }, [repairs, customers, invoices]);

  const syncToServer = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repairs, customers, invoices }),
      });
      setLastSync(Date.now());
    } catch {
      // Silently fail - data is preserved locally
    }
  }, [repairs, customers, invoices]);

  // ─── Repair CRUD ───
  const addRepair = useCallback((repair: Omit<Repair, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newRepair: Repair = {
      ...repair,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setRepairs(prev => [newRepair, ...prev]);
  }, [generateId]);

  const updateRepair = useCallback((id: string, updates: Partial<Repair>) => {
    setRepairs(prev => prev.map(r => r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r));
  }, []);

  const deleteRepair = useCallback((id: string) => {
    setRepairs(prev => prev.filter(r => r.id !== id));
    setInvoices(prev => prev.filter(i => i.repairId !== id));
  }, []);

  // ─── Customer CRUD ───
  const addCustomer = useCallback((customer: Omit<Customer, 'id' | 'createdAt'>) => {
    const newCustomer: Customer = {
      ...customer,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    setCustomers(prev => [newCustomer, ...prev]);
  }, [generateId]);

  const updateCustomer = useCallback((id: string, updates: Partial<Customer>) => {
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const deleteCustomer = useCallback((id: string) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
    setRepairs(prev => prev.filter(r => r.customerId !== id));
    setInvoices(prev => prev.filter(i => i.customerId !== id));
  }, []);

  // ─── Invoice CRUD ───
  const addInvoice = useCallback((invoice: Omit<Invoice, 'id' | 'issuedAt'>) => {
    const newInvoice: Invoice = {
      ...invoice,
      id: generateId(),
      issuedAt: new Date().toISOString(),
    };
    setInvoices(prev => [newInvoice, ...prev]);
  }, [generateId]);

  const updateInvoice = useCallback((id: string, updates: Partial<Invoice>) => {
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
  }, []);

  const deleteInvoice = useCallback((id: string) => {
    setInvoices(prev => prev.filter(i => i.id !== id));
  }, []);

  // ─── Lookups ───
  const getCustomerById = useCallback((id: string) => customers.find(c => c.id === id), [customers]);
  const getRepairById = useCallback((id: string) => repairs.find(r => r.id === id), [repairs]);
  const getInvoiceById = useCallback((id: string) => invoices.find(i => i.id === id), [invoices]);
  const getRepairsByCustomer = useCallback((customerId: string) => repairs.filter(r => r.customerId === customerId), [repairs]);
  const getInvoicesByCustomer = useCallback((customerId: string) => invoices.filter(i => i.customerId === customerId), [invoices]);

  // ─── Dashboard Analytics ───
  const getDashboardStats = useCallback((): DashboardStats => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const completedRepairs = repairs.filter(r => r.status === 'completed' || r.status === 'delivered');
    const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total, 0);
    const monthRevenue = invoices.filter(i => i.status === 'paid' && new Date(i.issuedAt) >= monthStart).reduce((sum, i) => sum + i.total, 0);
    const avgTime = completedRepairs.length > 0
      ? completedRepairs.reduce((sum, r) => {
          if (r.completedAt) {
            const days = (new Date(r.completedAt).getTime() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24);
            return sum + Math.max(0, days);
          }
          return sum;
        }, 0) / completedRepairs.length
      : 0;

    return {
      totalRepairs: repairs.length,
      pendingRepairs: repairs.filter(r => r.status === 'pending' || r.status === 'diagnosing' || r.status === 'in_progress' || r.status === 'waiting_parts').length,
      completedRepairs: completedRepairs.length,
      totalRevenue,
      monthlyRevenue: monthRevenue,
      totalCustomers: customers.length,
      newCustomersThisMonth: customers.filter(c => new Date(c.createdAt) >= monthStart).length,
      avgRepairTime: Math.round(avgTime * 10) / 10,
    };
  }, [repairs, customers, invoices]);

  const getMonthlyData = useCallback((): MonthlyData[] => {
    const months: MonthlyData[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = d.toLocaleString('en', { month: 'short', year: '2-digit' });
      const monthRepairs = repairs.filter(r => {
        const rd = new Date(r.createdAt);
        return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth();
      });
      const monthInvoices = invoices.filter(inv => {
        const id = new Date(inv.issuedAt);
        return id.getFullYear() === d.getFullYear() && id.getMonth() === d.getMonth() && inv.status === 'paid';
      });
      months.push({
        month: monthStr,
        revenue: monthInvoices.reduce((s, inv) => s + inv.total, 0),
        repairs: monthRepairs.length,
        completed: monthRepairs.filter(r => r.status === 'completed' || r.status === 'delivered').length,
      });
    }
    return months;
  }, [repairs, invoices]);

  const getStatusCounts = useCallback((): StatusCount[] => {
    const statusConfig: Record<string, { label: string; color: string }> = {
      pending: { label: 'Pending', color: '#f59e0b' },
      diagnosing: { label: 'Diagnosing', color: '#3b82f6' },
      in_progress: { label: 'In Progress', color: '#8b5cf6' },
      waiting_parts: { label: 'Waiting Parts', color: '#f97316' },
      completed: { label: 'Completed', color: '#10b981' },
      delivered: { label: 'Delivered', color: '#06b6d4' },
      cancelled: { label: 'Cancelled', color: '#ef4444' },
    };
    return Object.entries(statusConfig).map(([status, config]) => ({
      status: status as Repair['status'],
      count: repairs.filter(r => r.status === status).length,
      label: config.label,
      color: config.color,
    }));
  }, [repairs]);

  return (
    <DataContext.Provider value={{
      repairs, customers, invoices,
      addRepair, updateRepair, deleteRepair,
      addCustomer, updateCustomer, deleteCustomer,
      addInvoice, updateInvoice, deleteInvoice,
      getCustomerById, getRepairById, getInvoiceById,
      getRepairsByCustomer, getInvoicesByCustomer,
      getDashboardStats, getMonthlyData, getStatusCounts,
      generateId, syncToServer, lastSync,
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = (): DataContextType => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
};
