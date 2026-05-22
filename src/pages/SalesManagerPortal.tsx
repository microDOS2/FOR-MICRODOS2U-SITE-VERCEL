import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Users, Mail, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

export function SalesManagerPortal() {
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
      // Real Supabase auth login
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error('Login failed', { description: error.message });
        setLoading(false);
        return;
      }

      if (data.session) {
        // Verify the user has the sales_manager role
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role,also_rep')
          .eq('id', data.session.user.id)
          .single();

        if (userError) {
          toast.error('Failed to verify role');
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }

        if (userData?.role !== 'sales_manager') {
          toast.error('Access denied', {
            description: 'This portal is for Sales Managers only.',
          });
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }

        // Check if dual-role manager (also a sales rep)
        if (userData?.also_rep) {
          toast.success('Welcome back, Dual-Role Manager!', {
            description: 'Redirecting to your unified dashboard...',
          });
          navigate('/sales-manager-rep-dashboard');
        } else {
          toast.success('Welcome back!', {
            description: 'Redirecting to your dashboard...',
          });
          navigate('/sales-manager-dashboard');
        }
      }
    } catch (err: any) {
      toast.error(err?.message || 'Login failed');
    }

    setLoading(false);
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
            Sales Manager Portal
          </h1>
          <p className="text-gray-400">
            Sign in to manage your sales team
          </p>
        </div>

        {/* Login Card */}
        <Card className="bg-[#150f24] border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-[#9a02d0]" />
              Sales Manager Sign In
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
                    placeholder="you@microdos2.com"
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
