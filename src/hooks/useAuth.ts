import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { DBUser, UserRole } from '@/lib/supabase';

const AUTH_CACHE_KEY = 'md2_auth_user';

function getCachedUser(): DBUser | null {
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setCachedUser(user: DBUser | null) {
  if (user) localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(user));
  else localStorage.removeItem(AUTH_CACHE_KEY);
}

export function useAuth() {
  // Don't initialize from cache — always load fresh to prevent stale data
  const [user, setUser] = useState<DBUser | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<typeof supabase.auth.getSession extends () => Promise<{data:{session:infer S}}> ? S : any>(null);

  useEffect(() => {
    let active = true;

    // Helper: clear cache and user state
    const clearUser = () => {
      setUser(null);
      setCachedUser(null);
    };

    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      sessionRef.current = session;

      if (session?.user) {
        // Verify cached user matches current session
        const cached = getCachedUser();
        if (cached && cached.id === session.user.id) {
          setUser(cached);
        }
        loadUser(session.user.id);
      } else {
        clearUser();
        setLoading(false);
      }
    });

    // 2. Listen for auth events — SYNC ONLY, no async here
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      sessionRef.current = session;

      if (event === 'SIGNED_OUT') {
        clearUser();
        setLoading(false);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Always clear on sign-in to prevent showing previous user's data
        clearUser();
        setLoading(true);
      }

      if (session?.user) {
        loadUser(session.user.id);
      } else if (!session && event !== 'SIGNED_OUT') {
        // Transient null state during token refresh — don't clear
      }
    });

    async function loadUser(userId: string) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!active) return;

      if (data) {
        const u = data as DBUser;
        setUser(u);
        setCachedUser(u);
      } else {
        // If user row not found or error, clear stale data
        console.error('[useAuth] loadUser error or no data:', error);
        setUser(null);
        setCachedUser(null);
      }
      setLoading(false);
    }

    return () => {
      active = false;
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
    setCachedUser(null);
  };

  const isAdmin = user?.role === 'admin';

  return { user, loading, signIn, signOut, isAdmin };
}

export type { UserRole };
