import React, { createContext, useContext, useCallback, useMemo } from 'react';
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
}

const DataContext = createContext<DataContextType | undefined>(undefined);

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7).toUpperCase();
}

const DEMO_CUSTOMERS: Customer[] = [
  { id: 'C001', firstName: 'John', lastName: 'Smith', phone: '555-0101', email: 'john@email.com', address: '123 Main St', city: 'New York', createdAt: '2025-01-15T10:00:00Z', notes: 'Regular customer' },
  { id: 'C002', firstName: 'Sarah', lastName: 'Johnson', phone: '555-0102', email: 'sarah@email.com', address: '456 Oak Ave', city: 'Los Angeles', createdAt: '2025-02-20T14:30:00Z', notes: '' },
  { id: 'C003', firstName: 'Mike', lastName: 'Williams', phone: '555-0103', email: 'mike@email.com', address: '789 Pine Rd', city: 'Chicago', createdAt: '2025-03-05T09:15:00Z', notes: 'Corporate client' },
  { id: 'C004', firstName: 'Emily', lastName: 'Brown', phone: '555-0104', email: 'emily@email.com', address: '321 Elm St', city: 'Houston', createdAt: '2025-04-10T16:45:00Z', notes: '' },
  { id: 'C005', firstName: 'David', lastName: 'Davis', phone: '555-0105', email: 'david@email.com', address: '654 Maple Dr', city: 'Phoenix', createdAt: '2025-05-12T11:20:00Z', notes: 'Referral from Sarah' },
  { id: 'C006', firstName: 'Lisa', lastName: 'Wilson', phone: '555-0106', email: 'lisa@email.com', address: '987 Cedar Ln', city: 'Seattle', createdAt: '2025-06-01T08:00:00Z', notes: '' },
  { id: 'C007', firstName: 'Tom', lastName: 'Anderson', phone: '555-0107', email: 'tom@email.com', address: '147 Birch St', city: 'Denver', createdAt: '2025-06-10T13:00:00Z', notes: '' },
  { id: 'C008', firstName: 'Anna', lastName: 'Taylor', phone: '555-0108', email: 'anna@email.com', address: '258 Spruce Ave', city: 'Miami', createdAt: '2025-06-15T15:30:00Z', notes: 'Student discount' },
];

