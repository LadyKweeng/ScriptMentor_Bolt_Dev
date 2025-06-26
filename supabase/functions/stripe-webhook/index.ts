import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'Script Mentor Webhook',
    version: '2.0.0',
  },
});

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

// Token allocation mapping based on price IDs
const PRICE_ID_TO_TOKENS: Record<string, { tokens: number; tier: string }> = {
  'price_1Raly0EOpk1Bj1eeuMuWMJ7Y': { tokens: 50, tier: 'free' },      // Free Tier
  'price_1RalzkEOpk1Bj1eeIqTOsYNq': { tokens: 500, tier: 'creator' },   // Creator Tier  
  'price_1Ram1AEOpk1Bj1ee2sRTCp8b': { tokens: 1500, tier: 'pro' },      // Pro Tier
};

// Token costs for one-time purchases (if implementing later)
const TOKEN_PACKAGE_PRICES: Record<string, number> = {
  // Add token package price IDs here when implementing Conversation 6
  // 'price_token_100': 100,
  // 'price_token_250': 250,
  // etc.
};

Deno.serve(async (req) => {
  try {
    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Get the signature from the header
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response('No signature found', { status: 400 });
    }

    // Get the raw body
    const body = await req.text();

    // Verify the webhook signature
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
    } catch (error: any) {
      console.error(`Webhook signature verification failed: ${error.message}`);
      return new Response(`Webhook signature verification failed: ${error.message}`, { status: 400 });
    }

    // Process the event asynchronously
    EdgeRuntime.waitUntil(handleEvent(event));

    return Response.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function handleEvent(event: Stripe.Event) {
  console.log(`🔔 Processing webhook event: ${event.type}`);

  try {
    switch (event.type) {
      // Subscription lifecycle events
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      // Payment events
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      // Checkout completion
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      // Customer events
      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object as Stripe.Subscription);
        break;

      default:
        console.log(`⚠️ Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error(`❌ Error handling ${event.type}:`, error);
    throw error; // Re-throw to ensure webhook returns error status
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (!session.customer || typeof session.customer !== 'string') {
    console.error('No customer ID in checkout session');
    return;
  }

  const customerId = session.customer;
  const isSubscription = session.mode === 'subscription';

  console.info(`Processing ${isSubscription ? 'subscription' : 'one-time payment'} checkout for customer: ${customerId}`);

  if (isSubscription) {
    // Sync customer and subscription data, which will handle token allocation
    await syncCustomerFromStripe(customerId);
  } else if (session.mode === 'payment' && session.payment_status === 'paid') {
    // Handle one-time purchase
    await handleOneTimeTokenPurchase(session);
  }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  if (!subscription.customer || typeof subscription.customer !== 'string') {
    console.error('No customer ID in subscription');
    return;
  }

  console.info(`Subscription ${subscription.status} for customer: ${subscription.customer}`);
  
  // Sync the latest subscription data and allocate tokens
  await syncCustomerFromStripe(subscription.customer);
}

async function handleSubscriptionCancelled(subscription: Stripe.Subscription) {
  if (!subscription.customer || typeof subscription.customer !== 'string') {
    console.error('No customer ID in cancelled subscription');
    return;
  }

  console.info(`Subscription cancelled for customer: ${subscription.customer}`);
  
  // Get user ID from customer mapping
  const { data: customer } = await supabase
    .from('stripe_customers')
    .select('user_id')
    .eq('customer_id', subscription.customer)
    .single();

  if (!customer) {
    console.error(`No user mapping found for customer: ${subscription.customer}`);
    return;
  }

  // Reset to free tier
  await allocateTokensToUser(customer.user_id, 50, 'free', subscription.id, 'Subscription cancelled - reverted to free tier');
  
  // Update subscription status
  await supabase
    .from('stripe_subscriptions')
    .update({ 
      status: 'canceled',
      updated_at: new Date().toISOString()
    })
    .eq('customer_id', subscription.customer);
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  if (!invoice.customer || typeof invoice.customer !== 'string') {
    return;
  }

  if (invoice.billing_reason === 'subscription_cycle') {
    console.info(`Monthly billing succeeded for customer: ${invoice.customer}`);
    // Monthly renewal - tokens are allocated via subscription sync
    await syncCustomerFromStripe(invoice.customer);
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  if (!invoice.customer || typeof invoice.customer !== 'string') {
    return;
  }

  console.warn(`Payment failed for customer: ${invoice.customer}`);
  
  // Get user ID
  const { data: customer } = await supabase
    .from('stripe_customers')
    .select('user_id')
    .eq('customer_id', invoice.customer)
    .single();

  if (customer) {
    // Optionally implement grace period logic here
    // For now, we'll let Stripe handle the subscription status
    console.info(`Payment failed for user: ${customer.user_id}`);
  }
}

async function handleOneTimePayment(paymentIntent: Stripe.PaymentIntent) {
  // Handle one-time token purchases (implement in Conversation 6)
  console.info(`One-time payment succeeded: ${paymentIntent.id}`);
}

async function handleOneTimeTokenPurchase(session: Stripe.Checkout.Session) {
  // Extract order information and save to stripe_orders
  try {
    const { error: orderError } = await supabase.from('stripe_orders').insert({
      checkout_session_id: session.id,
      payment_intent_id: session.payment_intent,
      customer_id: session.customer,
      amount_subtotal: session.amount_subtotal,
      amount_total: session.amount_total,
      currency: session.currency,
      payment_status: session.payment_status,
      status: 'completed'
    });

    if (orderError) {
      console.error('Error inserting order:', orderError);
      return;
    }

    console.info(`Successfully processed one-time payment for session: ${session.id}`);
    
    // TODO: Handle token packages when implementing Conversation 6
  } catch (error) {
    console.error('Error processing one-time payment:', error);
  }
}

// Enhanced sync function with token allocation
async function syncCustomerFromStripe(customerId: string) {
  try {
    console.info(`Syncing customer and allocating tokens for: ${customerId}`);
    
    // Fetch latest subscription data from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
      status: 'all',
      expand: ['data.default_payment_method'],
    });

    // Get user ID from customer mapping
    const { data: customer } = await supabase
      .from('stripe_customers')
      .select('user_id')
      .eq('customer_id', customerId)
      .single();

    if (!customer) {
      console.error(`No user mapping found for customer: ${customerId}`);
      return;
    }

    const userId = customer.user_id;

    if (subscriptions.data.length === 0) {
      console.info(`No subscriptions found for customer: ${customerId} - setting free tier`);
      
      // No subscription - set to free tier
      await allocateTokensToUser(userId, 50, 'free', null, 'No active subscription - free tier');
      
      // Update subscription record
      const { error: noSubError } = await supabase.from('stripe_subscriptions').upsert({
        customer_id: customerId,
        subscription_status: 'not_started',
        status: 'not_started'
      }, {
        onConflict: 'customer_id',
      });

      if (noSubError) {
        console.error('Error updating subscription status:', noSubError);
      }
      return;
    }

    const subscription = subscriptions.data[0];
    const priceId = subscription.items.data[0]?.price?.id;

    if (!priceId) {
      console.error(`No price ID found for subscription: ${subscription.id}`);
      return;
    }

    // Get token allocation for this price ID
    const tokenConfig = PRICE_ID_TO_TOKENS[priceId];
    if (!tokenConfig) {
      console.warn(`Unknown price ID: ${priceId} - defaulting to free tier`);
      await allocateTokensToUser(userId, 50, 'free', subscription.id, `Unknown price ID: ${priceId}`);
    } else {
      // Allocate tokens based on subscription tier
      await allocateTokensToUser(
        userId, 
        tokenConfig.tokens, 
        tokenConfig.tier, 
        subscription.id,
        `${tokenConfig.tier} subscription token allocation`
      );
    }

    // Update subscription record in database
    const { error: subError } = await supabase.from('stripe_subscriptions').upsert({
      customer_id: customerId,
      subscription_id: subscription.id,
      price_id: priceId,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      cancel_at_period_end: subscription.cancel_at_period_end,
      ...(subscription.default_payment_method && typeof subscription.default_payment_method !== 'string' ? {
        payment_method_brand: subscription.default_payment_method.card?.brand ?? null,
        payment_method_last4: subscription.default_payment_method.card?.last4 ?? null,
      } : {}),
      status: subscription.status,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'customer_id',
    });

    if (subError) {
      console.error('Error syncing subscription:', subError);
      throw new Error('Failed to sync subscription in database');
    }

    console.info(`Successfully synced subscription and allocated tokens for customer: ${customerId}`);
  } catch (error) {
    console.error(`Failed to sync customer ${customerId}:`, error);
    throw error;
  }
}

// Token allocation function
async function allocateTokensToUser(
  userId: string,
  tokenAmount: number, 
  tier: string,
  stripeSubscriptionId: string | null,
  description: string
) {
  try {
    console.info(`Allocating ${tokenAmount} tokens to user ${userId} (${tier} tier)`);
    
    // Use the reset_monthly_tokens function to set the new allowance
    const { error: resetError } = await supabase.rpc('reset_monthly_tokens', {
      p_user_id: userId,
      p_tier: tier,
      p_allowance: tokenAmount
    });

    if (resetError) {
      console.error('Error resetting tokens:', resetError);
      throw resetError;
    }

    // Log the subscription grant transaction
    const { error: transactionError } = await supabase.rpc('add_user_tokens', {
      p_user_id: userId,
      p_tokens_to_add: 0, // Don't double-add, reset_monthly_tokens already set the balance
      p_transaction_type: 'subscription_grant',
      p_stripe_subscription_id: stripeSubscriptionId,
      p_description: description
    });

    if (transactionError) {
      console.error('Error logging transaction:', transactionError);
      // Don't throw here, the main token allocation succeeded
    }

    console.info(`Successfully allocated ${tokenAmount} tokens to user ${userId}`);
  } catch (error) {
    console.error(`Failed to allocate tokens to user ${userId}:`, error);
    throw error;
  }
}

// Enhanced subscription event handlers
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log(`✅ New subscription created: ${subscription.id}`);

  if (!subscription.customer || typeof subscription.customer !== 'string') {
    throw new Error('No customer ID in subscription created event');
  }

  // Sync customer data and allocate initial tokens
  await syncCustomerFromStripe(subscription.customer);

  // Send welcome email or trigger onboarding (if needed)
  await notifySubscriptionChange(subscription.customer, 'created', subscription);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log(`🔄 Subscription updated: ${subscription.id}`);

  if (!subscription.customer || typeof subscription.customer !== 'string') {
    throw new Error('No customer ID in subscription updated event');
  }

  // Handle plan changes, billing cycle updates, etc.
  await syncCustomerFromStripe(subscription.customer);

  // Check if this was a plan upgrade/downgrade
  await handlePlanChangeIfNeeded(subscription);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log(`❌ Subscription deleted: ${subscription.id}`);

  if (!subscription.customer || typeof subscription.customer !== 'string') {
    throw new Error('No customer ID in subscription deleted event');
  }

  // Get user ID from customer mapping
  const { data: customer } = await supabase
    .from('stripe_customers')
    .select('user_id')
    .eq('customer_id', subscription.customer)
    .single();

  if (!customer) {
    console.error(`No user mapping found for customer: ${subscription.customer}`);
    return;
  }

  // Revert to free tier
  await allocateTokensToUser(
    customer.user_id,
    50,
    'free',
    null,
    'Subscription deleted - reverted to free tier'
  );

  // Update subscription status in database
  const { error } = await supabase
    .from('stripe_subscriptions')
    .update({
      status: 'deleted',
      subscription_status: 'deleted',
      updated_at: new Date().toISOString()
    })
    .eq('customer_id', subscription.customer);

  if (error) {
    console.error('Error updating subscription status:', error);
  }

  await notifySubscriptionChange(subscription.customer, 'deleted', subscription);
}

async function handleTrialWillEnd(subscription: Stripe.Subscription) {
  console.log(`⏰ Trial ending soon for subscription: ${subscription.id}`);

  if (!subscription.customer || typeof subscription.customer !== 'string') {
    return;
  }

  // Send trial ending notification
  await notifySubscriptionChange(subscription.customer, 'trial_ending', subscription);
}

async function handlePlanChangeIfNeeded(subscription: Stripe.Subscription) {
  try {
    const { data: existingSub } = await supabase
      .from('stripe_subscriptions')
      .select('price_id')
      .eq('subscription_id', subscription.id)
      .single();

    const currentPriceId = subscription.items.data[0]?.price?.id;

    if (existingSub && existingSub.price_id !== currentPriceId) {
      console.log(`🔄 Plan change detected: ${existingSub.price_id} → ${currentPriceId}`);

      // Handle prorated token allocation for plan changes
      await handleProratedTokenAllocation(subscription, existingSub.price_id, currentPriceId);
    }
  } catch (error) {
    console.error('Error checking for plan changes:', error);
  }
}

async function handleProratedTokenAllocation(
  subscription: Stripe.Subscription,
  oldPriceId: string,
  newPriceId: string
) {
  if (!subscription.customer || typeof subscription.customer !== 'string') {
    return;
  }

  const { data: customer } = await supabase
    .from('stripe_customers')
    .select('user_id')
    .eq('customer_id', subscription.customer)
    .single();

  if (!customer) {
    console.error(`No user mapping found for customer: ${subscription.customer}`);
    return;
  }

  const oldConfig = PRICE_ID_TO_TOKENS[oldPriceId];
  const newConfig = PRICE_ID_TO_TOKENS[newPriceId];

  if (!newConfig) {
    console.warn(`Unknown new price ID: ${newPriceId}`);
    return;
  }

  // Calculate prorated tokens based on billing cycle progress
  const now = new Date();
  const periodStart = new Date(subscription.current_period_start * 1000);
  const periodEnd = new Date(subscription.current_period_end * 1000);

  const totalPeriodDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
  const remainingDays = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Calculate prorated tokens for remaining billing period
  const dailyAllowance = newConfig.tokens / totalPeriodDays;
  const proratedTokens = Math.ceil(dailyAllowance * remainingDays);

  // Get current balance to preserve unused tokens
  const { data: currentTokens } = await supabase
    .from('user_tokens')
    .select('balance')
    .eq('user_id', customer.user_id)
    .single();

  const preservedTokens = currentTokens?.balance || 0;
  const totalTokens = preservedTokens + proratedTokens;

  console.log(`📊 Prorated allocation: ${proratedTokens} new + ${preservedTokens} existing = ${totalTokens} total`);

  // Update user tokens with prorated amount
  const { error } = await supabase
    .from('user_tokens')
    .update({
      balance: totalTokens,
      monthly_allowance: newConfig.tokens,
      tier: newConfig.tier,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', customer.user_id);

  if (error) {
    console.error('Error updating prorated tokens:', error);
    throw error;
  }

  // Log the plan change transaction
  await supabase.rpc('add_user_tokens', {
    p_user_id: customer.user_id,
    p_tokens_to_add: proratedTokens,
    p_transaction_type: 'subscription_grant',
    p_stripe_subscription_id: subscription.id,
    p_description: `Plan change: ${oldConfig?.tier || 'unknown'} → ${newConfig.tier} (prorated)`
  });
}

async function notifySubscriptionChange(
  customerId: string,
  changeType: 'created' | 'deleted' | 'trial_ending',
  subscription: Stripe.Subscription
) {
  // Get user email for notifications
  const { data: customer } = await supabase
    .from('stripe_customers')
    .select('user_id')
    .eq('customer_id', customerId)
    .single();

  if (!customer) {
    console.error(`No user mapping found for customer: ${customerId}`);
    return;
  }

  // Get user email
  const { data: user } = await supabase.auth.admin.getUserById(customer.user_id);

  if (!user.user?.email) {
    console.error(`No email found for user: ${customer.user_id}`);
    return;
  }

  console.log(`📧 Would send ${changeType} notification to: ${user.user.email}`);

  // TODO: Implement actual email notifications here
  // This could integrate with your email service (SendGrid, etc.)
}