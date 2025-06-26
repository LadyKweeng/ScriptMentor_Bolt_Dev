import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

Deno.serve(async (req) => {
  try {
    // Verify authorization
    const authHeader = req.headers.get('authorization');
    const apiKey = req.headers.get('x-api-key');
    const expectedApiKey = Deno.env.get('MONTHLY_RESET_API_KEY');
    
    if (!authHeader?.includes('Bearer ') && apiKey !== expectedApiKey) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔄 Triggering monthly reset via external call...');

    // Call the main monthly reset function
    const resetUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/monthly-token-reset`;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const response = await fetch(resetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'x-scheduled': 'true',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        source: 'trigger-function',
        timestamp: new Date().toISOString()
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Reset function failed: ${result.error || 'Unknown error'}`);
    }

    console.log('✅ Monthly reset triggered successfully');

    return Response.json({
      success: true,
      message: 'Monthly reset triggered successfully',
      result: result
    });

  } catch (error: any) {
    console.error('❌ Failed to trigger monthly reset:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to trigger monthly reset',
        details: error.message
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
