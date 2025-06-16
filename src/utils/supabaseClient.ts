// src/utils/supabaseClient.ts - Enhanced with CORS handling for WebContainer environments
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.');
}

// Enhanced environment detection
const isWebContainer = () => {
  return (
    typeof window !== 'undefined' && 
    (
      window.location.hostname.includes('webcontainer-api.io') ||
      window.location.hostname.includes('local-credentialless') ||
      window.location.hostname.includes('stackblitz') ||
      window.location.hostname.includes('bolt.new')
    )
  );
};

const isDevelopment = () => {
  return (
    import.meta.env.DEV || 
    import.meta.env.MODE === 'development' ||
    isWebContainer()
  );
};

// CORS Proxy configuration for development environments
const CORS_PROXY_URL = 'https://cors-anywhere.herokuapp.com/';
const BACKUP_CORS_PROXY = 'https://api.allorigins.win/raw?url=';

console.log('🌍 Environment Detection:', {
  isDev: isDevelopment(),
  isWebContainer: isWebContainer(),
  hostname: typeof window !== 'undefined' ? window.location.hostname : 'server',
  mode: import.meta.env.MODE
});

// Enhanced Supabase client configuration
const createEnhancedSupabaseClient = () => {
  // For WebContainer environments, we need special handling
  if (isWebContainer()) {
    console.log('🔧 WebContainer detected - applying CORS workarounds');
    
    // Option 1: Try with modified fetch that handles CORS
    const customFetch = async (url: string | URL | Request, options?: RequestInit) => {
      try {
        // First, try the normal fetch
        return await fetch(url, options);
      } catch (error: any) {
        // If CORS error, try with a proxy (only for development)
        if (error.message?.includes('CORS') || error.message?.includes('Failed to fetch')) {
          console.log('🔄 CORS error detected, attempting proxy solution...');
          
          const urlString = url.toString();
          
          // Don't proxy non-Supabase URLs
          if (!urlString.includes('.supabase.co')) {
            throw error;
          }
          
          try {
            // Try with allorigins proxy (more reliable than cors-anywhere)
            const proxyUrl = `${BACKUP_CORS_PROXY}${encodeURIComponent(urlString)}`;
            const proxyResponse = await fetch(proxyUrl, {
              ...options,
              headers: {
                ...options?.headers,
                'X-Requested-With': 'XMLHttpRequest'
              }
            });
            
            if (proxyResponse.ok) {
              console.log('✅ Proxy request successful');
              return proxyResponse;
            }
          } catch (proxyError) {
            console.warn('❌ Proxy request failed:', proxyError);
          }
        }
        
        throw error;
      }
    };

    return createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        fetch: customFetch
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }

  // Standard configuration for other environments
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
};

// Create the enhanced Supabase client
export const supabase = createEnhancedSupabaseClient();

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
        isDev: isDevelopment(),
        isWebContainer: isWebContainer(),
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