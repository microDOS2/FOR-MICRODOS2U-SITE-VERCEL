import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  X,
  Star,
  Loader2,
  ImagePlus,
} from 'lucide-react';
import { toast } from 'sonner';

export interface ProductImage {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  image_url: string;
  is_primary: boolean;
  sort_order: number;
  created_at: string;
}

interface ProductImageUploaderProps {
  /** Product ID — required at product level, null at variant level */
  productId?: string | null;
  /** Variant ID — required at variant level, null at product level */
  variantId?: string | null;
  /** Max images allowed (default 5) */
  maxImages?: number;
  /** Called after any mutation (upload/delete/set-primary) */
  onChange?: () => void;
}

export function ProductImageUploader({
  productId,
  variantId,
  maxImages = 5,
  onChange,
}: ProductImageUploaderProps) {
  const [images, setImages] = useState<ProductImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scopeId = variantId || productId;
  const isVariant = !!variantId;

  // Fetch images on mount or when scope changes
  const fetchImages = useCallback(async () => {
    if (!scopeId) return;
    try {
      let query = supabase
        .from('product_images')
        .select('*')
        .order('sort_order', { ascending: true });

      if (isVariant) {
        query = query.eq('variant_id', variantId);
      } else {
        query = query.eq('product_id', productId).is('variant_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      setImages((data || []) as ProductImage[]);
    } catch (err: any) {
      toast.error('Failed to load images: ' + err.message);
    }
  }, [scopeId, isVariant, variantId, productId]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = maxImages - images.length;
    if (remainingSlots <= 0) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    setUploading(true);

    let successCount = 0;
    for (const file of filesToUpload) {
      // Validate
      if (!file.type.startsWith('image/')) {
        toast.error(`Skipped "${file.name}" — not an image`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`Skipped "${file.name}" — exceeds 5MB`);
        continue;
      }

      try {
        const fileExt = file.name.split('.').pop() || 'jpg';
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
        const folder = isVariant
          ? `variants/${variantId}`
          : `products/${productId}`;
        const filePath = `${folder}/${fileName}`;

        // Upload to Storage
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type,
          });

        if (uploadError) throw new Error(uploadError.message);

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);

        // Insert DB record
        const { error: dbError } = await supabase
          .from('product_images')
          .insert({
            product_id: isVariant ? null : productId,
            variant_id: isVariant ? variantId : null,
            image_url: urlData.publicUrl,
            is_primary: images.length + successCount === 0,
            sort_order: images.length + successCount,
          });

        if (dbError) {
          // Clean up storage on DB error
          await supabase.storage.from('product-images').remove([filePath]);
          throw new Error(dbError.message);
        }

        successCount++;
      } catch (err: any) {
        toast.error(`Failed to upload "${file.name}": ${err.message}`);
      }
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (successCount > 0) {
      toast.success(`${successCount} image${successCount > 1 ? 's' : ''} uploaded`);
      await fetchImages();
      onChange?.();
    }
  };

  const handleDelete = async (image: ProductImage) => {
    if (!confirm('Delete this image?')) return;

    try {
      // Call edge function to delete (bypasses RLS)
      const resp = await fetch(
        'https://fildaxejimuvfrcqmoba.supabase.co/functions/v1/delete-product-image',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`,
          },
          body: JSON.stringify({ image_id: image.id, image_url: image.image_url }),
        }
      );

      const result = await resp.json();
      if (!resp.ok) {
        console.error('[delete image] HTTP error:', resp.status, result);
        throw new Error(result.error || `HTTP ${resp.status}`);
      }

      toast.success('Image deleted');
      await fetchImages();
      onChange?.();
    } catch (err: any) {
      console.error('[delete image] Error:', err);
      toast.error('Failed to delete: ' + err.message);
    }
  };

  const handleSetPrimary = async (imageId: string) => {
    try {
      // Get image to know scope
      const { data: img, error: findErr } = await supabase
        .from('product_images')
        .select('*')
        .eq('id', imageId)
        .single();

      if (findErr || !img) throw new Error(findErr?.message || 'Image not found');

      // Unset all others in same scope
      let unsetQuery = supabase
        .from('product_images')
        .update({ is_primary: false });

      if (img.variant_id) {
        unsetQuery = unsetQuery.eq('variant_id', img.variant_id);
      } else {
        unsetQuery = unsetQuery
          .eq('product_id', img.product_id)
          .is('variant_id', null);
      }
      await unsetQuery;

      // Set this one
      const { error } = await supabase
        .from('product_images')
        .update({ is_primary: true })
        .eq('id', imageId);

      if (error) throw new Error(error.message);

      toast.success('Primary image set');
      await fetchImages();
      onChange?.();
    } catch (err: any) {
      toast.error('Failed to set primary: ' + err.message);
    }
  };

  const canAddMore = images.length < maxImages;

  if (!scopeId) {
    return (
      <div className="text-center py-6 text-gray-500 text-sm">
        Save the product first to manage images.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {images.map((img) => (
            <div
              key={img.id}
              className={`relative aspect-square rounded-lg border-2 overflow-hidden group ${
                img.is_primary
                  ? 'border-[#44f80c] shadow-[0_0_8px_rgba(68,248,12,0.3)]'
                  : 'border-white/10'
              }`}
            >
              <img
                src={img.image_url}
                alt="Product"
                className="w-full h-full object-cover"
                loading="lazy"
              />

              {/* Overlay actions */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                {/* Set Primary */}
                {!img.is_primary && (
                  <button
                    onClick={() => handleSetPrimary(img.id)}
                    title="Set as primary image"
                    className="p-1.5 bg-[#9a02d0] hover:bg-[#7a01a8] rounded-md text-white transition-colors"
                  >
                    <Star className="w-3.5 h-3.5" />
                  </button>
                )}
                {/* Delete */}
                <button
                  onClick={() => handleDelete(img)}
                  title="Delete image"
                  className="p-1.5 bg-red-600 hover:bg-red-700 rounded-md text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Primary badge */}
              {img.is_primary && (
                <div className="absolute top-1 left-1 bg-[#44f80c] text-[#0a0514] text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                  <Star className="w-2.5 h-2.5 fill-current" /> PRIMARY
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Area */}
      {canAddMore && (
        <div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full flex flex-col items-center gap-2 px-4 py-5 bg-[#0a0514] border border-dashed border-white/20 rounded-lg text-gray-400 hover:border-[#9a02d0] hover:text-[#9a02d0] transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Uploading...</span>
              </>
            ) : (
              <>
                <ImagePlus className="w-5 h-5" />
                <span className="text-sm">
                  Click to upload images
                </span>
                <span className="text-xs text-gray-600">
                  JPG, PNG, WebP, GIF up to 5MB each
                </span>
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />
        </div>
      )}

      {/* Count indicator */}
      <p className="text-xs text-gray-500 text-center">
        {images.length} / {maxImages} images
        {images.length >= maxImages && (
          <span className="text-yellow-500 ml-1">(maximum reached)</span>
        )}
      </p>
    </div>
  );
}
