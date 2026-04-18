import { useState, useEffect, useMemo } from 'react';
import { ProductAccordion } from '@/components/products/ProductAccordion';
import { ProductTable } from '@/components/products/ProductTable';
import { StarterKitCard } from '@/components/products/StarterKitCard';
import { ViewToggle } from '@/components/products/ViewToggle';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { CartButton } from '@/components/cart/CartButton';
import { Input } from '@/components/ui/input';
import { Search, Package, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import type { UserRole, Product, WholesalerStarterKit } from '@/types/products';

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
}

interface SiteSettingVariant {
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
}

function getFallbackRole(role: UserRole | undefined): UserRole {
  if (role) return role;
  return 'wholesaler';
}

function transformToFrontend(
  dbProducts: DBProduct[],
  dbVariants: SiteSettingVariant[]
): { products: Product[]; kit: WholesalerStarterKit | null } {
  const kitProduct = dbProducts.find((p) => p.sku === 'MD2-KIT');
  const regularProducts = dbProducts.filter((p) => p.sku !== 'MD2-KIT');

  const products: Product[] = regularProducts.map((dbp) => {
    const variants = dbVariants.filter((v) => v.product_id === dbp.id);
    const firstVariant = variants[0];
    const basePillCount = firstVariant
      ? Math.round(firstVariant.total_pills / firstVariant.quantity)
      : 10;

    return {
      id: dbp.id,
      name: dbp.name,
      description: dbp.description || '',
      basePillCount,
      image: dbp.image_url || '/placeholder-box.png',
      packagingOptions: variants.map((v) => ({
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
    const kitVariant = dbVariants.find((v) => v.product_id === kitProduct.id);
    kit = {
      id: kitProduct.id,
      name: kitProduct.name,
      description: kitProduct.description || 'Everything to get started selling microDOS(2)',
      contents: {
        boxes: 9,
        starterCards: 7,
        display: true,
        placard: true,
      },
      totalPills: kitVariant?.total_pills || 104,
      pricing: {
        msrp: kitVariant?.msrp_price || kitProduct.retail_price || 474.65,
        wholesalerPrice: kitVariant?.wholesaler_price || 155.76,
        distributorPrice: kitVariant?.distributor_price || kitProduct.price || 116.82,
      },
      sku: kitProduct.sku,
      inStock: kitVariant?.in_stock ?? true,
    };
  }

  return { products, kit };
}

export function Products() {
  const { user } = useAuth();
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [kit, setKit] = useState<WholesalerStarterKit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentUserRole: UserRole = getFallbackRole(user?.role as UserRole);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        // 1. Fetch products from Supabase
        const { data: dbProducts, error: productsError } = await supabase
          .from('products')
          .select('*')
          .eq('is_active', true)
          .order('name');

        if (productsError) throw productsError;

        // 2. Try to fetch variants from product_variants table (future schema)
        let dbVariants: SiteSettingVariant[] = [];
        try {
          const { data: variantsData, error: variantsError } = await supabase
            .from('product_variants')
            .select('*');
          if (!variantsError && variantsData) {
            dbVariants = variantsData.map((v: DBVariant) => ({
              product_id: v.product_id,
              tier: v.tier,
              name: v.name,
              quantity: v.quantity,
              total_pills: v.total_pills,
              sku: v.sku,
              msrp_price: v.msrp_price,
              wholesaler_price: v.wholesaler_price,
              distributor_price: v.distributor_price,
              in_stock: v.in_stock,
            }));
          }
        } catch {
          // product_variants table may not exist yet, fall back to site_settings
        }

        // 3. Fallback: fetch variants from site_settings
        if (dbVariants.length === 0) {
          const { data: setting, error: settingError } = await supabase
            .from('site_settings')
            .select('value')
            .eq('key', 'product_variants')
            .single();

          if (!settingError && setting?.value) {
            const val = setting.value as { variants?: SiteSettingVariant[] };
            if (val.variants) {
              dbVariants = val.variants;
            }
          }
        }

        // 4. Transform to frontend format
        if (dbProducts && dbProducts.length > 0) {
          const { products: transformedProducts, kit: transformedKit } =
            transformToFrontend(dbProducts as DBProduct[], dbVariants);
          setProducts(transformedProducts);
          setKit(transformedKit);
        }

        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to load products');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
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
            po.name.toLowerCase().includes(q) ||
            po.sku.toLowerCase().includes(q)
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
          <p className="text-gray-400 mb-4">{error}</p>
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

  return (
    <div className="min-h-screen bg-[#0a0514] py-8 px-4 sm:px-6 lg:px-8">
      <CartDrawer />
      <div className="max-w-7xl mx-auto">
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
              <ProductAccordion
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
