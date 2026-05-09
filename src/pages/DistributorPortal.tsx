import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Building2, Mail, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

export function DistributorPortal() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('Please enter both email and password');
      return;
    }

    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.user) {
        toast.error(authError?.message || 'Invalid email or password');
        setLoading(false);
        return;
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role, status')
        .eq('id', authData.user.id)
        .single();

      if (userError || !userData) {
        toast.error('Account not found in distributor database');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      const allowedRoles = ['distributor', 'admin'];
      if (!allowedRoles.includes(userData.role)) {
        toast.error(`Access denied. Your role (${userData.role}) cannot access the distributor portal.`);
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      if (userData.status === 'pending') {
        toast.error('Your account is pending approval. Please contact admin.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      if (rememberMe) {
        await supabase.auth.setSession({
          access_token: authData.session!.access_token,
          refresh_token: authData.session!.refresh_token,
        });
      }

      toast.success('Welcome back!', {
        description: 'Redirecting to your dashboard...',
      });

      setLoading(false);
      navigate('/distributor-dashboard');
    } catch (err: any) {
      toast.error(err?.message || 'Login failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0514] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <span className="text-[#44f80c] font-bold text-3xl">micro</span>
            <span className="text-[#9a02d0] font-bold text-3xl">DOS</span>
            <span className="text-[#ff66c4] font-bold text-3xl">(2)</span>
          </Link>
          <h1 className="text-2xl font-bold text-white mb-2">
            Distributor Portal
          </h1>
          <p className="text-gray-400">
            Sign in to access your wholesale account
          </p>
        </div>

        {/* Login Card */}
        <Card className="bg-[#150f24] border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#9a02d0]" />
              Distributor Sign In
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-300">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-[#0a0514] border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-[#9a02d0]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-300">
                  Password
                </Label>
                <PasswordInput
                  id="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-[#0a0514] border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-[#9a02d0]"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    className="border-white/20 data-[state=checked]:bg-[#9a02d0] data-[state=checked]:border-[#9a02d0]"
                  />
                  <Label htmlFor="remember" className="text-gray-400 text-sm cursor-pointer">
                    Remember me
                  </Label>
                </div>
                <Link
                  to="/forgot-password"
                  className="text-sm text-[#9a02d0] hover:text-[#ff66c4] transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white hover:opacity-90"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-white/10 text-center">
              <p className="text-gray-400 text-sm">
                Don't have a distributor account?{' '}
                <Link
                  to="/wholesale-application"
                  className="text-[#9a02d0] hover:text-[#ff66c4] transition-colors"
                >
                  Apply here
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Back to Home */}
        <div className="text-center mt-6">
          <Link
            to="/"
            className="text-gray-400 hover:text-white transition-colors text-sm"
          >
            ← Back to microDOS(2) Home
          </Link>
        </div>
      </div>
    </div>
  );
}
