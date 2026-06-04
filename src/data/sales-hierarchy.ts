import type { SalesManager, SalesRep, Wholesaler, Distributor, Assignment } from '@/types/sales-hierarchy';

// Sales Managers
export const salesManagers: SalesManager[] = [
  {
    id: 'sm-001',
    name: 'Alex Thompson',
    email: 'alex.thompson@microdos2u.com',
    region: 'West Coast',
    salesRepIds: ['sr-001', 'sr-002', 'sr-003'],
  },
  {
    id: 'sm-002',
    name: 'Maria Garcia',
    email: 'maria.garcia@microdos2u.com',
    region: 'East Coast',
    salesRepIds: ['sr-004', 'sr-005'],
  },
];

// Sales Reps
export const salesReps: SalesRep[] = [
  {
    id: 'sr-001',
    name: 'John Doe',
    email: 'john.doe@microdos2u.com',
    managerId: 'sm-001',
    assignedWholesalerIds: ['who-001', 'who-002', 'who-003'],
    assignedDistributorIds: ['dist-001'],
  },
  {
    id: 'sr-002',
    name: 'Jane Smith',
    email: 'jane.smith@microdos2u.com',
    managerId: 'sm-001',
    assignedWholesalerIds: ['who-004', 'who-005'],
    assignedDistributorIds: ['dist-002'],
  },
  {
    id: 'sr-003',
    name: 'Mike Johnson',
    email: 'mike.johnson@microdos2u.com',
    managerId: 'sm-001',
    assignedWholesalerIds: ['who-006'],
    assignedDistributorIds: [],
  },
  {
    id: 'sr-004',
    name: 'Sarah Williams',
    email: 'sarah.williams@microdos2u.com',
    managerId: 'sm-002',
    assignedWholesalerIds: ['who-007', 'who-008'],
    assignedDistributorIds: ['dist-003'],
  },
  {
    id: 'sr-005',
    name: 'David Brown',
    email: 'david.brown@microdos2u.com',
    managerId: 'sm-002',
    assignedWholesalerIds: ['who-009'],
    assignedDistributorIds: [],
  },
];

// Wholesalers
export const wholesalers: Wholesaler[] = [
  {
    id: 'who-001',
    businessName: 'Psychedelic Wellness Center',
    contactName: 'Robert Chen',
    email: 'robert@wellnesscenter.com',
    phone: '(555) 123-4567',
    address: '123 Main St',
    city: 'Los Angeles',
    state: 'CA',
    zip: '90001',
    licenseNumber: 'CA-PSY-001',
    ein: '12-3456789',
    status: 'approved',
    appliedAt: '2026-01-15T10:30:00Z',
    assignedSalesRepIds: ['sr-001'],
  },
  {
    id: 'who-002',
    businessName: 'Mindful Journeys',
    contactName: 'Lisa Park',
    email: 'lisa@mindfuljourneys.com',
    phone: '(555) 234-5678',
    address: '456 Oak Ave',
    city: 'San Francisco',
    state: 'CA',
    zip: '94102',
    licenseNumber: 'CA-PSY-002',
    ein: '23-4567890',
    status: 'approved',
    appliedAt: '2026-02-01T14:20:00Z',
    assignedSalesRepIds: ['sr-001'],
  },
  {
    id: 'who-003',
    businessName: 'Conscious Collective',
    contactName: 'Marcus Johnson',
    email: 'marcus@consciouscollective.com',
    phone: '(555) 345-6789',
    address: '789 Pine St',
    city: 'Portland',
    state: 'OR',
    zip: '97201',
    licenseNumber: 'OR-PSY-001',
    ein: '34-5678901',
    status: 'pending',
    appliedAt: '2026-04-10T09:15:00Z',
    assignedSalesRepIds: ['sr-001'],
  },
  {
    id: 'who-004',
    businessName: 'Enlightenment Emporium',
    contactName: 'Amanda White',
    email: 'amanda@enlightenment.com',
    phone: '(555) 456-7890',
    address: '321 Elm St',
    city: 'Seattle',
    state: 'WA',
    zip: '98101',
    licenseNumber: 'WA-PSY-001',
    ein: '45-6789012',
    status: 'approved',
    appliedAt: '2026-01-20T11:45:00Z',
    assignedSalesRepIds: ['sr-002'],
  },
  {
    id: 'who-005',
    businessName: 'Spiritual Solutions',
    contactName: 'Kevin Martinez',
    email: 'kevin@spiritualsolutions.com',
    phone: '(555) 567-8901',
    address: '654 Maple Dr',
    city: 'San Diego',
    state: 'CA',
    zip: '92101',
    licenseNumber: 'CA-PSY-003',
    ein: '56-7890123',
    status: 'approved',
    appliedAt: '2026-03-05T16:30:00Z',
    assignedSalesRepIds: ['sr-002'],
  },
  {
    id: 'who-006',
    businessName: 'Higher Consciousness',
    contactName: 'Rachel Green',
    email: 'rachel@higherconsciousness.com',
    phone: '(555) 678-9012',
    address: '987 Cedar Ln',
    city: 'Las Vegas',
    state: 'NV',
    zip: '89101',
    licenseNumber: 'NV-PSY-001',
    ein: '67-8901234',
    status: 'pending',
    appliedAt: '2026-04-12T13:00:00Z',
    assignedSalesRepIds: ['sr-003'],
  },
  {
    id: 'who-007',
    businessName: 'Inner Vision Shop',
    contactName: 'Thomas Anderson',
    email: 'thomas@innervision.com',
    phone: '(555) 789-0123',
    address: '147 Broadway',
    city: 'New York',
    state: 'NY',
    zip: '10001',
    licenseNumber: 'NY-PSY-001',
    ein: '78-9012345',
    status: 'approved',
    appliedAt: '2026-02-15T10:00:00Z',
    assignedSalesRepIds: ['sr-004'],
  },
  {
    id: 'who-008',
    businessName: 'Mystic Moments',
    contactName: 'Jennifer Lee',
    email: 'jennifer@mysticmoments.com',
    phone: '(555) 890-1234',
    address: '258 5th Ave',
    city: 'Brooklyn',
    state: 'NY',
    zip: '11201',
    licenseNumber: 'NY-PSY-002',
    ein: '89-0123456',
    status: 'approved',
    appliedAt: '2026-03-20T15:45:00Z',
    assignedSalesRepIds: ['sr-004'],
  },
  {
    id: 'who-009',
    businessName: 'Transcendence Trading',
    contactName: 'Michael Scott',
    email: 'michael@transcendence.com',
    phone: '(555) 901-2345',
    address: '369 Market St',
    city: 'Philadelphia',
    state: 'PA',
    zip: '19101',
    licenseNumber: 'PA-PSY-001',
    ein: '90-1234567',
    status: 'pending',
    appliedAt: '2026-04-14T08:30:00Z',
    assignedSalesRepIds: ['sr-005'],
  },
];

