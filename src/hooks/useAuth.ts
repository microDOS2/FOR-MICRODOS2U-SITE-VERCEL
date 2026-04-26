import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { DBUser, UserRole } from '@/lib/supabase';

export function useAuth() {
  const [user, setUser] = useState<DBUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function getSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Try to fetch full user record from users table
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          if (!cancelled) {
            if (error) {
              console.error('[useAuth] users query error:', error);
            }
            if (data) {
              setUser(data as DBUser);
            } else {
              // Fallback: build minimal user from session if users table query fails
              setUser({
                id: session.user.id,
                email: session.user.email || '',
                role: (session.user.user_metadata?.role || '') as UserRole,
                status: 'approved',
                created_at: session.user.created_at || '',
              } as DBUser);
            }
          }
        }
      } catch (err) {
        console.error('[useAuth] getSession failed:', err);
      }
      if (!cancelled) setLoading(false);
    }

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();
        if (!cancelled) {
          if (error) console.error('[useAuth] onAuthStateChange users error:', error);
          if (data) {
            setUser(data as DBUser);
          } else {
            setUser({
              id: session.user.id,
              email: session.user.email || '',
              role: (session.user.user_metadata?.role || '') as UserRole,
              status: 'approved',
              created_at: session.user.created_at || '',
            } as DBUser);
          }
        }
      } else {
        if (!cancelled) setUser(null);
      }
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const isAdmin = user?.role === 'admin';

  return { user, loading, signIn, signOut, isAdmin };
}

export type { UserRole };
