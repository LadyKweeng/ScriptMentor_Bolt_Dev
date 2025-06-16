// src/components/Auth.tsx - Enhanced with CORS error handling
import React, { useState, useEffect } from 'react';
import { supabase, testSupabaseConnection } from '../utils/supabaseClient';
import { LogIn, AlertTriangle, Wifi, WifiOff, Shield, RefreshCw, ExternalLink, Info } from 'lucide-react';

interface AuthProps {
  onAuthChange: (session: any) => void;
}

const Auth: React.FC<AuthProps> = ({ onAuthChange }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'testing' | 'connected' | 'cors-error' | 'failed'>('unknown');
  const [showCorsHelp, setShowCorsHelp] = useState(false);

  // Test connection on component mount
  useEffect(() => {
    testConnection();
  }, []);

  const testConnection = async () => {
    setIsTestingConnection(true);
    setConnectionStatus('testing');
    
    try {
      const result = await testSupabaseConnection();
      
      if (result.success) {
        setConnectionStatus('connected');
        setError(null);
      } else {
        if (result.error?.message?.includes('CORS') || result.error?.message?.includes('Failed to fetch')) {
          setConnectionStatus('cors-error');
          setShowCorsHelp(true);
        } else {
          setConnectionStatus('failed');
        }
        setError(result.message);
      }
    } catch (error: any) {
      console.error('Connection test error:', error);
      if (error.message?.includes('CORS') || error.message?.includes('Failed to fetch')) {
        setConnectionStatus('cors-error');
        setShowCorsHelp(true);
      } else {
        setConnectionStatus('failed');
      }
      setError(error.message || 'Connection test failed');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      let result;
      
      if (isSignUp) {
        result = await supabase.auth.signUp({
          email,
          password,
        });
      } else {
        result = await supabase.auth.signInWithPassword({
          email,
          password,
        });
      }

      if (result.error) {
        throw result.error;
      }

      if (result.data.session) {
        onAuthChange(result.data.session);
      } else if (isSignUp) {
        setError('Please check your email for confirmation link');
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      
      // Enhanced error handling for CORS issues
      if (error.message?.includes('CORS') || error.message?.includes('Failed to fetch')) {
        setConnectionStatus('cors-error');
        setShowCorsHelp(true);
        setError('Authentication blocked by CORS policy. This is a development environment issue.');
      } else if (error.message?.includes('Invalid login credentials')) {
        setError('Invalid email or password');
      } else if (error.message?.includes('Email not confirmed')) {
        setError('Please check your email and click the confirmation link');
      } else if (error.message?.includes('Too many requests')) {
        setError('Too many attempts. Please wait a moment and try again');
      } else {
        setError(error.message || 'Authentication failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const renderConnectionStatus = () => {
    const statusConfig = {
      unknown: { icon: Wifi, color: 'text-gray-400', text: 'Checking connection...' },
      testing: { icon: RefreshCw, color: 'text-blue-400 animate-spin', text: 'Testing connection...' },
      connected: { icon: Wifi, color: 'text-green-400', text: 'Connected to Supabase' },
      'cors-error': { icon: WifiOff, color: 'text-red-400', text: 'CORS Policy Error' },
      failed: { icon: AlertTriangle, color: 'text-red-400', text: 'Connection Failed' }
    };

    const config = statusConfig[connectionStatus];
    const Icon = config.icon;

    return (
      <div className={`flex items-center gap-2 text-sm ${config.color}`}>
        <Icon className="h-4 w-4" />
        <span>{config.text}</span>
      </div>
    );
  };

  const renderCorsHelp = () => (
    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <Info className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-yellow-400 font-medium mb-2">CORS Policy Issue Detected</h3>
          <p className="text-yellow-300 text-sm mb-3">
            This is a development environment issue. Supabase is blocking requests from this WebContainer URL due to CORS policy.
          </p>
          
          <div className="space-y-2 text-sm">
            <div className="text-yellow-200">
              <strong>Quick Solutions:</strong>
            </div>
            
            <div className="space-y-2 ml-4">
              <div className="flex items-start gap-2">
                <span className="text-yellow-400">•</span>
                <div>
                  <strong>Option 1:</strong> Use a different development environment
                  <div className="text-xs text-yellow-300 mt-1">
                    Download and run locally: <code className="bg-yellow-900/20 px-1 rounded">npm run dev</code>
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <span className="text-yellow-400">•</span>
                <div>
                  <strong>Option 2:</strong> Configure Supabase for development
                  <div className="text-xs text-yellow-300 mt-1">
                    Contact your Supabase admin to add WebContainer domains to allowed origins
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <span className="text-yellow-400">•</span>
                <div>
                  <strong>Option 3:</strong> Use demo mode
                  <div className="text-xs text-yellow-300 mt-1">
                    Continue with mock data for testing (authentication disabled)
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-3 border-t border-yellow-500/20">
            <div className="text-xs text-yellow-300">
              <strong>Technical Details:</strong> WebContainer URLs are dynamic and can't be pre-configured in Supabase CORS settings.
              Current URL: <code className="bg-yellow-900/20 px-1 rounded">{window.location.hostname}</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const handleDemoMode = () => {
    // Create a mock session for demo purposes
    const mockSession = {
      user: {
        id: 'demo-user-12345',
        email: 'demo@example.com',
        created_at: new Date().toISOString()
      },
      access_token: 'demo-token',
      expires_at: Date.now() + (60 * 60 * 1000) // 1 hour
    };
    
    console.log('🎭 Demo mode activated');
    onAuthChange(mockSession);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl p-8 w-full max-w-md border border-slate-700">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="h-8 w-8 text-yellow-400" />
            <h1 className="text-2xl font-bold text-white">ScriptMentor AI</h1>
          </div>
          <p className="text-slate-400">Sign in to access your script library</p>
        </div>

        {/* Connection Status */}
        <div className="mb-6 p-3 bg-slate-700/30 rounded-lg">
          <div className="flex items-center justify-between">
            {renderConnectionStatus()}
            <button
              onClick={testConnection}
              disabled={isTestingConnection}
              className="text-xs px-2 py-1 bg-slate-600 hover:bg-slate-500 disabled:opacity-50 rounded"
            >
              {isTestingConnection ? 'Testing...' : 'Retest'}
            </button>
          </div>
        </div>

        {/* CORS Help */}
        {showCorsHelp && renderCorsHelp()}

        {/* Error Display */}
        {error && !showCorsHelp && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
              <div>
                <p className="text-red-400 font-medium">Authentication Error</p>
                <p className="text-red-300 text-sm mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleAuth} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
              placeholder="Enter your email"
              required
              disabled={connectionStatus === 'cors-error'}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
              placeholder="Enter your password"
              required
              disabled={connectionStatus === 'cors-error'}
            />
          </div>

          <div className="space-y-3">
            <button
              type="submit"
              disabled={isLoading || connectionStatus === 'cors-error'}
              className="w-full flex items-center justify-center gap-2 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              {isLoading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
            </button>

            {connectionStatus === 'cors-error' && (
              <button
                type="button"
                onClick={handleDemoMode}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                <Shield className="h-4 w-4" />
                Continue with Demo Mode
              </button>
            )}
          </div>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-yellow-400 hover:text-yellow-300 text-sm"
            disabled={connectionStatus === 'cors-error'}
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>

        {/* Development Info */}
        {connectionStatus === 'cors-error' && (
          <div className="mt-6 pt-4 border-t border-slate-600">
            <div className="text-center">
              <p className="text-xs text-slate-400 mb-2">Development Environment Detected</p>
              <div className="flex justify-center gap-4 text-xs">
                <a
                  href="https://supabase.com/docs/guides/api/cors"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  CORS Guide
                </a>
                <a
                  href="https://github.com/supabase/supabase/discussions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  Get Help
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Auth;