// Distributors
export const distributors: Distributor[] = [
  {
    id: 'dist-001',
    businessName: 'West Coast Distribution',
    contactName: 'James Wilson',
    email: 'james@westcoastdist.com',
    phone: '(555) 111-2222',
    address: '1000 Commerce Blvd',
    city: 'Los Angeles',
    state: 'CA',
    zip: '90015',
    licenseNumber: 'CA-DIST-001',
    ein: '11-1111111',
    status: 'approved',
    appliedAt: '2025-12-01T09:00:00Z',
    assignedSalesRepIds: ['sr-001'],
  },
  {
    id: 'dist-002',
    businessName: 'Pacific Northwest Supply',
    contactName: 'Emily Davis',
    email: 'emily@pnwsupply.com',
    phone: '(555) 222-3333',
    address: '2000 Industrial Way',
    city: 'Seattle',
    state: 'WA',
    zip: '98108',
    licenseNumber: 'WA-DIST-001',
    ein: '22-2222222',
    status: 'approved',
    appliedAt: '2026-01-10T14:00:00Z',
    assignedSalesRepIds: ['sr-002'],
  },
  {
    id: 'dist-003',
    businessName: 'East Coast Wholesalers',
    contactName: 'Christopher Taylor',
    email: 'chris@eastcoastwholesale.com',
    phone: '(555) 333-4444',
    address: '3000 Distribution Center Dr',
    city: 'Newark',
    state: 'NJ',
    zip: '07101',
    licenseNumber: 'NJ-DIST-001',
    ein: '33-3333333',
    status: 'approved',
    appliedAt: '2026-02-20T11:30:00Z',
    assignedSalesRepIds: ['sr-004'],
  },
];

