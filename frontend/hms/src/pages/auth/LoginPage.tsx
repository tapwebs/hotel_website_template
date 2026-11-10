import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Lock, User, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isInitialized, isLoading, error, initializeSession } = useAuthStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Check if session is already active
  useEffect(() => {
    if (!isInitialized) {
      initializeSession();
    }
  }, [isInitialized, initializeSession]);

  useEffect(() => {
    if (isAuthenticated) {
      const destination = (location.state as any)?.from || '/app';
      navigate(destination, { replace: true });
    }
  }, [isAuthenticated, navigate, location.state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!username.trim() || !password) {
      setFormError('Please enter both username/email and password.');
      return;
    }

    const success = await login(username.trim(), password);
    if (success) {
      const destination = (location.state as any)?.from || '/app';
      navigate(destination, { replace: true });
    }
  };

  return (
    <div className="min-h-screen on-dark bg-[linear-gradient(165deg,var(--color-burgundy-deep)_0%,var(--color-walnut)_58%,var(--color-ink)_100%)] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden select-none">
      {/* Subtle luxury ambient glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-gold/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 right-1/4 w-80 h-80 bg-burgundy/30 rounded-full blur-2xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-8">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto size-[72px] rounded-full ring-2 ring-gold/70 bg-burgundy-deep/80 shadow-lg shadow-black/30 mb-2 flex items-center justify-center">
            <span className="font-display text-2xl font-bold tracking-wider text-gold">TM</span>
          </div>
          <h1 className="font-display text-4xl font-semibold text-ivory tracking-tight">
            TapMenu
          </h1>
          <p className="text-xs uppercase tracking-[0.2em] text-gold-soft font-semibold">
            Hotel Management System • Staff Portal
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-ivory/95 backdrop-blur-md border border-gold/50 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 text-walnut">
          <div className="border-b border-border pb-4">
            <h2 className="font-display text-2xl font-semibold text-burgundy-deep">Staff sign in</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Enter your operational credentials to access property systems
            </p>
          </div>

          {(error || formError) && (
            <div className="flex items-start gap-3 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{formError || error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-walnut mb-1.5">
                Username or Staff Email
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username or staff email"
                  className="w-full bg-ivory border border-input rounded-md pl-10 pr-4 py-2.5 text-sm text-walnut placeholder-muted-foreground/70 focus:outline-none focus:border-burgundy focus:ring-2 focus:ring-burgundy/30 transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-walnut mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-ivory border border-input rounded-md pl-10 pr-4 py-2.5 text-sm text-walnut placeholder-muted-foreground/70 focus:outline-none focus:border-burgundy focus:ring-2 focus:ring-burgundy/30 transition-colors"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="gold"
              disabled={isLoading}
              className="w-full py-2.5 text-xs font-semibold shadow-md"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Authenticating...
                </>
              ) : (
                <>
                  Sign In to HMS <ArrowRight className="w-4 h-4 ml-1.5" />
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
