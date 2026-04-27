import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, ArrowRight, Loader2, Truck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function ShippingPortal() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter both email and password');
      return;
    }
    setLoading(true);

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError || !authData.user) {
      toast.error('Invalid email or password');
      setLoading(false);
      return;
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, status')
      .eq('id', authData.user.id)
      .single();

    if (userError || !userData) {
      await supabase.auth.signOut();
      toast.error('Account not found');
      setLoading(false);
      return;
    }

    if (userData.role !== 'shipping_fulfillment') {
      await supabase.auth.signOut();
      toast.error('Access denied: shipping/fulfillment account required');
      setLoading(false);
      return;
    }

    if (userData.status !== 'approved') {
      await supabase.auth.signOut();
      toast.error('Account pending approval');
      setLoading(false);
      return;
    }

    toast.success('Welcome back!');
    setLoading(false);
    navigate('/shipping-dashboard');
  };

  return (
    <div className="min-h-screen bg-[#0a0514] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 pt-24">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Link to="/" className="inline-block">
            <span className="text-3xl font-bold text-white">
              micro<span className="text-[#9a02d0]">DOS</span>
              <span className="text-[#44f80c]">(2)</span>
            </span>
          </Link>
          <h2 className="mt-6 text-2xl font-bold text-white">Shipping &amp; Fulfillment</h2>
          <p className="mt-2 text-gray-400">Sign in to access the fulfillment dashboard</p>
        </div>

        <Card className="bg-[#150f24] border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-[#9a02d0]" />
              Fulfillment Sign In
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-300">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    className="pl-10 bg-[#0a0514] border-white/10 text-white placeholder:text-gray-600"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-300">Password</Label>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="bg-[#0a0514] border-white/10 text-white placeholder:text-gray-600"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </>
                )}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <a href="#" className="text-sm text-[#9a02d0] hover:underline">Forgot your password?</a>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#150f24]/50 border-white/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#44f80c]/10 flex items-center justify-center flex-shrink-0">
                <Truck className="w-6 h-6 text-[#44f80c]" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold">Fulfillment Team Access</h3>
                <p className="text-gray-400 text-sm">This portal is for authorized shipping and fulfillment personnel only.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Link to="/" className="text-sm text-gray-500 hover:text-gray-400">← Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
