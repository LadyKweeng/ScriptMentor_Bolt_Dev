// src/stripe-config.ts
export interface StripeProduct {
  id: string;
  priceId: string;
  name: string;
  description: string;
  mode: 'subscription' | 'payment';
  price?: number; // in cents, for display purposes
  interval?: 'month' | 'year';
  features?: string[];
  popular?: boolean;
}

export const STRIPE_PRODUCTS: StripeProduct[] = [
  {
    id: 'prod_SVnZKybC8Mf5uF',
    priceId: 'price_1Raly0EOpk1Bj1eeuMuWMJ7Y',
    name: 'Free Tier',
    description: '50 tokens/month. Access to single mentor feedback only.',
    mode: 'subscription',
    price: 0,
    interval: 'month',
    features: [
      '50 AI feedback tokens per month',
      'Single scene analysis',
      'Basic mentor feedback',
      'Script library storage',
      'Standard support'
    ]
  },
  {
    id: 'prod_SVnasnabiLFNgX',
    priceId: 'price_1RalzkEOpk1Bj1eeIqTOsYNq',
    name: 'Creator',
    description: '500 tokens per month. Access to all mentor personalities. Full blended feedback mode. Writer Agent analysis.',
    mode: 'subscription',
    price: 1999, // $19.99
    interval: 'month',
    popular: true,
    features: [
      '500 AI feedback tokens per month',
      'Chunked script analysis',
      'All mentor personalities',
      'Blended mentor feedback',
      'Writer suggestions',
      'Script comparison tools',
      'Priority support',
      'Export capabilities'
    ]
  },
  {
    id: 'prod_SVnc8co8wHiHWO',
    priceId: 'price_1Ram1AEOpk1Bj1ee2sRTCp8b',
    name: 'Pro',
    description: '1,500 tokens/month. Everything from the Creator tier with a 30% token discount.',
    mode: 'subscription',
    price: 4999, // $49.99
    interval: 'month',
    features: [
      '1,500 AI feedback tokens per month',
      'Everything from Creator tier',
      '30% token discount',
      'Unlimited script storage',
      'Advanced analytics',
      'Team collaboration',
      'API access',
      'Dedicated support'
    ]
  }
];

export const getProductByPriceId = (priceId: string): StripeProduct | undefined => {
  return STRIPE_PRODUCTS.find(product => product.priceId === priceId);
};

export const getProductById = (id: string): StripeProduct | undefined => {
  return STRIPE_PRODUCTS.find(product => product.id === id);
};

export const formatPrice = (price: number): string => {
  if (price === 0) return 'Free';
  return `$${(price / 100).toFixed(2)}`;
};