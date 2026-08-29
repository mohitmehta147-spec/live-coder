import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import AdminLogin from "@/components/admin/AdminLogin";
import AdminDashboard from "@/components/admin/AdminDashboard";

const AdminPage = () => {
  const [session, setSession] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const checkAdmin = async (userSession: any) => {
      if (!isMounted) return;
      const uid = userSession?.user?.id ?? null;
      lastUserIdRef.current = uid;

      if (!uid) {
        setSession(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setSession(userSession);

      try {
        const { data } = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" });
        if (isMounted) setIsAdmin(Boolean(data));
      } catch {
        if (isMounted) setIsAdmin(false);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data: { session: restored } }) => {
      checkAdmin(restored);
    }).catch(() => {
      if (isMounted) { setSession(null); setIsAdmin(false); setLoading(false); }
    });

    // Only react to actual user identity changes. Token refreshes and tab-focus
    // events frequently re-fire SIGNED_IN with the same user — ignore those so
    // the admin view never reloads / flashes white while you copy-paste etc.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      const newUid = newSession?.user?.id ?? null;
      if (event === 'SIGNED_OUT') {
        if (lastUserIdRef.current === null) return;
        checkAdmin(null);
        return;
      }
      if (event === 'SIGNED_IN' && newUid && newUid !== lastUserIdRef.current) {
        setLoading(true);
        checkAdmin(newSession);
      }
    });

    return () => { isMounted = false; subscription.unsubscribe(); };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AdminLogin onLogin={() => {}} />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <div className="bg-card rounded-xl shadow-lg p-8 text-center max-w-md">
          <p className="text-2xl mb-3">🔒</p>
          <h2 className="text-lg font-bold text-foreground mb-2">Access Denied</h2>
          <p className="text-sm text-muted-foreground mb-4">Your account does not have admin privileges.</p>
          <p className="text-xs text-muted-foreground mb-4">Logged in as: {session.user?.email}</p>
          <button onClick={async () => { await supabase.auth.signOut(); }}
            className="bg-destructive text-destructive-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition">
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return <AdminDashboard session={session} />;
};

export default AdminPage;