const DEMO_REPAIRS: Repair[] = [
  { id: 'R001', customerId: 'C001', deviceType: 'smartphone', brand: 'Apple', model: 'iPhone 15 Pro', serialNumber: 'APL-2024-001', issue: 'Screen cracked, not responding to touch', diagnosis: 'Digitizer and LCD damaged from impact', solution: 'Replace screen assembly', status: 'completed', priority: 'high', estimatedCost: 320, finalCost: 299, partsUsed: [{ id: 'P1', name: 'iPhone 15 Pro Screen Assembly', quantity: 1, unitPrice: 199, totalPrice: 199 }], createdAt: '2025-06-01T10:00:00Z', updatedAt: '2025-06-03T14:00:00Z', completedAt: '2025-06-03T14:00:00Z', notes: 'Customer picked up' },
  { id: 'R002', customerId: 'C002', deviceType: 'laptop', brand: 'Dell', model: 'XPS 15 9530', serialNumber: 'DELL-2024-002', issue: 'Won\'t power on, no charging light', diagnosis: 'Faulty DC jack and damaged motherboard power circuit', solution: 'Replace DC jack and repair power circuit', status: 'in_progress', priority: 'urgent', estimatedCost: 450, finalCost: 0, partsUsed: [{ id: 'P2', name: 'DC Power Jack', quantity: 1, unitPrice: 45, totalPrice: 45 }], createdAt: '2025-06-10T09:30:00Z', updatedAt: '2025-06-10T09:30:00Z', completedAt: null, notes: 'Waiting for parts' },
  { id: 'R003', customerId: 'C003', deviceType: 'tablet', brand: 'Samsung', model: 'Galaxy Tab S9', serialNumber: 'SAM-2024-003', issue: 'Battery drains in 2 hours', diagnosis: 'Battery degradation at 60% capacity', solution: 'Replace battery', status: 'pending', priority: 'medium', estimatedCost: 180, finalCost: 0, partsUsed: [], createdAt: '2025-06-18T11:00:00Z', updatedAt: '2025-06-18T11:00:00Z', completedAt: null, notes: '' },
  { id: 'R004', customerId: 'C001', deviceType: 'desktop', brand: 'HP', model: 'Omen 45L', serialNumber: 'HP-2024-004', issue: 'Overheating and random shutdowns', diagnosis: 'Dust buildup, failing CPU cooler thermal paste dried', solution: 'Clean, reapply thermal paste, replace case fans', status: 'diagnosing', priority: 'high', estimatedCost: 200, finalCost: 0, partsUsed: [], createdAt: '2025-06-20T14:00:00Z', updatedAt: '2025-06-20T14:00:00Z', completedAt: null, notes: '' },
  { id: 'R005', customerId: 'C004', deviceType: 'smartphone', brand: 'Google', model: 'Pixel 8 Pro', serialNumber: 'PIX-2024-005', issue: 'Camera blurry, won\'t focus', diagnosis: 'Camera module misalignment after drop', solution: 'Replace rear camera module', status: 'waiting_parts', priority: 'medium', estimatedCost: 250, finalCost: 0, partsUsed: [], createdAt: '2025-06-22T10:30:00Z', updatedAt: '2025-06-22T10:30:00Z', completedAt: null, notes: 'Part on order' },
  { id: 'R006', customerId: 'C005', deviceType: 'tv', brand: 'LG', model: 'OLED C4 55"', serialNumber: 'LG-2024-006', issue: 'No picture, sound works', diagnosis: 'T-Con board failure', solution: 'Replace T-Con board', status: 'pending', priority: 'high', estimatedCost: 350, finalCost: 0, partsUsed: [], createdAt: '2025-06-23T09:00:00Z', updatedAt: '2025-06-23T09:00:00Z', completedAt: null, notes: 'Under warranty check' },
  { id: 'R007', customerId: 'C006', deviceType: 'console', brand: 'Sony', model: 'PS5 Slim', serialNumber: 'SONY-2024-007', issue: 'Disc drive not reading games', diagnosis: 'Laser lens dirty, possible mechanical failure', solution: 'Clean laser lens, test and replace if needed', status: 'in_progress', priority: 'low', estimatedCost: 120, finalCost: 0, partsUsed: [], createdAt: '2025-06-24T16:00:00Z', updatedAt: '2025-06-24T16:00:00Z', completedAt: null, notes: '' },
  { id: 'R008', customerId: 'C007', deviceType: 'audio', brand: 'Apple', model: 'AirPods Pro 2', serialNumber: 'APL-2024-008', issue: 'Left earbud no sound', diagnosis: 'Driver failure in left earbud', solution: 'Replace left earbud', status: 'completed', priority: 'low', estimatedCost: 89, finalCost: 89, partsUsed: [{ id: 'P3', name: 'AirPods Pro 2 Left Earbud', quantity: 1, unitPrice: 69, totalPrice: 69 }], createdAt: '2025-06-20T08:00:00Z', updatedAt: '2025-06-21T12:00:00Z', completedAt: '2025-06-21T12:00:00Z', notes: 'Customer satisfied' },
  { id: 'R009', customerId: 'C008', deviceType: 'smartphone', brand: 'OnePlus', model: '12', serialNumber: 'OP-2024-009', issue: 'Won\'t charge, loose charging port', diagnosis: 'USB-C port solder joints broken', solution: 'Resolder or replace charging port', status: 'pending', priority: 'medium', estimatedCost: 85, finalCost: 0, partsUsed: [], createdAt: '2025-06-24T13:30:00Z', updatedAt: '2025-06-24T13:30:00Z', completedAt: null, notes: '' },
  { id: 'R010', customerId: 'C002', deviceType: 'laptop', brand: 'Lenovo', model: 'ThinkPad X1 Carbon', serialNumber: 'LEN-2024-010', issue: 'Keyboard keys sticking', diagnosis: 'Liquid damage under key switches', solution: 'Replace keyboard assembly', status: 'in_progress', priority: 'medium', estimatedCost: 160, finalCost: 0, partsUsed: [], createdAt: '2025-06-24T15:00:00Z', updatedAt: '2025-06-24T15:00:00Z', completedAt: null, notes: '' },
];

