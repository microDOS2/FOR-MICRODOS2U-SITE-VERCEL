import { useState } from 'react';
import { logStoreVisit } from '@/lib/storeVisits';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, MapPin, FileText, Camera, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Store {
  id: string;
  name: string;
  city: string;
  state: string;
  address: string;
}

interface StoreVisitFormProps {
  stores: Store[];
  onSuccess?: () => void;
}

export function StoreVisitForm({ stores, onSuccess }: StoreVisitFormProps) {
  const [storeId, setStoreId] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!storeId) { toast.error('Please select a store'); return; }
    if (!visitDate) { toast.error('Please select a visit date'); return; }
    if (!notes.trim()) { toast.error('Please add visit notes'); return; }

    setIsSubmitting(true);
    try {
      await logStoreVisit({
        storeId,
        visitDate,
        notes: notes.trim(),
        photoUrl: photoUrl || undefined,
      });
      toast.success('Store visit logged successfully!');
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setStoreId('');
        setNotes('');
        setPhotoUrl('');
        setVisitDate(new Date().toISOString().split('T')[0]);
        onSuccess?.();
      }, 2000);
    } catch (err: any) {
      toast.error(err.message || 'Failed to log visit');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Card className="bg-brand-800 border-brand-700">
        <CardContent className="p-8 text-center">
          <CheckCircle className="w-16 h-16 text-[#44f80c] mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Visit Logged!</h3>
          <p className="text-gray-400">Your store visit has been recorded successfully.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-brand-800 border-brand-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <MapPin className="w-5 h-5 text-[#9a02d0]" />
          Log Store Visit
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Store Selection */}
        <div className="space-y-1">
          <label className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Store Location
          </label>
          <select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="w-full px-4 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#9a02d0] text-sm"
          >
            <option value="">Select a store...</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name} — {store.city}, {store.state}
              </option>
            ))}
          </select>
          {stores.length === 0 && (
            <p className="text-xs text-yellow-500 mt-1">No stores assigned. Contact your manager.</p>
          )}
        </div>

        {/* Visit Date */}
        <div className="space-y-1">
          <label className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Visit Date
          </label>
          <input
            type="date"
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
            className="w-full px-4 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#9a02d0] text-sm"
          />
        </div>

        {/* Notes */}
        <div className="space-y-1">
          <label className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1">
            <FileText className="w-3 h-3" /> Visit Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What did you discuss? Any issues? Follow-ups needed?"
            rows={4}
            className="w-full px-4 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:border-[#9a02d0] text-sm resize-none"
          />
        </div>

        {/* Photo URL (optional) */}
        <div className="space-y-1">
          <label className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1">
            <Camera className="w-3 h-3" /> Photo URL (optional)
          </label>
          <input
            type="url"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="https://example.com/photo.jpg"
            className="w-full px-4 py-2.5 bg-[#0a0514] border border-white/10 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:border-[#9a02d0] text-sm"
          />
          <p className="text-xs text-gray-600">Paste a link to a photo of the store visit</p>
        </div>

        {/* Submit */}
        <Button
          className="w-full bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white hover:opacity-90 font-semibold"
          onClick={handleSubmit}
          disabled={isSubmitting || !storeId || !notes.trim()}
        >
          {isSubmitting ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Logging...</>
          ) : (
            <><MapPin className="w-4 h-4 mr-2" /> Log Visit</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