// Assignments
export const assignments: Assignment[] = [
  { id: 'asgn-001', salesRepId: 'sr-001', accountId: 'who-001', accountType: 'wholesaler', assignedAt: '2026-01-20T10:00:00Z', assignedBy: 'sm-001', isPrimary: true },
  { id: 'asgn-002', salesRepId: 'sr-001', accountId: 'who-002', accountType: 'wholesaler', assignedAt: '2026-02-05T14:00:00Z', assignedBy: 'sm-001', isPrimary: true },
  { id: 'asgn-003', salesRepId: 'sr-001', accountId: 'who-003', accountType: 'wholesaler', assignedAt: '2026-04-11T09:00:00Z', assignedBy: 'sm-001', isPrimary: true },
  { id: 'asgn-004', salesRepId: 'sr-001', accountId: 'dist-001', accountType: 'distributor', assignedAt: '2025-12-15T10:00:00Z', assignedBy: 'sm-001', isPrimary: true },
  { id: 'asgn-005', salesRepId: 'sr-002', accountId: 'who-004', accountType: 'wholesaler', assignedAt: '2026-01-25T11:00:00Z', assignedBy: 'sm-001', isPrimary: true },
  { id: 'asgn-006', salesRepId: 'sr-002', accountId: 'who-005', accountType: 'wholesaler', assignedAt: '2026-03-10T16:00:00Z', assignedBy: 'sm-001', isPrimary: true },
  { id: 'asgn-007', salesRepId: 'sr-002', accountId: 'dist-002', accountType: 'distributor', assignedAt: '2026-01-15T14:00:00Z', assignedBy: 'sm-001', isPrimary: true },
  { id: 'asgn-008', salesRepId: 'sr-003', accountId: 'who-006', accountType: 'wholesaler', assignedAt: '2026-04-13T13:00:00Z', assignedBy: 'sm-001', isPrimary: true },
  { id: 'asgn-009', salesRepId: 'sr-004', accountId: 'who-007', accountType: 'wholesaler', assignedAt: '2026-02-20T10:00:00Z', assignedBy: 'sm-002', isPrimary: true },
  { id: 'asgn-010', salesRepId: 'sr-004', accountId: 'who-008', accountType: 'wholesaler', assignedAt: '2026-03-25T16:00:00Z', assignedBy: 'sm-002', isPrimary: true },
  { id: 'asgn-011', salesRepId: 'sr-004', accountId: 'dist-003', accountType: 'distributor', assignedAt: '2026-03-01T11:30:00Z', assignedBy: 'sm-002', isPrimary: true },
  { id: 'asgn-012', salesRepId: 'sr-005', accountId: 'who-009', accountType: 'wholesaler', assignedAt: '2026-04-15T09:00:00Z', assignedBy: 'sm-002', isPrimary: true },
];

// Helper functions
export function getSalesRepById(id: string): SalesRep | undefined {
  return salesReps.find(sr => sr.id === id);
}

export function getSalesManagerById(id: string): SalesManager | undefined {
  return salesManagers.find(sm => sm.id === id);
}

export function getWholesalerById(id: string): Wholesaler | undefined {
  return wholesalers.find(w => w.id === id);
}

export function getDistributorById(id: string): Distributor | undefined {
  return distributors.find(d => d.id === id);
}

export function getSalesRepsByManager(managerId: string): SalesRep[] {
  return salesReps.filter(sr => sr.managerId === managerId);
}

export function getAssignedWholesalers(salesRepId: string): Wholesaler[] {
  const rep = getSalesRepById(salesRepId);
  if (!rep) return [];
  return wholesalers.filter(w => rep.assignedWholesalerIds.includes(w.id));
}

export function getAssignedDistributors(salesRepId: string): Distributor[] {
  const rep = getSalesRepById(salesRepId);
  if (!rep) return [];
  return distributors.filter(d => rep.assignedDistributorIds.includes(d.id));
}

export function getUnassignedWholesalers(): Wholesaler[] {
  return wholesalers.filter(w => w.assignedSalesRepIds.length === 0);
}

export function getUnassignedDistributors(): Distributor[] {
  return distributors.filter(d => d.assignedSalesRepIds.length === 0);
}

export function getAllAccounts(): (Wholesaler | Distributor)[] {
  return [...wholesalers, ...distributors];
}

export function getPendingApplications(): (Wholesaler | Distributor)[] {
  return getAllAccounts().filter(a => a.status === 'pending');
}

export function getApprovedAccounts(): (Wholesaler | Distributor)[] {
  return getAllAccounts().filter(a => a.status === 'approved');
}

export function getAccountStats() {
  const all = getAllAccounts();
  return {
    total: all.length,
    pending: all.filter(a => a.status === 'pending').length,
    approved: all.filter(a => a.status === 'approved').length,
    rejected: all.filter(a => a.status === 'rejected').length,
    totalWholesalers: wholesalers.length,
    totalDistributors: distributors.length,
    unassignedWholesalers: getUnassignedWholesalers().length,
    unassignedDistributors: getUnassignedDistributors().length,
  };
}
