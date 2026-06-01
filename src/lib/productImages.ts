import { supabase } from './supabase';

export interface ProductImage {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  image_url: string;
  is_primary: boolean;
  sort_order: number;
  created_at: string;
}

const BUCKET_NAME = 'product-images';

/**
 * Fetch all images for a product (not variant-specific)
 */
export async function getProductImages(productId: string): Promise<ProductImage[]> {
  const { data, error } = await supabase
    .from('product_images')
    .select('*')
    .eq('product_id', productId)
    .is('variant_id', null)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []) as ProductImage[];
}

/**
 * Fetch all images for a variant
 */
export async function getVariantImages(variantId: string): Promise<ProductImage[]> {
  const { data, error } = await supabase
    .from('product_images')
    .select('*')
    .eq('variant_id', variantId)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []) as ProductImage[];
}

/**
 * Upload an image file to Supabase Storage and create a product_images record.
 * If it's the first image for this product/variant, marks it as primary.
 */
export async function uploadProductImage(
  file: File,
  productId: string,
  variantId?: string
): Promise<ProductImage> {
  // Validate
  if (!file.type.startsWith('image/')) {
    throw new Error('File must be an image (JPG, PNG, WebP, GIF)');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image must be smaller than 5MB');
  }

  // 1. Upload to Storage
  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
  const folder = variantId ? `variants/${variantId}` : `products/${productId}`;
  const filePath = `${folder}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) throw new Error(uploadError.message);

  // 2. Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  // 3. Check if this is the first image (to auto-set primary)
  const existingQuery = variantId
    ? supabase.from('product_images').select('id').eq('variant_id', variantId)
    : supabase.from('product_images').select('id').eq('product_id', productId).is('variant_id', null);

  const { data: existing } = await existingQuery;
  const isFirst = !existing || existing.length === 0;

  // 4. Insert record
  const { data, error } = await supabase
    .from('product_images')
    .insert({
      product_id: variantId ? null : productId,
      variant_id: variantId || null,
      image_url: publicUrl,
      is_primary: isFirst,
      sort_order: (existing?.length || 0),
    })
    .select()
    .single();

  if (error) {
    // Clean up uploaded file on DB error
    await supabase.storage.from(BUCKET_NAME).remove([filePath]);
    throw new Error(error.message);
  }

  return data as ProductImage;
}

/**
 * Delete an image (from DB and Storage)
 */
export async function deleteProductImage(image: ProductImage): Promise<void> {
  // 1. Extract storage path from URL
  const url = new URL(image.image_url);
  const pathMatch = url.pathname.match(/\/object\/public\/[^/]+\/(.+)$/);
  const storagePath = pathMatch ? pathMatch[1] : null;

  // 2. Delete from DB
  const { error } = await supabase
    .from('product_images')
    .delete()
    .eq('id', image.id);

  if (error) throw new Error(error.message);

  // 3. Delete from Storage (best effort — don't fail if file already gone)
  if (storagePath) {
    await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
  }
}

/**
 * Set an image as the primary one for its product/variant.
 * Unsets all others.
 */
export async function setPrimaryImage(imageId: string): Promise<void> {
  // Get the image to know its product/variant scope
  const { data: img, error: findErr } = await supabase
    .from('product_images')
    .select('*')
    .eq('id', imageId)
    .single();

  if (findErr || !img) throw new Error(findErr?.message || 'Image not found');

  // Unset all others in same scope
  let query = supabase.from('product_images').update({ is_primary: false });
  if (img.variant_id) {
    query = query.eq('variant_id', img.variant_id);
  } else {
    query = query.eq('product_id', img.product_id).is('variant_id', null);
  }
  await query;

  // Set this one as primary
  const { error } = await supabase
    .from('product_images')
    .update({ is_primary: true })
    .eq('id', imageId);

  if (error) throw new Error(error.message);
}
