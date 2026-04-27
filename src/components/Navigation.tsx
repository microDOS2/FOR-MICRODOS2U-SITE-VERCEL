import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isLandingPage = location.pathname === '/';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter both email and password');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }
      if (data.user) {
        // Fetch role from users table
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role, business_name')
          .eq('id', data.user.id)
          .single();
        if (userError || !userData) {
          toast.error('Failed to retrieve user profile');
          setLoading(false);
          await supabase.auth.signOut();
          return;
        }
        const role = userData.role;
        const name = userData.business_name || email.split('@')[0];
        toast.success(`Welcome back, ${name}!`);
        setLoginOpen(false);
        setEmail('');
        setPassword('');
        // Route based on role
        switch (role) {
          case 'admin':
            navigate('/admin');
            break;
          case 'sales_manager':
            navigate('/sales-manager-dashboard');
            break;
          case 'sales_rep':
            navigate('/sales-rep-dashboard');
            break;
          case 'shipping_fulfillment':
            navigate('/shipping-dashboard');
            break;
          case 'distributor':
            navigate('/distributor-dashboard');
            break;
          case 'influencer':
            navigate('/influencer-dashboard');
            break;
          case 'wholesaler':
          default:
            navigate('/wholesaler-dashboard');
            break;
        }
      }
    } catch {
      toast.error('Login failed. Please try again.');
    }
    setLoading(false);
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsOpen(false);
  };

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled || !isLandingPage
            ? 'bg-[#0a0514]/95 backdrop-blur-md border-b border-white/5'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2">
              <span className="text-2xl font-bold">
                <span className="text-[#44f80c]">micro</span>
                <span className="text-[#9a02d0]">DOS</span>
                <span className="text-[#ff66c4]">(2)</span>
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              {isLandingPage ? (
                <>
                  <button
                    onClick={() => scrollToSection('science')}
                    className="text-gray-300 hover:text-[#9a02d0] transition-colors"
                  >
                    Science
                  </button>
                  <button
                    onClick={() => scrollToSection('dosage')}
                    className="text-gray-300 hover:text-[#9a02d0] transition-colors"
                  >
                    Dosage
                  </button>
                  <button
                    onClick={() => scrollToSection('safety')}
                    className="text-gray-300 hover:text-[#9a02d0] transition-colors"
                  >
                    Safety
                  </button>
                  <button
                    onClick={() => scrollToSection('experience')}
                    className="text-gray-300 hover:text-[#9a02d0] transition-colors"
                  >
                    Experience
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/"
                    className="text-gray-300 hover:text-[#9a02d0] transition-colors"
                  >
                    Home
                  </Link>
                  <Link
                    to="/store-locator"
                    className="text-gray-300 hover:text-[#9a02d0] transition-colors"
                  >
                    Store Locator
                  </Link>
                </>
              )}
            </div>

            {/* Desktop CTA */}
            <div className="hidden md:flex items-center space-x-4">
              <Button
                variant="outline"
                className="border-[#9a02d0] text-[#9a02d0] hover:bg-[#9a02d0]/10"
                onClick={() => setLoginOpen(true)}
              >
                <Lock className="w-4 h-4 mr-2" />
                Login
              </Button>
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden text-white"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden bg-[#0a0514]/95 border-t border-white/5">
            <div className="px-4 py-4 space-y-3">
              {isLandingPage ? (
                <>
                  <button
                    onClick={() => scrollToSection('science')}
                    className="block w-full text-left text-gray-300 hover:text-[#9a02d0]"
                  >
                    Science
                  </button>
                  <button
                    onClick={() => scrollToSection('dosage')}
                    className="block w-full text-left text-gray-300 hover:text-[#9a02d0]"
                  >
                    Dosage
                  </button>
                  <button
                    onClick={() => scrollToSection('safety')}
                    className="block w-full text-left text-gray-300 hover:text-[#9a02d0]"
                  >
                    Safety
                  </button>
                  <button
                    onClick={() => scrollToSection('experience')}
                    className="block w-full text-left text-gray-300 hover:text-[#9a02d0]"
                  >
                    Experience
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/"
                    className="block text-gray-300 hover:text-[#9a02d0]"
                    onClick={() => setIsOpen(false)}
                  >
                    Home
                  </Link>
                  <Link
                    to="/store-locator"
                    className="block text-gray-300 hover:text-[#9a02d0]"
                    onClick={() => setIsOpen(false)}
                  >
                    Store Locator
                  </Link>
                </>
              )}
              <Button
                variant="outline"
                className="w-full border-[#9a02d0] text-[#9a02d0]"
                onClick={() => {
                  setLoginOpen(true);
                  setIsOpen(false);
                }}
              >
                <Lock className="w-4 h-4 mr-2" />
                Login
              </Button>
            </div>
          </div>
        )}
      </nav>

      {/* Login Dialog */}
      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent className="bg-[#150f24] border border-white/10 text-white !z-[9999]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Login to your Account</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleLogin} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="bg-[#0a0514] border-white/10 text-white"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                showLockIcon={false}
                className="bg-[#0a0514] border-white/10 text-white"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#9a02d0] to-[#44f80c] text-white font-semibold"
            >
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in...</> : 'Sign In'}
            </Button>
            <p className="text-center text-sm text-gray-400">
              Don't have an account?{' '}
              <Link
                to="/wholesale-application"
                className="text-[#9a02d0] hover:underline"
                onClick={() => setLoginOpen(false)}
              >
                Apply for Business Account
              </Link>
            </p>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
