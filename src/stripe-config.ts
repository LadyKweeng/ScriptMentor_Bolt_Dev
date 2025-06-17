export interface Product {
  id: string;
  priceId: string;
  name: string;
  description: string;
  mode: 'subscription' | 'payment';
  price: number;
  currency: string;
  interval?: 'month' | 'year';
  features: string[];
  popular?: boolean;
}

export const products: Product[] = [
  {
    id: 'prod_SVnZKybC8Mf5uF',
    priceId: 'price_1Raly0EOpk1Bj1eeuMuWMJ7Y',
    name: 'Free Tier',
    description: '50 tokens/month. Access to single mentor feedback only.',
    mode: 'subscription',
    price: 0,
    currency: 'usd',
    interval: 'month',
    features: [
      '50 tokens per month',
      'Single mentor feedback',
      'Basic script analysis',
      'Community support'
    ]
  },
  {
    id: 'prod_SVnasnabiLFNgX',
    priceId: 'price_1RalzkEOpk1Bj1eeIqTOsYNq',
    name: 'Creator',
    description: '500 tokens per month. Access to all mentor personalities. Full blended feedback mode. Writer Agent analysis.',
    mode: 'subscription',
    price: 19.99,
    currency: 'usd',
    interval: 'month',
    popular: true,
    features: [
      '500 tokens per month',
      'All mentor personalities',
      'Blended feedback mode',
      'Writer Agent analysis',
      'Advanced script insights',
      'Priority support'
    ]
  },
  {
    id: 'prod_SVnc8co8wHiHWO',
    priceId: 'price_1Ram1AEOpk1Bj1ee2sRTCp8b',
    name: 'Pro',
    description: '1,500 tokens/month. Everything from the Creator tier with a 30% token discount.',
    mode: 'subscription',
    price: 49.99,
    currency: 'usd',
    interval: 'month',
    features: [
      '1,500 tokens per month',
      '30% token discount',
      'Everything from Creator tier',
      'Unlimited script uploads',
      'Advanced analytics',
      'Premium support',
      'Early access to new features'
    ]
  }
];

export const getProductById = (id: string): Product | undefined => {
  return products.find(product => product.id === id);
};

export const getProductByPriceId = (priceId: string): Product | undefined => {
  return products.find(product => product.priceId === priceId);
};