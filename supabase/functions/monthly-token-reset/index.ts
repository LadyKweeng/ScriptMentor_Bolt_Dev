// supabase/functions/monthly-token-reset/index.ts
// Automated monthly token reset function
// Runs on a schedule to reset tokens for all eligible users

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

// Initialize Supabase client with service role key for admin operations
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Token allocation mapping based on price IDs (must match webhook)
const PRICE_ID_TO_TOKENS: Record<string, { tokens: number; tier: string }> = {
  'price_1Raly0EOpk1Bj1eeuMuWMJ7Y': { tokens: 50, tier: 'free' },      // Free Tier
  'price_1RalzkEOpk1Bj1eeIqTOsYNq': { tokens: 500, tier: 'creator' },   // Creator Tier  
  'price_1Ram1AEOpk1Bj1ee2sRTCp8b': { tokens: 1500, tier: 'pro' },      // Pro Tier
};

interface ResetResult {
  userId: string;
  success: boolean;
  error?: string;
  tokensAllocated?: number;
  tier?: string;
}

interface ResetSummary {
  totalProcessed: number;
  successful: number;
  failed: number;
  results: ResetResult[];
  executionTime: number;
  timestamp: string;
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    console.log('🔄 Starting monthly token reset process...');
    
    // Verify this is a scheduled request or admin request
    const authHeader = req.headers.get('authorization');
    const isScheduledRequest = req.headers.get('x-scheduled') === 'true';
    const isAdminRequest = authHeader?.includes('Bearer ');
    