const DEMO_INVOICES: Invoice[] = [
  { id: 'INV001', repairId: 'R001', customerId: 'C001', invoiceNumber: 'INV-2025-001', items: [{ id: 'I1', description: 'Screen Assembly Replacement', quantity: 1, unitPrice: 199, total: 199 }, { id: 'I2', description: 'Labor - Screen Replacement', quantity: 1, unitPrice: 80, total: 80 }, { id: 'I3', description: 'Diagnostic Fee', quantity: 1, unitPrice: 20, total: 20 }], subtotal: 299, taxRate: 8, taxAmount: 23.92, discount: 0, total: 322.92, amountPaid: 322.92, status: 'paid', issuedAt: '2025-06-03T14:00:00Z', dueAt: '2025-06-17T14:00:00Z', paidAt: '2025-06-03T15:00:00Z', notes: 'Paid in full' },
  { id: 'INV002', repairId: 'R008', customerId: 'C007', invoiceNumber: 'INV-2025-002', items: [{ id: 'I4', description: 'Left Earbud Replacement', quantity: 1, unitPrice: 69, total: 69 }, { id: 'I5', description: 'Labor', quantity: 1, unitPrice: 20, total: 20 }], subtotal: 89, taxRate: 8, taxAmount: 7.12, discount: 0, total: 96.12, amountPaid: 96.12, status: 'paid', issuedAt: '2025-06-21T12:00:00Z', dueAt: '2025-07-05T12:00:00Z', paidAt: '2025-06-21T13:00:00Z', notes: '' },
  { id: 'INV003', repairId: 'R002', customerId: 'C002', invoiceNumber: 'INV-2025-003', items: [{ id: 'I6', description: 'DC Power Jack Replacement', quantity: 1, unitPrice: 45, total: 45 }, { id: 'I7', description: 'Motherboard Power Repair', quantity: 1, unitPrice: 350, total: 350 }, { id: 'I8', description: 'Labor', quantity: 1, unitPrice: 55, total: 55 }], subtotal: 450, taxRate: 8, taxAmount: 36, discount: 0, total: 486, amountPaid: 0, status: 'draft', issuedAt: '2025-06-24T10:00:00Z', dueAt: '2025-07-08T10:00:00Z', paidAt: null, notes: 'Pending completion' },
];

