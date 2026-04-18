// Utility functions for product pricing and formatting

export function getPrice(
  pricing: { msrp: number; wholesalerPrice: number; distributorPrice: number },
  role: string
): number {
  switch (role) {
    case 'distributor':
      return pricing.distributorPrice;
    case 'wholesaler':
      return pricing.wholesalerPrice;
    case 'sales_rep':
    case 'sales_manager':
    case 'admin':
      return pricing.distributorPrice;
    default:
      return pricing.msrp;
  }
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(price);
}
