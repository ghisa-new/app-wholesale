export interface ShopifyImage {
  url: string;
  altText: string | null;
}

export interface Money {
  amount: string;
  currencyCode: string;
}

export interface SelectedOption {
  name: string;
  value: string;
}

export interface ProductVariant {
  id: string;
  title: string;
  sku?: string;
  price: Money;
  compareAtPrice: Money | null;
  availableForSale: boolean;
  selectedOptions: SelectedOption[];
  image?: ShopifyImage | null;
}

export interface SiblingProduct {
  id: string;
  handle: string;
  title: string;
  featuredImage: string | null;
  color: string | null;
}

export interface WholesaleMeta {
  temperature: string;
  lotCount: number;
  discount: number;
  seriDistribution?: Record<string, number>;
}

export interface Product {
  id: string;
  title: string;
  handle: string;
  description: string;
  descriptionHtml?: string;
  tags: string[];
  productType: string;
  availableForSale: boolean;
  price: Money;
  compareAtPrice: Money | null;
  wholesalePrice: Money;
  retailPrice: Money;
  campaignDiscount: number;
  seriDistribution: Record<string, number>;
  images: ShopifyImage[];
  variants: ProductVariant[];
  siblings: SiblingProduct[];
}

export interface CartItem {
  variantId: string;
  productHandle: string;
  productTitle: string;
  variantTitle: string;
  price: number;
  quantity: number;
  image: string | null;
  color: string;
  seriDistribution: Record<string, number>;
}
