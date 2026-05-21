// Sales Hierarchy Types

export interface SalesManager {
  id: string;
  name: string;
  email: string;
  region: string;
  salesRepIds: string[];
}

export interface SalesRep {
  id: string;
  name: string;
  email: string;
  managerId: string;
  assignedWholesalerIds: string[];
  assignedDistributorIds: string[];
}

export interface Assignment {
  id: string;
  salesRepId: string;
  accountId: string;
  accountType: 'wholesaler' | 'distributor';
  assignedAt: string;
  assignedBy: string;
  isPrimary: boolean;
}

export interface Wholesaler {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  licenseNumber: string;
  ein: string;
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: string;
  assignedSalesRepIds: string[];
}

export interface Distributor {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  licenseNumber: string;
  ein: string;
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: string;
  assignedSalesRepIds: string[];
}


