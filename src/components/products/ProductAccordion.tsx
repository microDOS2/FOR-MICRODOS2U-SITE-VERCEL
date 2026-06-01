import { useState } from 'react';
import type { Product, UserRole } from '@/types/products';
import { PackagingCard } from './PackagingCard';
import { ProductImageThumbnail } from '@/pages/Products';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ProductAccordionProps {
  product: Product;
  role: UserRole;
}

export function ProductAccordion({ product, role }: ProductAccordionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="bg-[#150f24] rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-4">
          <ProductImageThumbnail src={product.image} alt={product.name} size="lg" />
          <div className="text-left">
            <h3 className="text-xl font-bold text-white">{product.name}</h3>
            <p className="text-gray-400">{product.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm hidden sm:inline">
            {product.packagingOptions.length} options
          </span>
          <div className="w-8 h-8 rounded-full bg-[#0a0514] flex items-center justify-center">
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-5 pt-0 border-t border-white/10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
            {product.packagingOptions.map((packaging) => (
              <PackagingCard
                key={packaging.id}
                packaging={packaging}
                productName={product.name}
                role={role}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
