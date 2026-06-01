import { useState, useRef } from 'react';
import { logStoreVisit } from '@/lib/storeVisits';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, MapPin, FileText, Camera, Loader2, CheckCircle, X, Upload } from 'lucide-react';
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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (JPG, PNG, etc.)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5MB');
      return;
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadPhoto = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `visits/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('visit-photos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      // If bucket doesn't exist, try product-images as fallback
      if (uploadError.message?.includes('bucket') || uploadError.message?.includes('not found')) {
        const { error: fallbackError } = await supabase.storage
          .from('product-images')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          });
        if (fallbackError) throw new Error(fallbackError.message);

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);
        return publicUrl;
      }
      throw new Error(uploadError.message);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('visit-photos')
      .getPublicUrl(filePath);
    return publicUrl;
  };

  const handleSubmit = async () => {
    if (!storeId) { toast.error('Please select a store'); return; }
    if (!visitDate) { toast.error('Please select a visit date'); return; }
    if (!notes.trim()) { toast.error('Please add visit notes'); return; }

    setIsSubmitting(true);
    try {
      let uploadedPhotoUrl: string | undefined;

      // Upload photo if selected
      if (photoFile) {
        uploadedPhotoUrl = await uploadPhoto(photoFile);
      }

      await logStoreVisit({
        storeId,
        visitDate,
        notes: notes.trim(),
        photoUrl: uploadedPhotoUrl,
      });
      toast.success('Store visit logged successfully!');
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setStoreId('');
        setNotes('');
        setPhotoFile(null);
        setPhotoPreview('');
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

        {/* Photo Upload (optional) */}
        <div className="space-y-2">
          <label className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1">
            <Camera className="w-3 h-3" /> Photo (optional)
          </label>

          {photoPreview ? (
            <div className="relative">
              <img
                src={photoPreview}
                alt="Visit photo preview"
                className="w-full h-48 object-cover rounded-lg border border-white/10"
              />
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="absolute top-2 right-2 bg-[#1a0a2e] hover:bg-red-600 text-white rounded-full p-1.5 transition-colors"
                title="Remove photo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-4 py-6 bg-[#0a0514] border border-dashed border-white/20 rounded-lg text-gray-400 hover:border-[#9a02d0] hover:text-[#9a02d0] transition-colors flex flex-col items-center gap-2"
            >
              <Upload className="w-6 h-6" />
              <span className="text-sm">Click to upload a photo</span>
              <span className="text-xs text-gray-600">JPG, PNG up to 5MB</span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
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
