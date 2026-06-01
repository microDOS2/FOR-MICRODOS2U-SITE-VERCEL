import type { WholesalerStarterKit, UserRole } from '@/types/products';
import { PricingDisplay } from './PricingDisplay';
import { QuantitySelector } from './QuantitySelector';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/context/CartContext';
import { getPrice } from '@/data/products';
import { ProductImageThumbnail } from '@/pages/Products';
import { toast } from 'sonner';
import { Package, Store, CreditCard } from 'lucide-react';

interface StarterKitCardProps {
  kit: WholesalerStarterKit;
  role: UserRole;
}

export function StarterKitCard({ kit, role }: StarterKitCardProps) {
  const { addItem, setIsOpen } = useCart();
  
  const handleAddToCart = (quantity: number) => {
    const unitPrice = getPrice(kit.pricing, role);
    addItem({
      id: `${kit.id}-${Date.now()}`,
      productName: kit.name,
      packagingName: 'Starter Kit',
      sku: kit.sku,
      quantity,
      unitPrice,
    });
    toast.success(`Added ${quantity} × ${kit.name} to cart`, {
      description: `${kit.sku} - Everything to get started!`,
    });
    setIsOpen(true);
  };

  return (
    <div className="bg-[#150f24] rounded-xl border border-white/10 overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <ProductImageThumbnail src={kit.image} alt={kit.name} size="lg" />
            <div>
              <h3 className="text-xl font-bold text-white">{kit.name}</h3>
              <p className="text-gray-400">{kit.description}</p>
            </div>
          </div>
          <Badge
            variant={kit.inStock ? 'default' : 'secondary'}
            className={
              kit.inStock
                ? 'bg-[#44f80c]/20 text-[#44f80c] border-[#44f80c]/30'
                : 'bg-gray-800 text-gray-400'
            }
          >
            {kit.inStock ? 'In Stock' : 'Out of Stock'}
          </Badge>
        </div>

        <div className="text-xs text-gray-500 mb-4">SKU: {kit.sku}</div>

        {/* Kit Contents */}
        <div className="bg-[#0a0514] rounded-lg p-4 mb-4">
          <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Package className="w-4 h-4 text-[#9a02d0]" />
            Kit Contents
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-gray-300">
              <Store className="w-4 h-4 text-[#44f80c]" />
              <span>{kit.contents.boxes} Boxes (10 pills each)</span>
            </div>
            <div className="flex items-center gap-2 text-gray-300">
              <CreditCard className="w-4 h-4 text-[#ff66c4]" />
              <span>{kit.contents.starterCards} Starter Cards (2 pills each)</span>
            </div>
            <div className="flex items-center gap-2 text-gray-300">
              <Store className="w-4 h-4 text-[#9a02d0]" />
              <span>Wooden Display (holds 9 boxes + 7 cards)</span>
            </div>
            <div className="flex items-center gap-2 text-gray-300">
              <Award className="w-4 h-4 text-[#44f80c]" />
              <span>"Ask about microDOS(2)" Placard</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Total Pills:</span>
              <span className="text-white font-semibold">{kit.totalPills}</span>
            </div>
          </div>
        </div>

        {/* Pricing & Action */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <PricingDisplay pricing={kit.pricing} role={role} />
          
          {kit.inStock && (
            <QuantitySelector onAddToCart={handleAddToCart} />
          )}
        </div>
      </div>
    </div>
  );
}
