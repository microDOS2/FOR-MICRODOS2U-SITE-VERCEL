// Product and Pricing Types

export interface PricingTier {
  msrp: number;
  wholesalerPrice: number;
  distributorPrice: number;
}

export type PackagingTier = 'individual' | 'case' | 'master_case' | 'special';

export interface PackagingOption {
  id: string;
  tier: PackagingTier;
  name: string;
  quantity: number;
  totalPills: number;
  pricing: PricingTier;
  sku: string;
  inStock: boolean;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  basePillCount: number;
  image: string;
  packagingOptions: PackagingOption[];
}

export interface WholesalerStarterKit {
  id: string;
  name: string;
  description: string;
  image: string;
  contents: {
    boxes: number;
    starterCards: number;
    display: boolean;
    placard: boolean;
  };
  totalPills: number;
  pricing: PricingTier;
  sku: string;
  inStock: boolean;
}

export type UserRole = 'admin' | 'sales_manager' | 'sales_rep' | 'distributor' | 'wholesaler';

export interface CartItem {
  productId: string;
  packagingId: string;
  quantity: number;
  productName: string;
  packagingName: string;
  unitPrice: number;
  totalPrice: number;
}