function getInitialData<T>(key: string, fallback: T): T {
  try {
    const item = window.localStorage.getItem(key);
    if (item) {
      const parsed = JSON.parse(item);
      return parsed.length > 0 ? parsed : fallback;
    }
  } catch {
    // ignore
  }
  return fallback;
}

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [repairs, setRepairs] = useLocalStorage<Repair[]>('repairpro-repairs', getInitialData('repairpro-repairs', DEMO_REPAIRS));
  const [customers, setCustomers] = useLocalStorage<Customer[]>('repairpro-customers', getInitialData('repairpro-customers', DEMO_CUSTOMERS));
  const [invoices, setInvoices] = useLocalStorage<Invoice[]>('repairpro-invoices', getInitialData('repairpro-invoices', DEMO_INVOICES));

  const addRepair = useCallback((repair: Omit<Repair, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newRepair: Repair = { ...repair, id: generateId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setRepairs(prev => [newRepair, ...prev]);
  }, [setRepairs]);

  const updateRepair = useCallback((id: string, updates: Partial<Repair>) => {
    setRepairs(prev => prev.map(r => r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r));
  }, [setRepairs]);

  const deleteRepair = useCallback((id: string) => {
    setRepairs(prev => prev.filter(r => r.id !== id));
    setInvoices(prev => prev.filter(i => i.repairId !== id));
  }, [setRepairs, setInvoices]);

  const addCustomer = useCallback((customer: Omit<Customer, 'id' | 'createdAt'>) => {
    const newCustomer: Customer = { ...customer, id: generateId(), createdAt: new Date().toISOString() };
    setCustomers(prev => [newCustomer, ...prev]);
  }, [setCustomers]);

  const updateCustomer = useCallback((id: string, updates: Partial<Customer>) => {
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, [setCustomers]);

  const deleteCustomer = useCallback((id: string) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
    setRepairs(prev => prev.filter(r => r.customerId !== id));
    setInvoices(prev => prev.filter(i => i.customerId !== id));
  }, [setCustomers, setRepairs, setInvoices]);

  const addInvoice = useCallback((invoice: Omit<Invoice, 'id' | 'issuedAt'>) => {
    const newInvoice: Invoice = { ...invoice, id: generateId(), issuedAt: new Date().toISOString() };
    setInvoices(prev => [newInvoice, ...prev]);
  }, [setInvoices]);

  const updateInvoice = useCallback((id: string, updates: Partial<Invoice>) => {
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
  }, [setInvoices]);

  const deleteInvoice = useCallback((id: string) => {
    setInvoices(prev => prev.filter(i => i.id !== id));
  }, [setInvoices]);

  const getCustomerById = useCallback((id: string) => customers.find(c => c.id === id), [customers]);
  const getRepairById = useCallback((id: string) => repairs.find(r => r.id === id), [repairs]);
  const getInvoiceById = useCallback((id: string) => invoices.find(i => i.id === id), [invoices]);
  const getRepairsByCustomer = useCallback((customerId: string) => repairs.filter(r => r.customerId === customerId), [repairs]);
  const getInvoicesByCustomer = useCallback((customerId: string) => invoices.filter(i => i.customerId === customerId), [invoices]);

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
      const monthRepairs = repairs.filter(r => { const rd = new Date(r.createdAt); return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth(); });
      const monthInvoices = invoices.filter(inv => { const id = new Date(inv.issuedAt); return id.getFullYear() === d.getFullYear() && id.getMonth() === d.getMonth() && inv.status === 'paid'; });
      months.push({ month: monthStr, revenue: monthInvoices.reduce((s, inv) => s + inv.total, 0), repairs: monthRepairs.length, completed: monthRepairs.filter(r => r.status === 'completed' || r.status === 'delivered').length });
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
    return Object.entries(statusConfig).map(([status, config]) => ({ status: status as Repair['status'], count: repairs.filter(r => r.status === status).length, label: config.label, color: config.color }));
  }, [repairs]);

  const value = useMemo(() => ({
    repairs, customers, invoices,
    addRepair, updateRepair, deleteRepair,
    addCustomer, updateCustomer, deleteCustomer,
    addInvoice, updateInvoice, deleteInvoice,
    getCustomerById, getRepairById, getInvoiceById,
    getRepairsByCustomer, getInvoicesByCustomer,
    getDashboardStats, getMonthlyData, getStatusCounts,
    generateId,
  }), [repairs, customers, invoices, addRepair, updateRepair, deleteRepair, addCustomer, updateCustomer, deleteCustomer, addInvoice, updateInvoice, deleteInvoice, getCustomerById, getRepairById, getInvoiceById, getRepairsByCustomer, getInvoicesByCustomer, getDashboardStats, getMonthlyData, getStatusCounts]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = (): DataContextType => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
};
