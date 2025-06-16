// src/utils/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.');
}

// Create the Supabase client
export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

// Test connection function
export const testSupabaseConnection = async () => {
  try {
    console.log('🔍 Testing Supabase connection...');
    
    // Test 1: Check if client is initialized
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }
    
    // Test 2: Try to get session (this tests auth endpoint)
    const { data: session, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError && !sessionError.message.includes('Auth session missing')) {
      console.warn('⚠️ Session check warning:', sessionError);
    } else {
      console.log('✅ Auth endpoint accessible');
    }
    
    // Test 3: Try a simple database query (if authenticated)
    if (session?.session) {
      try {
        const { data, error } = await supabase
          .from('scripts')
          .select('id')
          .limit(1);
        
        if (error && !error.message.includes('permission denied')) {
          console.warn('⚠️ Database query warning:', error);
        } else {
          console.log('✅ Database endpoint accessible');
        }
      } catch (dbError) {
        console.warn('⚠️ Database test failed (may be normal if not authenticated):', dbError);
      }
    }
    
    return {
      success: true,
      message: 'Supabase connection test completed',
      environment: {
        isDev: import.meta.env.DEV,
        hasSession: !!session?.session
      }
    };
    
  } catch (error: any) {
    console.error('❌ Supabase connection test failed:', error);
    return {
      success: false,
      message: error.message || 'Connection test failed',
      error: error
    };
  }
};