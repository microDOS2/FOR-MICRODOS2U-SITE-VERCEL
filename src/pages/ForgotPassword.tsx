import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/#/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success('Password reset link sent!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send reset link');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0514] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black tracking-tight">
            <span className="text-[#44f80c]">micro</span>
            <span className="text-[#9a02d0]">DOS</span>
            <span className="text-[#ff66c4]">(2)</span>
          </h1>
          <p className="text-gray-400 mt-2">Password Recovery</p>
        </div>

        <Card className="bg-[#150f24] border-white/10">
          <CardHeader className="pb-4">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Mail className="w-5 h-5 text-[#9a02d0]" />
              {sent ? 'Check Your Email' : 'Forgot Password'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="text-center space-y-4">
                <CheckCircle className="w-12 h-12 text-[#44f80c] mx-auto" />
                <p className="text-gray-300">
                  A password reset link has been sent to <strong className="text-white">{email}</strong>.
                </p>
                <p className="text-sm text-gray-500">
                  Please check your inbox and follow the instructions to reset your password.
                </p>
                <Button
                  variant="outline"
                  className="border-white/10 text-gray-300 hover:text-white hover:bg-white/5"
                  onClick={() => { setSent(false); setEmail(''); }}
                >
                  Send to another email
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-300">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your registered email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-[#0a0514] border-white/10 text-white placeholder:text-gray-600"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-[#9a02d0] to-[#ff66c4] text-white font-semibold"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Send Reset Link
                </Button>
              </form>
            )}

            <div className="mt-4 text-center">
              <Link
                to="/admin-portal"
                className="text-sm text-[#9a02d0] hover:text-[#ff66c4] inline-flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="w-3 h-3" />
                Back to Login
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
