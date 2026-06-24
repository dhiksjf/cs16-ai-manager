// ─── Repair Types ───

export type RepairStatus = 'pending' | 'diagnosing' | 'in_progress' | 'waiting_parts' | 'completed' | 'delivered' | 'cancelled';
export type RepairPriority = 'low' | 'medium' | 'high' | 'urgent';
export type DeviceType = 'smartphone' | 'tablet' | 'laptop' | 'desktop' | 'tv' | 'console' | 'audio' | 'other';

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  createdAt: string;
  notes: string;
}

export interface Repair {
  id: string;
  customerId: string;
  customer?: Customer;
  deviceType: DeviceType;
  brand: string;
  model: string;
  serialNumber: string;
  issue: string;
  diagnosis: string;
  solution: string;
  status: RepairStatus;
  priority: RepairPriority;
  estimatedCost: number;
  finalCost: number;
  partsUsed: Part[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  notes: string;
}

export interface Part {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Invoice {
  id: string;
  repairId: string;
  repair?: Repair;
  customerId: string;
  customer?: Customer;
  invoiceNumber: string;
  items: InvoiceItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  amountPaid: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  issuedAt: string;
  dueAt: string;
  paidAt: string | null;
  notes: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface DashboardStats {
  totalRepairs: number;
  pendingRepairs: number;
  completedRepairs: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalCustomers: number;
  newCustomersThisMonth: number;
  avgRepairTime: number;
}

export interface MonthlyData {
  month: string;
  revenue: number;
  repairs: number;
  completed: number;
}

export interface StatusCount {
  status: RepairStatus;
  count: number;
  label: string;
  color: string;
}

export type Language = 'en' | 'fr';
export type ThemeMode = 'light' | 'dark';
