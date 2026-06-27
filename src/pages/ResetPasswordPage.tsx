import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { KeyRound, ArrowLeft, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Process auth callback params from URL on mount
  // Supabase sends recovery tokens in the URL after redirect
  useEffect(() => {
    const handleAuthCallback = async () => {
      // Check both query string and hash fragment for auth params
      // With HashRouter, tokens may be in: #/reset-password?access_token=xxx...
      const hash = window.location.hash
      const search = window.location.search
      const hasAuthParams = hash.includes('access_token=') || hash.includes('error=') ||
                            search.includes('access_token=') || search.includes('error=')

      if (!hasAuthParams) return

      // Try to get session (Supabase client auto-detects tokens in URL)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        console.error('[ResetPassword] Session error:', sessionError)
        // Extract error from URL
        const params = new URLSearchParams(search)
        const hashParams = new URLSearchParams(hash.split('?')[1] || '')
        const errorDesc = params.get('error_description') || hashParams.get('error_description') ||
                          params.get('error') || hashParams.get('error')
        if (errorDesc) {
          setError(decodeURIComponent(errorDesc).replace(/[+]/g, ' '))
        }
        return
      }

      if (!session) {
        // Tokens might be in hash but not yet processed
        // Wait a moment and retry
        setTimeout(async () => {
          const { data: { session: retrySession } } = await supabase.auth.getSession()
          if (!retrySession) {
            setError('Invalid or expired reset link. Please request a new one.')
          }
        }, 500)
      }
    }

    handleAuthCallback()
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    // Ensure we have a session before updating password
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setError('Your reset session has expired. Please request a new password reset link.')
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });
    if (updateError) {
      setError(updateError.message || 'Failed to reset password');
      toast.error(updateError.message || 'Failed to reset password');
    } else {
      setDone(true);
      toast.success('Password updated successfully!');
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
          <p className="text-gray-400">Set New Password</p>
        </div>

        <Card className="bg-[#150f24] border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-[#9a02d0]" />
              {done ? 'Password Updated' : 'Create New Password'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {done ? (
              <div className="text-center space-y-4">
                <CheckCircle className="w-12 h-12 text-[#44f80c] mx-auto" />
                <p className="text-gray-300">
                  Your password has been updated successfully.
                </p>
                <Button
                  onClick={() => navigate('/')}
                  className="bg-[#9a02d0] hover:bg-[#7a01a8] text-white"
                >
                  Go to Login
                </Button>
              </div>
            ) : error && error.includes('token') ? (
              <div className="text-center space-y-4">
                <AlertTriangle className="w-12 h-12 text-orange-400 mx-auto" />
                <p className="text-gray-300">{error}</p>
                <Button
                  onClick={() => navigate('/forgot-password')}
                  className="bg-[#9a02d0] hover:bg-[#7a01a8] text-white"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Request New Link
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-gray-400 text-sm">
                  Enter your new password below.
                </p>
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">New Password</label>
                  <Input
                    type="password"
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-[#0a0514] border-white/10 text-white"
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Confirm Password</label>
                  <Input
                    type="password"
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                    <KeyRound className="w-4 h-4 mr-2" />
                  )}
                  Update Password
                </Button>
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="w-full text-center text-sm text-gray-500 hover:text-white transition-colors mt-2"
                >
                  <ArrowLeft className="w-3 h-3 inline mr-1" />
                  Back
                </button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
