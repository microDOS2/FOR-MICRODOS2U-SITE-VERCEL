import { useState, useEffect } from 'react';
import type { StoreVisit } from '@/lib/storeVisits';
import { getStoreVisits, getMyStoreVisits, getTeamVisits } from '@/lib/storeVisits';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Calendar, User, Loader2, FileText, Camera } from 'lucide-react';
import { format } from 'date-fns';

interface VisitHistoryProps {
  storeId?: string;
  repId?: string;
  managerId?: string;
  mode: 'mine' | 'store' | 'team';
}

export function VisitHistory({ storeId, repId, managerId, mode }: VisitHistoryProps) {
  const [visits, setVisits] = useState<StoreVisit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        let data: StoreVisit[] = [];
        if (mode === 'mine') {
          data = await getMyStoreVisits();
        } else if (mode === 'store' && storeId) {
          data = await getStoreVisits(storeId);
        } else if (mode === 'team' && managerId) {
          data = await getTeamVisits(managerId);
        }
        setVisits(data);
      } catch (err: any) {
        console.error('Error fetching visits:', err);
      }
      setLoading(false);
    };
    fetch();
  }, [storeId, repId, managerId, mode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-[#9a02d0]" />
      </div>
    );
  }

  if (visits.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400">
          {mode === 'mine' ? 'No visits logged yet' : mode === 'team' ? 'No team visits yet' : 'No visits for this store'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-white font-semibold flex items-center gap-2">
        <FileText className="w-4 h-4 text-[#9a02d0]" />
        {mode === 'mine' ? 'My Visit History' : mode === 'team' ? 'Team Visit History' : 'Store Visit History'}
        <span className="text-sm text-gray-500">({visits.length})</span>
      </h3>

      {visits.map((visit) => (
        <Card key={visit.id} className="bg-[#0a0514] border-white/10">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#9a02d0]/20 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-[#9a02d0]" />
                </div>
                <div>
                  <p className="text-white font-medium text-sm">
                    {visit.store?.name || 'Unknown Store'}
                  </p>
                  <p className="text-gray-500 text-xs">
                    {visit.store?.city}, {visit.store?.state}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-gray-400 text-xs">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(visit.visit_date), 'MMM d, yyyy')}
                </div>
                {mode === 'team' && visit.rep?.contact_name && (
                  <div className="flex items-center gap-1 text-gray-500 text-xs mt-1">
                    <User className="w-3 h-3" />
                    {visit.rep.contact_name}
                  </div>
                )}
              </div>
            </div>

            {visit.notes && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <p className="text-gray-300 text-sm whitespace-pre-wrap">{visit.notes}</p>
              </div>
            )}

            {visit.photo_url && (
              <div className="mt-3">
                <a href={visit.photo_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#9a02d0] hover:text-[#ff66c4] flex items-center gap-1">
                  <Camera className="w-3 h-3" /> View Photo
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
