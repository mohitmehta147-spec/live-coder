import { useState } from "react";
import { supabase } from "@/lib/supabase";

const AdminLogin = ({ onLogin }: { onLogin: () => void }) => {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    // Support both email and mobile login
    let loginEmail = identifier.trim();
    if (/^\d{10}$/.test(loginEmail.replace(/\D/g, "").slice(-10))) {
      const cleanPhone = loginEmail.replace(/\D/g, "").slice(-10);
      loginEmail = `${cleanPhone}@phone.local`;
    }
    
    const { error: authError } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-primary rounded-lg flex items-center justify-center mx-auto mb-3">
            <span className="text-primary-foreground text-2xl">🌿</span>
          </div>
          <h1 className="text-xl font-bold text-foreground">VedicUpchar Admin</h1>
          <p className="text-sm text-muted-foreground">Sign in to manage your store</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" placeholder="Email or Mobile Number" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoComplete="email" name="email"
            className="w-full px-4 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" name="password"
            className="w-full px-4 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold text-sm hover:opacity-90 transition disabled:opacity-50">
            {loading ? "Please wait..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
