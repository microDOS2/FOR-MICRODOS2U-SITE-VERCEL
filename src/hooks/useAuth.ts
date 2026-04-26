import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { DBUser, UserRole } from '@/lib/supabase';

export function useAuth() {
  const [user, setUser] = useState<DBUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let resolved = false;

    async function getSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
          if (error) {
            console.error('[useAuth] users query error:', error);
          }
          if (data) {
            setUser(data as DBUser);
          }
        }
      } catch (err) {
        console.error('[useAuth] getSession failed:', err);
      }
      resolved = true;
      setLoading(false);
    }

    // Safety timeout: always resolve loading within 5 seconds
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        console.warn('[useAuth] Timeout: forcing loading=false');
        setLoading(false);
      }
    }, 5000);

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        if (error) console.error('[useAuth] onAuthStateChange users error:', error);
        if (data) setUser(data as DBUser);
      } else {
        setUser(null);
      }
      resolved = true;
      setLoading(false);
    });

    return () => {
      clearTimeout(timeoutId);
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
