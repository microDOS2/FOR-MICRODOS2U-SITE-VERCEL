import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

interface RequireAuthProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  fallback?: React.ReactNode;
}

export function RequireAuth({ children, allowedRoles, fallback }: RequireAuthProps) {
  const [session, setSession] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;
    async function checkAuth() {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(s);
      if (s?.user?.id) {
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', s.user.id)
          .single();
        if (mounted) setUserRole(userData?.role || null);
      }
      if (mounted) setLoading(false);
    }
    checkAuth();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0514] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#9a02d0]" />
      </div>
    );
  }

  if (!session) {
    if (fallback) return <>{fallback}</>;
    return <Navigate to="/" state={{ from: location.pathname }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(userRole || '')) {
    return <Navigate to="/products" replace />;
  }

  return <>{children}</>;
}
