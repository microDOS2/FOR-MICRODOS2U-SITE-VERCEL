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

  // Check for hash fragment on mount (Supabase sends token in URL hash)
  useEffect(() => {
    // Supabase sends recovery token as URL hash parameters
    // We handle it automatically when updateUser is called
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
