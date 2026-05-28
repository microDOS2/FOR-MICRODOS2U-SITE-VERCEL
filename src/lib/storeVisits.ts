import { supabase } from './supabase';

export interface StoreVisit {
  id: string;
  rep_id: string;
  store_id: string;
  visit_date: string;
  notes: string | null;
  photo_url: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  store?: {
    name: string;
    city: string;
    state: string;
  };
  rep?: {
    contact_name: string;
  };
}

export async function logStoreVisit(params: {
  storeId: string;
  visitDate: string;
  notes: string;
  photoUrl?: string;
  lat?: number;
  lng?: number;
}) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not authenticated');

  const { error } = await supabase.rpc('log_store_visit', {
    p_rep_id: userData.user.id,
    p_store_id: params.storeId,
    p_visit_date: params.visitDate,
    p_notes: params.notes || null,
    p_photo_url: params.photoUrl || null,
    p_lat: params.lat || null,
    p_lng: params.lng || null,
  });

  if (error) throw new Error(error.message);
  return true;
}

export async function getStoreVisits(storeId?: string, repId?: string) {
  let query = supabase
    .from('store_visits')
    .select(`
      *,
      store:wholesaler_store_locations(name, city, state),
      rep:users(contact_name)
    `)
    .order('visit_date', { ascending: false });

  if (storeId) query = query.eq('store_id', storeId);
  if (repId) query = query.eq('rep_id', repId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as StoreVisit[];
}

export async function getMyStoreVisits() {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not authenticated');
  return getStoreVisits(undefined, userData.user.id);
}

export async function getTeamVisits(managerId: string) {
  // Get all reps under this manager
  const { data: reps } = await supabase
    .from('users')
    .select('id')
    .eq('manager_id', managerId)
    .eq('role', 'sales_rep');

  if (!reps || reps.length === 0) return [];

  const repIds = reps.map((r: any) => r.id);

  const { data, error } = await supabase
    .from('store_visits')
    .select(`
      *,
      store:wholesaler_store_locations(name, city, state),
      rep:users(contact_name)
    `)
    .in('rep_id', repIds)
    .order('visit_date', { ascending: false });

  if (error) throw new Error(error.message);
  return data as StoreVisit[];
}
