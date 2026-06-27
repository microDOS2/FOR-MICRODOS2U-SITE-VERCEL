import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter your email');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('send-password-reset', {
      body: {
        email: email.trim(),
        redirectTo: `${window.location.origin}/#/reset-password`,
      },
    });
    if (error || data?.error) {
      toast.error((error?.message || data?.error) || 'Failed to send reset email');
    } else {
      setSent(true);
      toast.success('Password reset email sent! Check your inbox.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0514] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            <span className="text-[#44f80c]">micro</span>
            <span className="text-[#9a02d0]">DOS</span>
            <span className="text-[#ff66c4]">(2)</span>
          </h1>
          <p className="text-gray-400">Account Recovery</p>
        </div>

        <Card className="bg-[#150f24] border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Mail className="w-5 h-5 text-[#9a02d0]" />
              {sent ? 'Check Your Email' : 'Reset Password'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="text-center space-y-4">
                <CheckCircle className="w-12 h-12 text-[#44f80c] mx-auto" />
                <p className="text-gray-300">
                  We sent a password reset link to <strong className="text-white">{email}</strong>
                </p>
                <p className="text-gray-500 text-sm">
                  Click the link in the email to set a new password. If you don't see it, check your spam folder.
                </p>
                <Button
                  onClick={() => navigate('/')}
                  className="bg-[#9a02d0] hover:bg-[#7a01a8] text-white"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-gray-400 text-sm">
                  Enter your account email address and we'll send you a link to reset your password.
                </p>
                <div>
                  <Input
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-[#0a0514] border-white/10 text-white"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4 mr-2" />
                  )}
                  Send Reset Link
                </Button>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="w-full text-center text-sm text-gray-500 hover:text-white transition-colors mt-2"
                >
                  <ArrowLeft className="w-3 h-3 inline mr-1" />
                  Back to login
                </button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
