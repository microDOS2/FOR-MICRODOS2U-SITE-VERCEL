import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProductAccordion } from '@/components/products/ProductAccordion';
import { ProductTable } from '@/components/products/ProductTable';
import { StarterKitCard } from '@/components/products/StarterKitCard';
import { ViewToggle } from '@/components/products/ViewToggle';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { CartButton } from '@/components/cart/CartButton';
import { Input } from '@/components/ui/input';
import { Search, Package, Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import type { UserRole, Product, WholesalerStarterKit } from '@/types/products';

// ------------------------------------------------------------------
// Image types returned by the get_products_with_variants() RPC
// ------------------------------------------------------------------
export interface DBProductImage {
  id: string;
  image_url: string;
  is_primary: boolean;
  sort_order: number;
}

interface DBProduct {
  id: string;
  name: string;
  sku: string;
  description: string;
  price: number;
  retail_price: number | null;
  stock: number;
  min_order: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  images?: DBProductImage[] | null;
}

interface DBVariant {
  id: string;
  product_id: string;
  tier: string;
  name: string;
  quantity: number;
  total_pills: number;
  sku: string;
  msrp_price: number;
  wholesaler_price: number;
  distributor_price: number;
  in_stock: boolean;
  images?: DBProductImage[] | null;
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function getFallbackRole(role: UserRole | undefined): UserRole {
  return role || 'wholesaler';
}

/**
 * Return the primary image URL from an images array.
 * Falls back to the first image (sorted by sort_order) if no primary is set.
 */
function getPrimaryImageUrl(
  images: DBProductImage[] | null | undefined
): string | null {
  console.log('[DEBUG getPrimaryImageUrl] images count:', images?.length || 0, 'first:', images?.[0]?.image_url?.slice(0, 50));
  if (!images || images.length === 0) return null;
  const primary = images.find((img) => img.is_primary);
  if (primary) return primary.image_url;
  const sorted = [...images].sort(
    (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
  );
  return sorted[0]?.image_url || null;
}

/**
 * Get product initials for the placeholder fallback.
 * e.g. "microDOS(2) Extra Strength" -> "MDE"
 */
export function getProductInitials(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9\s]/g, '');
  return cleaned
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

// ------------------------------------------------------------------
// Product Image Thumbnail — used in grid view
// ------------------------------------------------------------------

export function ProductImageThumbnail({
  src,
  alt,
  size = 'md',
}: {
  src: string | null | undefined;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-20 h-20',
  };

  console.log('[DEBUG ProductImageThumbnail] src:', src?.slice(0, 60), 'alt:', alt);
  const hasImage = src && src !== '/placeholder-box.png';

  if (!hasImage) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-lg border border-white/10 bg-[#0a0514] flex items-center justify-center flex-shrink-0`}
        title={alt}
      >
        <span className="text-xs font-semibold text-gray-500 select-none">
          {getProductInitials(alt)}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-lg border border-white/10 bg-[#150f24] overflow-hidden flex-shrink-0`}
    >
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        loading="lazy"
        onError={(e) => {
          const target = e.currentTarget;
          target.style.display = 'none';
          const parent = target.parentElement;
          if (parent) {
            parent.innerHTML = `<span class="text-xs font-semibold text-gray-500 flex items-center justify-center w-full h-full">${getProductInitials(
              alt
            )}</span>`;
          }
        }}
      />
    </div>
  );
}

// ------------------------------------------------------------------
// Product Card with Image — wraps the accordion for grid view
// ------------------------------------------------------------------

function ProductCardWithImage({
  product,
  role,
}: {
  product: Product;
  role: UserRole;
}) {
  return (
    <div className="bg-[#150f24] rounded-xl border border-white/10 overflow-hidden">
      {/* Image strip — primary product image thumbnail */}
      <div className="px-5 pt-5 pb-0">
        <div className="flex items-center gap-3">
          <ProductImageThumbnail src={product.image} alt={product.name} />
          <div className="min-w-0">
            <p className="text-xs text-gray-500 uppercase tracking-wider">
              Product Image
            </p>
            <p className="text-sm text-gray-400 truncate">{product.name}</p>
          </div>
        </div>
      </div>

      {/* Product Accordion */}
      <ProductAccordion product={product} role={role} />
    </div>
  );
}

// ------------------------------------------------------------------
// Transform DB → Frontend
// ------------------------------------------------------------------

function transformToFrontend(
  dbProducts: DBProduct[],
  dbVariants: DBVariant[]
): { products: Product[]; kit: WholesalerStarterKit | null } {
  const kitProduct = dbProducts.find((p) => p.sku === 'MD2-KIT');
  const regularProducts = dbProducts.filter((p) => p.sku !== 'MD2-KIT');

  const products: Product[] = regularProducts.map((dbp) => {
    const productVariants = dbVariants.filter((v) => v.product_id === dbp.id);
    const firstVariant = productVariants[0];
    const basePillCount = firstVariant
      ? Math.round(firstVariant.total_pills / firstVariant.quantity)
      : 10;

    // Primary product image (fallback chain: primary image → legacy image_url → placeholder)
    const primaryProductImage = getPrimaryImageUrl(dbp.images);
    const productImage =
      primaryProductImage || dbp.image_url || '/placeholder-box.png';
    console.log('[DEBUG transform] product:', dbp.name, 'primary:', primaryProductImage?.slice(0, 50), 'final:', productImage?.slice(0, 50));

    return {
      id: dbp.id,
      name: dbp.name,
      description: dbp.description || '',
      basePillCount,
      image: productImage,
      packagingOptions: productVariants.map((v) => ({
        id: v.sku,
        tier: v.tier as 'individual' | 'case' | 'master_case' | 'special',
        name: v.name,
        quantity: v.quantity,
        totalPills: v.total_pills,
        pricing: {
          msrp: v.msrp_price,
          wholesalerPrice: v.wholesaler_price,
          distributorPrice: v.distributor_price,
        },
        sku: v.sku,
        inStock: v.in_stock,
      })),
    };
  });

  let kit: WholesalerStarterKit | null = null;
  if (kitProduct) {
    const kitVariants = dbVariants.filter((v) => v.product_id === kitProduct.id);
    const kitVariant = kitVariants[0];
    kit = {
      id: kitProduct.id,
      name: kitProduct.name,
      description:
        kitProduct.description || 'Everything to get started selling microDOS(2)',
      contents: { boxes: 9, starterCards: 7, display: true, placard: true },
      totalPills: kitVariant?.total_pills || 104,
      pricing: {
        msrp: kitVariant?.msrp_price || kitProduct.retail_price || 474.65,
        wholesalerPrice: kitVariant?.wholesaler_price || 155.76,
        distributorPrice:
          kitVariant?.distributor_price || kitProduct.price || 116.82,
      },
      sku: kitProduct.sku,
      inStock: kitVariant?.in_stock ?? true,
    };
  }

  return { products, kit };
}

// ------------------------------------------------------------------
// Main Page Component
// ------------------------------------------------------------------

export function Products() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [kit, setKit] = useState<WholesalerStarterKit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentUserRole: UserRole = getFallbackRole(user?.role as UserRole);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    async function fetchData() {
      // Always reset state on each attempt
      setLoading(true);
      setError(null);

      try {
        // Use RPC to bypass RLS and fetch products + variants in one call
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          'get_products_with_variants'
        );

        if (rpcError) {
          console.error('[Products] RPC error:', rpcError);
          throw new Error(`Failed to load products: ${rpcError.message}`);
        }

        const dbProducts = rpcData?.products || [];
        const dbVariants = rpcData?.variants || [];

        if (cancelled) return;

        // Build variant lookup map for O(1) access
        const variantMap = new Map<string, DBVariant[]>();
        for (const v of dbVariants || []) {
          const list = variantMap.get(v.product_id) || [];
          list.push(v);
          variantMap.set(v.product_id, list);
        }

        // For products with no variants, create a default Individual variant from product data
        const enrichedVariants = [...(dbVariants || [])];
        for (const p of dbProducts || []) {
          const pv = variantMap.get(p.id);
          if (!pv || pv.length === 0) {
            // Create default variant from product's own data
            enrichedVariants.push({
              id: `default-${p.id}`,
              product_id: p.id,
              tier: 'individual',
              name: 'Individual',
              quantity: 1,
              total_pills: p.stock || 1,
              sku: p.sku || `${p.id.slice(0, 8)}-001`,
              msrp_price: p.retail_price || p.price * 2,
              wholesaler_price: p.price * 1.5,
              distributor_price: p.price,
              in_stock: p.stock > 0,
            });
          }
        }

        // Transform to frontend format
        const { products: transformedProducts, kit: transformedKit } =
          transformToFrontend(dbProducts || [], enrichedVariants);

        setProducts(transformedProducts);
        setKit(transformedKit);
      } catch (err: any) {
        console.error('[Products] Fetch failed:', err);
        if (!cancelled) {
          setError(
            err.message || 'Failed to load products. Please try again.'
          );
        }
      } finally {
        clearTimeout(timeoutId);
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    // 15-second safety timeout — only fires if fetchData truly hangs
    timeoutId = setTimeout(() => {
      if (!cancelled) {
        setError(
          'Connection timed out after 15 seconds. The database may be unreachable.'
        );
        setLoading(false);
      }
    }, 15000);

    fetchData();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  // Filter products based on search
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(q) ||
        product.description.toLowerCase().includes(q) ||
        product.packagingOptions.some(
          (po) =>
            po.name.toLowerCase().includes(q) || po.sku.toLowerCase().includes(q)
        )
    );
  }, [products, searchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0514] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-[#9a02d0] animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading products...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0514] flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <Package className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">
            Failed to load products
          </h2>
          <p className="text-gray-400 mb-4 text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-[#9a02d0] text-white rounded-lg hover:bg-[#7a01a8] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const dashboardRoute =
    user?.role === 'distributor'
      ? '/distributor-dashboard'
      : user?.role === 'wholesaler'
      ? '/wholesaler-dashboard'
      : user?.role === 'sales_manager'
      ? '/sales-manager-dashboard'
      : user?.role === 'sales_rep'
      ? '/sales-rep-dashboard'
      : '/';

  return (
    <div className="min-h-screen bg-[#0a0514] py-8 px-4 sm:px-6 lg:px-8">
      <CartDrawer />
      <div className="max-w-7xl mx-auto">
        {/* Back to Dashboard */}
        {user?.role && (
          <button
            onClick={() => navigate(dashboardRoute)}
            className="flex items-center gap-2 text-sm text-[#9a02d0] hover:text-[#ff66c4] transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Package className="w-8 h-8 text-[#9a02d0]" />
              <h1 className="text-3xl font-bold text-white">Product Catalog</h1>
            </div>
            <p className="text-gray-400">
              Browse our complete product line with wholesale pricing
            </p>
            {user?.role && (
              <p className="text-xs text-[#44f80c] mt-1 capitalize">
                Viewing as: {user.role.replace('_', ' ')}
              </p>
            )}
          </div>
          <div className="sticky top-4 z-40">
            <CartButton />
          </div>
        </div>

        {/* Starter Kit Section */}
        {kit && (
          <div className="mb-8">
            <StarterKitCard kit={kit} role={currentUserRole} />
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <ViewToggle view={view} onViewChange={setView} />
            <span className="text-gray-400 text-sm">
              {filteredProducts.reduce(
                (acc, p) => acc + p.packagingOptions.length,
                0
              )}{' '}
              options
            </span>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-[#150f24] border-white/10 text-white placeholder:text-gray-500 focus-visible:ring-[#9a02d0]"
            />
          </div>
        </div>

        {/* Products Display */}
        {view === 'grid' ? (
          <div className="space-y-6">
            {filteredProducts.map((product) => (
              <ProductCardWithImage
                key={product.id}
                product={product}
                role={currentUserRole}
              />
            ))}
          </div>
        ) : (
          <ProductTable products={filteredProducts} role={currentUserRole} />
        )}

        {/* Empty State */}
        {filteredProducts.length === 0 && (
          <div className="text-center py-16">
            <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              {searchQuery ? 'No products found' : 'No products available'}
            </h3>
            <p className="text-gray-400">
              {searchQuery
                ? 'Try adjusting your search query'
                : 'Products will appear once the catalog is configured'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