    if (!isScheduledRequest && !isAdminRequest) {
      console.warn('❌ Unauthorized access attempt to monthly reset');
      return new Response(
        JSON.stringify({ error: 'Unauthorized. This function is for scheduled execution only.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get users who need monthly reset (last reset > 30 days ago)
    const eligibleUsers = await getEligibleUsersForReset();
    
    if (eligibleUsers.length === 0) {
      console.log('✅ No users need monthly reset at this time');
      return Response.json({
        message: 'No users need reset',
        summary: {
          totalProcessed: 0,
          successful: 0,
          failed: 0,
          results: [],
          executionTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      });
    }

    console.log(`📊 Processing monthly reset for ${eligibleUsers.length} users`);

    // Process resets in batches to avoid overwhelming the system
    const results = await processResetsBatch(eligibleUsers);
    
    // Calculate summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const executionTime = Date.now() - startTime;

    const summary: ResetSummary = {
      totalProcessed: eligibleUsers.length,
      successful,
      failed,
      results,
      executionTime,
      timestamp: new Date().toISOString()
    };

    // Log summary to database for monitoring
    await logResetExecution(summary);

    console.log(`✅ Monthly reset completed: ${successful} successful, ${failed} failed (${executionTime}ms)`);

    return Response.json({
      message: 'Monthly reset completed',
      summary
    });

  } catch (error: any) {
    console.error('❌ Monthly reset process failed:', error);
    
    const errorSummary: ResetSummary = {
      totalProcessed: 0,
      successful: 0,
      failed: 1,
      results: [{ userId: 'system', success: false, error: error.message }],
      executionTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };

    // Try to log the error
    try {
      await logResetExecution(errorSummary);
    } catch (logError) {
      console.error('❌ Failed to log error:', logError);
    }

    return new Response(
      JSON.stringify({ 
        error: 'Monthly reset process failed', 
        details: error.message,
        summary: errorSummary 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Get users who are eligible for monthly token reset
 */
async function getEligibleUsersForReset(): Promise<Array<{
  user_id: string;
  last_reset_date: string;
  current_tier: string;
  current_balance: number;
}>> {
  try {
    // Get users whose last reset was more than 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: eligibleUsers, error } = await supabase
      .from('user_tokens')
      .select('user_id, last_reset_date, tier, balance')
      .lt('last_reset_date', thirtyDaysAgo.toISOString())
      .order('last_reset_date', { ascending: true }); // Process oldest first

    if (error) {
      throw new Error(`Failed to get eligible users: ${error.message}`);
    }

    return (eligibleUsers || []).map(user => ({
      user_id: user.user_id,
      last_reset_date: user.last_reset_date,
      current_tier: user.tier,
      current_balance: user.balance
    }));

  } catch (error: any) {
    console.error('❌ Error getting eligible users:', error);
    throw error;
  }
}

/**
 * Process token resets in batches
 */
async function processResetsBatch(users: Array<{
  user_id: string;
  last_reset_date: string;
  current_tier: string;
  current_balance: number;
}>): Promise<ResetResult[]> {
  const results: ResetResult[] = [];
  const batchSize = 10; // Process 10 users at a time
  
  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(users.length / batchSize)}`);
    
    // Process batch in parallel
    const batchPromises = batch.map(user => resetUserTokens(user));
    const batchResults = await Promise.allSettled(batchPromises);
    
    // Convert Promise results to ResetResult
    batchResults.forEach((result, index) => {
      const user = batch[index];
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          userId: user.user_id,
          success: false,
          error: result.reason?.message || 'Unknown error'
        });
      }
    });
    
    // Small delay between batches to avoid overwhelming the system
    if (i + batchSize < users.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

/**
 * Reset tokens for a single user
 */
async function resetUserTokens(user: {
  user_id: string;
  last_reset_date: string;
  current_tier: string;
  current_balance: number;
}): Promise<ResetResult> {
  try {
    console.log(`🔄 Resetting tokens for user: ${user.user_id}`);

    // Determine the target tier and allowance based on active subscription
    const { targetTier, targetAllowance } = await determineUserTier(user.user_id);

    // Use the database function to reset tokens
    const { error: resetError } = await supabase.rpc('reset_monthly_tokens', {
      p_user_id: user.user_id,
      p_tier: targetTier,
      p_allowance: targetAllowance
    });

    if (resetError) {
      throw new Error(`Reset function failed: ${resetError.message}`);
    }

    // Log the reset transaction
    const { error: transactionError } = await supabase
      .from('token_transactions')
      .insert({
        user_id: user.user_id,
        tokens_added: targetAllowance,
        transaction_type: 'monthly_reset',
        description: `Automated monthly reset: ${targetAllowance} tokens (${targetTier} tier)`
      });

    if (transactionError) {
      console.warn(`⚠️ Failed to log transaction for user ${user.user_id}:`, transactionError);
      // Don't fail the reset for logging issues
    }

    console.log(`✅ Reset completed for user ${user.user_id}: ${targetAllowance} tokens (${targetTier})`);

    return {
      userId: user.user_id,
      success: true,
      tokensAllocated: targetAllowance,
      tier: targetTier
    };

  } catch (error: any) {
    console.error(`❌ Failed to reset tokens for user ${user.user_id}:`, error);
    return {
      userId: user.user_id,
      success: false,
      error: error.message
    };
  }
}

/**
 * Determine user's current tier based on active subscription
 */
async function determineUserTier(userId: string): Promise<{
  targetTier: string;
  targetAllowance: number;
}> {
  try {
    // Get user's Stripe customer info
    const { data: customer } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', userId)
      .single();

    // Default to free tier
    let targetTier = 'free';
    let targetAllowance = 50;

    if (customer) {
      // Get active subscription
      const { data: subscription } = await supabase
        .from('stripe_subscriptions')
        .select('price_id, status')
        .eq('customer_id', customer.customer_id)
        .single();

      if (subscription && ['active', 'trialing'].includes(subscription.status)) {
        const tierConfig = PRICE_ID_TO_TOKENS[subscription.price_id];
        if (tierConfig) {
          targetTier = tierConfig.tier;
          targetAllowance = tierConfig.tokens;
        }
      }
    }

    return { targetTier, targetAllowance };

  } catch (error: any) {
    console.warn(`⚠️ Could not determine tier for user ${userId}, defaulting to free:`, error);
    return { targetTier: 'free', targetAllowance: 50 };
  }
}

/**
 * Log reset execution summary for monitoring
 */
async function logResetExecution(summary: ResetSummary): Promise<void> {
  try {
    // Create a simple log entry for monitoring
    const logEntry = {
      event_type: 'monthly_token_reset',
      total_processed: summary.totalProcessed,
      successful: summary.successful,
      failed: summary.failed,
      execution_time_ms: summary.executionTime,
      timestamp: summary.timestamp,
      details: JSON.stringify({
        results: summary.results.map(r => ({
          userId: r.userId,
          success: r.success,
          error: r.error || null,
          tokensAllocated: r.tokensAllocated || null,
          tier: r.tier || null
        }))
      })
    };

    // Try to insert into a logs table (create if needed)
    const { error } = await supabase
      .from('system_logs')
      .insert(logEntry);

    if (error && error.code === '42P01') {
      // Table doesn't exist, create it
      console.log('📝 Creating system_logs table...');
      await createSystemLogsTable();
      
      // Try again
      const { error: retryError } = await supabase
        .from('system_logs')
        .insert(logEntry);
        
      if (retryError) {
        console.warn('⚠️ Failed to log reset execution after creating table:', retryError);
      }
    } else if (error) {
      console.warn('⚠️ Failed to log reset execution:', error);
    } else {
      console.log('📝 Reset execution logged successfully');
    }

  } catch (error: any) {
    console.warn('⚠️ Error logging reset execution:', error);
    // Don't throw - logging is not critical
  }
}

/**
 * Create system logs table if it doesn't exist
 */
async function createSystemLogsTable(): Promise<void> {
  try {
    const { error } = await supabase.rpc('create_system_logs_table');
    
    if (error) {
      console.warn('⚠️ Could not create system_logs table:', error);
    }
  } catch (error: any) {
    console.warn('⚠️ Error creating system_logs table:', error);
  }
}