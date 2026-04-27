import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fildaxejimuvfrcqmoba.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpbGRheGVqaW11dmZyY3Ftb2JhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDg2OTUsImV4cCI6MjA5MTY4NDY5NX0.Pe3HHtbo1_OiUTSgnq0qGSgzkkcTxRJ01kfOxsv2Gig';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = 'admin' | 'sales_manager' | 'sales_rep' | 'wholesaler' | 'distributor' | 'influencer' | 'shipping_fulfillment';

export interface Application {
  id: string;
  auth_user_id: string | null;
  business_name: string;
  contact_name: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  license_number: string | null;
  ein: string | null;
  website: string | null;
  account_type: 'wholesaler' | 'distributor';
  business_type: string | null;
  volume_estimate: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'more_info_needed';
  admin_notes: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export interface Store {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  email: string | null;
  stock: string | null;
  is_active: boolean;
  created_at: string;
}

export interface DBUser {
  id: string;
  email: string;
  business_name: string | null;
  license_number: string | null;
  ein: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  status: 'pending' | 'approved' | 'rejected';
  role: UserRole;
  manager_id: string | null;
  volume_estimate: string | null;
  referral_code: string | null;
  qr_url: string | null;
  total_referral_sales: number;
  referral_count: number;
  plain_password: string | null;
  created_at: string;
  updated_at: string;
}

export interface RepAccountAssignment {
  id: string;
  rep_id: string;
  account_id: string;
  assigned_by: string | null;
  assigned_at: string;
  is_primary: boolean;
}

export interface Order {
  id: string;
  po_number: string;
  user_id: string | null;
  items: number;
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  notes: string | null;
  referral_code: string | null;
  influencer_id: string | null;
  created_at: string;
  shipped_date: string | null;
  delivered_date: string | null;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  order_id: string | null;
  user_id: string | null;
  amount: number;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  date: string;
  due_date: string;
  paid_date: string | null;
  pdf_url: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
}

export interface Agreement {
  id: string;
  template_id: string | null;
  user_id: string | null;
  title: string;
  type: string;
  version: string;
  document_url: string | null;
  status: 'pending' | 'sent' | 'signed' | 'active' | 'expired';
  sent_date: string;
  signed_date: string | null;
  expires_date: string | null;
  signed_by: string | null;
  signature_request_id: string | null;
  created_at: string;
}

export interface WholesalerStoreLocation {
  id: string;
  user_id: string;
  name: string | null;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  stock: string | null;
  license_number: string | null;
  is_primary: boolean;
  is_active: boolean;
  source: string | null;
  created_at: string;
  updated_at: string;
}
