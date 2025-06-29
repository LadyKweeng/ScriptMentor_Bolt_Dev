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

// Existing subscription products
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

// NEW: One-time token packages
export const tokenPackages: Product[] = [
  {
    id: 'prod_TokenStarter',
    priceId: 'price_token_starter_100', // You'll need to create these in Stripe
    name: 'Starter Pack',
    description: '100 tokens for additional feedback and analysis',
    mode: 'payment',
    price: 9.99,
    currency: 'usd',
    features: [
      '100 tokens instantly',
      'No subscription required',
      'Perfect for trying premium features',
      'Never expires'
    ]
  },
  {
    id: 'prod_TokenPower',
    priceId: 'price_token_power_250',
    name: 'Power Pack',
    description: '250 tokens for extensive script development',
    mode: 'payment',
    price: 19.99,
    currency: 'usd',
    popular: true,
    features: [
      '250 tokens instantly',
      'Best value per token',
      'Great for multiple scripts',
      'Never expires'
    ]
  },
  {
    id: 'prod_TokenPro',
    priceId: 'price_token_pro_500',
    name: 'Pro Pack',
    description: '500 tokens for professional screenwriters',
    mode: 'payment',
    price: 34.99,
    currency: 'usd',
    features: [
      '500 tokens instantly',
      'Professional tier value',
      'Extended script development',
      'Never expires'
    ]
  },
  {
    id: 'prod_TokenUltimate',
    priceId: 'price_token_ultimate_1000',
    name: 'Ultimate Pack',
    description: '1000 tokens for unlimited creative exploration',
    mode: 'payment',
    price: 59.99,
    currency: 'usd',
    features: [
      '1000 tokens instantly',
      'Maximum value',
      'Complete creative freedom',
      'Never expires'
    ]
  }
];

// Existing helper functions for subscription products
export const getProductById = (id: string): Product | undefined => {
  return products.find(product => product.id === id);
};

export const getProductByPriceId = (priceId: string): Product | undefined => {
  return products.find(product => product.priceId === priceId);
};

// NEW: Token package helper functions
export const getTokenPackageByPriceId = (priceId: string): Product | undefined => {
  return tokenPackages.find(pkg => pkg.priceId === priceId);
};

export const getAllProducts = (): Product[] => {
  return [...products, ...tokenPackages];
};

export const getTokensFromPriceId = (priceId: string): number => {
  const tokenAmounts: Record<string, number> = {
    'price_token_starter_100': 100,
    'price_token_power_250': 250,
    'price_token_pro_500': 500,
    'price_token_ultimate_1000': 1000,
  };
  return tokenAmounts[priceId] || 0;
};

export const getDiscountedPrice = (originalPrice: number, tier: 'free' | 'creator' | 'pro'): number => {
  if (tier === 'pro') {
    return Math.round(originalPrice * 0.7 * 100) / 100; // 30% discount for Pro tier
  }
  return originalPrice;
};

export const getPackageByTokenAmount = (tokens: number): Product | undefined => {
  return tokenPackages.find(pkg => getTokensFromPriceId(pkg.priceId) === tokens);
};

export const getBestValuePackage = (): Product => {
  return tokenPackages.reduce((best, current) => {
    const currentTokens = getTokensFromPriceId(current.priceId);
    const bestTokens = getTokensFromPriceId(best.priceId);
    const currentValue = current.price / currentTokens;
    const bestValue = best.price / bestTokens;
    return currentValue < bestValue ? current : best;
  });
};

export const getRecommendedPackageForShortage = (tokensNeeded: number): Product => {
  // Find the smallest package that covers the shortage
  const suitablePackages = tokenPackages.filter(pkg => 
    getTokensFromPriceId(pkg.priceId) >= tokensNeeded
  ).sort((a, b) => 
    getTokensFromPriceId(a.priceId) - getTokensFromPriceId(b.priceId)
  );

  // If no package covers the shortage or shortage is 0, return Power Pack (best value)
  return suitablePackages[0] || tokenPackages.find(pkg => pkg.name === 'Power Pack') || tokenPackages[1];
};