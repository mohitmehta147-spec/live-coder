import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "@tanstack/react-router";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import TopBar from "@/components/TopBar";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Eye, EyeOff, User, Mail, Phone, Lock, LogOut, Package, MapPin, Smartphone, KeyRound } from "lucide-react";

const AuthPage = () => {
  const [mode, setMode] = useState<"login" | "signup" | "otp" | "forgot">("otp");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpPhone, setOtpPhone] = useState("");
  const [otpName, setOtpName] = useState("");
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [smsOtpEnabled, setSmsOtpEnabled] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  const [forgotPhone, setForgotPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // Forgot password OTP states
  const [forgotOtpSent, setForgotOtpSent] = useState(false);
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotOtpVerified, setForgotOtpVerified] = useState(false);
  const [resetToken, setResetToken] = useState<string>("");
  const [forgotOtpCountdown, setForgotOtpCountdown] = useState(0);
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session);
      setCheckingAuth(false);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setCheckingAuth(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // OTP is always enabled - no need to check sms_otp_enabled

  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [otpCountdown]);

  useEffect(() => {
    if (forgotOtpCountdown <= 0) return;
    const timer = setTimeout(() => setForgotOtpCountdown(forgotOtpCountdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [forgotOtpCountdown]);

  // WebOTP API - auto-read SMS OTP on Android Chrome
  useEffect(() => {
    if (!otpSent || !("OTPCredential" in window)) return;
    const ac = new AbortController();
    (navigator.credentials as any).get({
      otp: { transport: ["sms"] },
      signal: ac.signal,
    }).then((cred: any) => {
      if (cred?.code) setOtp(cred.code.replace(/\D/g, '').slice(0, 6));
    }).catch(() => { /* ignore */ });
    return () => ac.abort();
  }, [otpSent]);

  useEffect(() => {
    if (!forgotOtpSent || forgotOtpVerified || !("OTPCredential" in window)) return;
    const ac = new AbortController();
    (navigator.credentials as any).get({
      otp: { transport: ["sms"] },
      signal: ac.signal,
    }).then((cred: any) => {
      if (cred?.code) setForgotOtp(cred.code.replace(/\D/g, '').slice(0, 6));
    }).catch(() => { /* ignore */ });
    return () => ac.abort();
  }, [forgotOtpSent, forgotOtpVerified]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const loginEmail = `${email.replace(/\D/g, '')}@phone.local`;
    const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    if (error) {
      toast({ title: t("Login failed", "लॉगिन विफल"), description: error.message, variant: "destructive" });
    } else {
      try {
        const { logLeadEvent } = await import("@/lib/leadEvents");
        await logLeadEvent({
          event_type: "signin",
          name: (data?.user?.user_metadata as any)?.['full_name'] || "",
          phone: email.replace(/\D/g, ""),
          email: (data?.user?.user_metadata as any)?.email || "",
          user_id: data?.user?.id || null,
          note: "User signed in",
        });
      } catch {}
      toast({ title: t("Welcome back!", "वापस स्वागत है!") });
      navigate({ to: "/" });
    }
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      toast({ title: t("Phone number is required", "फोन नंबर आवश्यक है"), variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: t("Password must be at least 6 characters", "पासवर्ड कम से कम 6 अक्षर होना चाहिए"), variant: "destructive" });
      return;
    }
    setLoading(true);
    const signupEmail = email.trim() || `${phone.replace(/\D/g, '')}@phone.local`;
    const { data, error } = await supabase.auth.signUp({
      email: signupEmail, password,
      options: { data: { full_name: fullName, phone } },
    });
    if (error) {
      toast({ title: t("Signup failed", "साइनअप विफल"), description: error.message, variant: "destructive" });
    } else if (data.session) {
      // Create profile row so this signup shows up in admin leads
      try {
        await (supabase as any).from("profiles").upsert({
          user_id: data.session.user.id, full_name: fullName, phone: phone.replace(/\D/g, ""), email: email.trim() || null,
        } as any, { onConflict: "user_id" });
      } catch {}
      try {
        const { logLeadEvent } = await import("@/lib/leadEvents");
        await logLeadEvent({
          event_type: "signup", name: fullName, phone, email: email.trim(),
          user_id: data.session.user.id, note: "New sign-up",
        });
      } catch {}
      toast({ title: t("Account created! Welcome!", "खाता बना! स्वागत है!") });
      navigate({ to: "/" });
    } else {
      toast({ title: t("Account created! Please check your email to verify.", "खाता बनाया गया! कृपया अपना ईमेल सत्यापित करें।") });
    }
    setLoading(false);
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = otpPhone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      toast({ title: t("Enter valid 10-digit mobile number", "वैध 10 अंकों का मोबाइल नंबर दर्ज करें"), variant: "destructive" });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("send-otp", {
      body: { phone: cleanPhone, purpose: "login" },
    });
    setLoading(false);
    if (error || data?.error) {
      toast({ title: t("Failed to send OTP", "OTP भेजने में विफल"), description: data?.error || error?.message, variant: "destructive" });
    } else {
      setOtpSent(true);
      // Ask for name/email only when the server doesn't already have them
      setIsNewUser(data?.needsProfile ?? !data?.userExists);
      setOtpCountdown(60);
      toast({ title: t("OTP sent to your mobile!", "OTP आपके मोबाइल पर भेजा गया!") });
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast({ title: t("Enter 6-digit OTP", "6 अंकों का OTP दर्ज करें"), variant: "destructive" });
      return;
    }
    if (isNewUser) {
      if (!otpName.trim()) {
        toast({ title: t("Please enter your name", "कृपया अपना नाम दर्ज करें"), variant: "destructive" });
        return;
      }
      if (!otpEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(otpEmail.trim())) {
        toast({ title: t("Please enter a valid email", "कृपया वैध ईमेल दर्ज करें"), variant: "destructive" });
        return;
      }
    }
    setLoading(true);
    const cleanPhone = otpPhone.replace(/\D/g, '').slice(-10);
    const { data, error } = await supabase.functions.invoke("verify-otp", {
      body: {
        phone: cleanPhone, otp, purpose: "login",
        full_name: isNewUser ? otpName.trim() : undefined,
        email: isNewUser ? otpEmail.trim() : undefined,
      },
    });
    
    if (error || data?.error) {
      toast({ title: t("OTP verification failed", "OTP सत्यापन विफल"), description: data?.error || error?.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    if (data?.access_token && data?.refresh_token) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user: data.user,
      });
      if (sessionError) {
        toast({ title: t("Session error", "सेशन त्रुटि"), description: sessionError.message, variant: "destructive" });
      } else {
        // Create profile row for new OTP signups
        try {
          if (isNewUser) {
            const { data: { session: s } } = await supabase.auth.getSession();
            if (s?.user) {
              await (supabase as any).from("profiles").upsert({
                user_id: s.user.id, full_name: otpName.trim(), phone: cleanPhone, email: otpEmail.trim() || null,
              } as any, { onConflict: "user_id" });
            }
          }
        } catch {}
        try {
          const { data: { session: s2 } } = await supabase.auth.getSession();
          const { logLeadEvent } = await import("@/lib/leadEvents");
          await logLeadEvent({
            event_type: isNewUser ? "signup" : "signin",
            name: isNewUser ? otpName.trim() : (s2?.user?.user_metadata as any)?.['full_name'] || "",
            phone: cleanPhone,
            email: isNewUser ? otpEmail.trim() : (s2?.user?.user_metadata as any)?.email || "",
            user_id: s2?.user?.id || null,
            note: isNewUser ? "New sign-up via OTP" : "User signed in via OTP",
          });
        } catch {}
        toast({ title: t("Welcome!", "स्वागत है!") });
        navigate({ to: "/" });
      }
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    toast({ title: t("Logged out successfully", "सफलतापूर्वक लॉगआउट हो गया") });
  };

  // Forgot password: Step 1 - Send OTP
  const handleForgotSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = forgotPhone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      toast({ title: t("Enter valid 10-digit mobile number", "वैध 10 अंकों का मोबाइल नंबर दर्ज करें"), variant: "destructive" });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("send-otp", {
      body: { phone: cleanPhone, purpose: "forgot_password" },
    });
    setLoading(false);
    if (error || data?.error) {
      toast({ title: t("Failed to send OTP", "OTP भेजने में विफल"), description: data?.error || error?.message, variant: "destructive" });
    } else {
      setForgotOtpSent(true);
      setForgotOtpCountdown(60);
      toast({ title: t("OTP sent to your mobile!", "OTP आपके मोबाइल पर भेजा गया!") });
    }
  };

  // Forgot password: Step 2 - Verify OTP
  const handleForgotVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotOtp.length !== 6) {
      toast({ title: t("Enter 6-digit OTP", "6 अंकों का OTP दर्ज करें"), variant: "destructive" });
      return;
    }
    setLoading(true);
    const cleanPhone = forgotPhone.replace(/\D/g, '').slice(-10);
    const { data, error } = await supabase.functions.invoke("verify-otp", {
      body: { phone: cleanPhone, otp: forgotOtp, purpose: "forgot_password" },
    });
    setLoading(false);
    if (error || data?.error) {
      toast({ title: t("Invalid OTP", "अमान्य OTP"), description: data?.error || error?.message, variant: "destructive" });
    } else if (data?.verified) {
      setForgotOtpVerified(true);
      setResetToken(data?.reset_token || "");
      toast({ title: t("OTP verified! Set new password.", "OTP सत्यापित! नया पासवर्ड सेट करें।") });
    }
  };

  // Forgot password: Step 3 - Reset password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ title: t("Password must be at least 6 characters", "पासवर्ड कम से कम 6 अक्षर होना चाहिए"), variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: t("Passwords do not match", "पासवर्ड मेल नहीं खाते"), variant: "destructive" });
      return;
    }
    setLoading(true);
    const cleanPhone = forgotPhone.replace(/\D/g, '').slice(-10);
    const { data, error } = await supabase.functions.invoke("reset-password", {
      body: { phone: cleanPhone, new_password: newPassword, reset_token: resetToken },
    });
    setLoading(false);
    if (error || data?.error) {
      toast({ title: t("Password reset failed", "पासवर्ड रीसेट विफल"), description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: t("Password reset successful! Please login.", "पासवर्ड रीसेट सफल! कृपया लॉगिन करें।") });
      setMode("login");
      setEmail(forgotPhone);
      setForgotPhone(""); setNewPassword(""); setConfirmPassword("");
      setForgotOtpSent(false); setForgotOtp(""); setForgotOtpVerified(false); setResetToken("");
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-background">
        <TopBar /><SiteHeader />
        <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Loading...</div>
        <SiteFooter />
      </div>
    );
  }

  if (session) {
    return (
      <div className="min-h-screen bg-background">
        <TopBar /><SiteHeader />
        <section className="py-12 md:py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-md mx-auto">
              <div className="bg-card rounded-2xl border border-border p-6 md:p-8 shadow-lg text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <User className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-1">{session.user?.user_metadata?.['full_name'] || t("My Account", "मेरा अकाउंट")}</h2>
                <p className="text-sm text-muted-foreground mb-6">{session.user?.email}</p>
                
                <div className="space-y-3">
                  <button onClick={() => navigate({ to: "/my-orders" })} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover:bg-muted transition text-left">
                    <Package className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-semibold">{t("My Orders", "मेरे ऑर्डर")}</p>
                      <p className="text-xs text-muted-foreground">{t("View order history & track orders", "ऑर्डर इतिहास और ट्रैकिंग देखें")}</p>
                    </div>
                  </button>
                  <button onClick={() => navigate({ to: "/track-order" })} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover:bg-muted transition text-left">
                    <MapPin className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-semibold">{t("Track Order", "ऑर्डर ट्रैक करें")}</p>
                      <p className="text-xs text-muted-foreground">{t("Check delivery status", "डिलीवरी स्टेटस चेक करें")}</p>
                    </div>
                  </button>
                </div>

                <button onClick={handleLogout}
                  className="w-full mt-6 flex items-center justify-center gap-2 bg-destructive text-destructive-foreground py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition">
                  <LogOut className="h-4 w-4" />
                  {t("Sign Out", "साइन आउट")}
                </button>
              </div>
            </div>
          </div>
        </section>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <SiteHeader />

      <section className="py-12 md:py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-md mx-auto">
            <div className="text-center mb-4">
              <a href="/contact" className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-primary font-semibold hover:underline">
                {t("Need help? Contact Us →", "मदद चाहिए? संपर्क करें →")}
              </a>
            </div>
            {/* OTP Only - no tabs needed */}

            <div className="bg-card rounded-2xl border border-border p-6 md:p-8 shadow-lg">
              {/* OTP Login */}
              {mode === "otp" && (
                <>
                  <h2 className="text-2xl font-bold text-foreground mb-2 text-center">
                    {t("Mobile OTP Login", "मोबाइल OTP लॉगिन")}
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6 text-center">
                    {t("Login instantly with your mobile number", "अपने मोबाइल नंबर से तुरंत लॉगिन करें")}
                  </p>

                  {!otpSent ? (
                    <form onSubmit={handleSendOtp} className="space-y-4">
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input required value={otpPhone} onChange={(e) => setOtpPhone(e.target.value)} type="tel"
                          placeholder={t("Mobile Number *", "मोबाइल नंबर *")} autoComplete="tel" maxLength={10}
                          className="w-full pl-10 pr-4 py-3 border-2 border-border rounded-xl text-sm focus:outline-none focus:border-primary bg-background" />
                      </div>
                      <button type="submit" disabled={loading}
                        className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-bold text-sm hover:opacity-90 transition disabled:opacity-60">
                        {loading ? t("Sending OTP...", "OTP भेज रहे हैं...") : t("Send OTP", "OTP भेजें")}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyOtp} className="space-y-4">
                      <p className="text-sm text-center text-muted-foreground">
                        {t("OTP sent to", "OTP भेजा गया")} <span className="font-semibold text-foreground">{otpPhone}</span>
                      </p>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="------"
                        className="w-full h-14 text-center text-2xl font-bold tracking-[0.5em] border-2 border-border rounded-xl bg-background focus:border-primary focus:outline-none"
                      />
                      {isNewUser && (
                        <div className="space-y-3 pt-1">
                          <p className="text-xs text-center text-muted-foreground">
                            {t("New here? Please share a few details to create your account.", "नए हैं? खाता बनाने के लिए कुछ विवरण साझा करें।")}
                          </p>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input value={otpName} onChange={(e) => setOtpName(e.target.value)} required
                              placeholder={t("Full Name *", "पूरा नाम *")} autoComplete="name"
                              className="w-full pl-10 pr-4 py-3 border-2 border-border rounded-xl text-sm focus:outline-none focus:border-primary bg-background" />
                          </div>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input type="email" value={otpEmail} onChange={(e) => setOtpEmail(e.target.value)} required
                              placeholder={t("Email Address *", "ईमेल एड्रेस *")} autoComplete="email"
                              className="w-full pl-10 pr-4 py-3 border-2 border-border rounded-xl text-sm focus:outline-none focus:border-primary bg-background" />
                          </div>
                        </div>
                      )}
                      <button type="submit" disabled={loading || otp.length !== 6}
                        className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-bold text-sm hover:opacity-90 transition disabled:opacity-60">
                        {loading ? t("Verifying...", "सत्यापित हो रहा है...") : t("Verify & Login", "सत्यापित करें और लॉगिन करें")}
                      </button>
                      <div className="flex items-center justify-between text-sm">
                        <button type="button" onClick={() => { setOtpSent(false); setOtp(""); }}
                          className="text-primary hover:underline">{t("Change number", "नंबर बदलें")}</button>
                        <button type="button" onClick={handleSendOtp} disabled={otpCountdown > 0 || loading}
                          className="text-primary hover:underline disabled:text-muted-foreground disabled:no-underline">
                          {otpCountdown > 0 ? `${t("Resend in", "पुनः भेजें")} ${otpCountdown}s` : t("Resend OTP", "OTP पुनः भेजें")}
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}

              {/* Email/Password Login */}
              {mode === "login" && (
                <>
                  <h2 className="text-2xl font-bold text-foreground mb-2 text-center">
                    {t("Welcome Back", "वापस स्वागत है")}
                  </h2>
                   <p className="text-sm text-muted-foreground mb-6 text-center">
                    {t("Login with your mobile number & password", "अपने मोबाइल नंबर और पासवर्ड से लॉगिन करें")}
                  </p>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input type="tel" value={email} onChange={(e) => setEmail(e.target.value)}
                        placeholder={t("Mobile Number *", "मोबाइल नंबर *")} autoComplete="tel" required
                        className="w-full pl-10 pr-4 py-3 border-2 border-border rounded-xl text-sm focus:outline-none focus:border-primary bg-background" />
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input required type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                        placeholder={t("Password *", "पासवर्ड *")} minLength={6} autoComplete="current-password"
                        className="w-full pl-10 pr-12 py-3 border-2 border-border rounded-xl text-sm focus:outline-none focus:border-primary bg-background" />
                      <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <button type="submit" disabled={loading}
                      className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-bold text-sm hover:opacity-90 transition disabled:opacity-60">
                      {loading ? t("Please wait...", "कृपया प्रतीक्षा करें...") : t("Login", "लॉगिन")}
                    </button>
                    <div className="text-right">
                      <button type="button" onClick={() => { setMode("forgot"); setForgotOtpSent(false); setForgotOtp(""); setForgotOtpVerified(false); }} className="text-sm text-primary font-semibold hover:underline">
                        {t("Forgot Password?", "पासवर्ड भूल गए?")}
                      </button>
                    </div>
                  </form>
                </>
              )}

              {/* Forgot Password with OTP */}
              {mode === "forgot" && (
                <>
                  <h2 className="text-2xl font-bold text-foreground mb-2 text-center">
                    {t("Reset Password", "पासवर्ड रीसेट करें")}
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6 text-center">
                    {!forgotOtpSent
                      ? t("Enter your mobile number to receive OTP", "OTP प्राप्त करने के लिए मोबाइल नंबर दर्ज करें")
                      : !forgotOtpVerified
                        ? t("Enter the OTP sent to your mobile", "अपने मोबाइल पर भेजा गया OTP दर्ज करें")
                        : t("Set your new password", "नया पासवर्ड सेट करें")}
                  </p>

                  {/* Step 1: Enter phone & send OTP */}
                  {!forgotOtpSent && (
                    <form onSubmit={handleForgotSendOtp} className="space-y-4">
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input required type="tel" value={forgotPhone} onChange={(e) => setForgotPhone(e.target.value)}
                          placeholder={t("Mobile Number *", "मोबाइल नंबर *")} autoComplete="tel" maxLength={10}
                          className="w-full pl-10 pr-4 py-3 border-2 border-border rounded-xl text-sm focus:outline-none focus:border-primary bg-background" />
                      </div>
                      <button type="submit" disabled={loading}
                        className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-bold text-sm hover:opacity-90 transition disabled:opacity-60">
                        {loading ? t("Sending OTP...", "OTP भेज रहे हैं...") : t("Send OTP", "OTP भेजें")}
                      </button>
                    </form>
                  )}

                  {/* Step 2: Verify OTP */}
                  {forgotOtpSent && !forgotOtpVerified && (
                    <form onSubmit={handleForgotVerifyOtp} className="space-y-4">
                      <p className="text-sm text-center text-muted-foreground">
                        {t("OTP sent to", "OTP भेजा गया")} <span className="font-semibold text-foreground">{forgotPhone}</span>
                      </p>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={forgotOtp}
                        onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="------"
                        className="w-full h-14 text-center text-2xl font-bold tracking-[0.5em] border-2 border-border rounded-xl bg-background focus:border-primary focus:outline-none"
                      />
                      <button type="submit" disabled={loading || forgotOtp.length !== 6}
                        className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-bold text-sm hover:opacity-90 transition disabled:opacity-60">
                        {loading ? t("Verifying...", "सत्यापित हो रहा है...") : t("Verify OTP", "OTP सत्यापित करें")}
                      </button>
                      <div className="flex items-center justify-between text-sm">
                        <button type="button" onClick={() => { setForgotOtpSent(false); setForgotOtp(""); }}
                          className="text-primary hover:underline">{t("Change number", "नंबर बदलें")}</button>
                        <button type="button" onClick={handleForgotSendOtp} disabled={forgotOtpCountdown > 0 || loading}
                          className="text-primary hover:underline disabled:text-muted-foreground disabled:no-underline">
                          {forgotOtpCountdown > 0 ? `${t("Resend in", "पुनः भेजें")} ${forgotOtpCountdown}s` : t("Resend OTP", "OTP पुनः भेजें")}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Step 3: Set new password */}
                  {forgotOtpVerified && (
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 text-primary text-sm mb-2">
                        <Smartphone className="h-4 w-4 shrink-0" />
                        {t("Mobile verified:", "मोबाइल सत्यापित:")} <span className="font-semibold">{forgotPhone}</span>
                      </div>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input required type={showPw ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                          placeholder={t("New Password *", "नया पासवर्ड *")} minLength={6} autoComplete="new-password"
                          className="w-full pl-10 pr-12 py-3 border-2 border-border rounded-xl text-sm focus:outline-none focus:border-primary bg-background" />
                        <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input required type={showPw ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder={t("Confirm Password *", "पासवर्ड कन्फर्म करें *")} minLength={6} autoComplete="new-password"
                          className="w-full pl-10 pr-12 py-3 border-2 border-border rounded-xl text-sm focus:outline-none focus:border-primary bg-background" />
                      </div>
                      <button type="submit" disabled={loading}
                        className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-bold text-sm hover:opacity-90 transition disabled:opacity-60">
                        {loading ? t("Please wait...", "कृपया प्रतीक्षा करें...") : t("Reset Password", "पासवर्ड रीसेट करें")}
                      </button>
                    </form>
                  )}

                  <p className="text-xs text-muted-foreground text-center mt-4">
                    <button onClick={() => { setMode("login"); setForgotOtpSent(false); setForgotOtp(""); setForgotOtpVerified(false); }} className="text-primary font-semibold hover:underline">
                      {t("Back to Login", "लॉगिन पर वापस जाएं")}
                    </button>
                  </p>
                </>
              )}

              {/* Signup */}
              {mode === "signup" && (
                <>
                  <h2 className="text-2xl font-bold text-foreground mb-2 text-center">
                    {t("Create Account", "खाता बनाएं")}
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6 text-center">
                    {t("Sign up for exclusive offers & order tracking", "एक्सक्लूसिव ऑफर और ऑर्डर ट्रैकिंग के लिए साइन अप करें")}
                  </p>
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input required value={fullName} onChange={(e) => setFullName(e.target.value)}
                        placeholder={t("Full Name *", "पूरा नाम *")} autoComplete="name"
                        className="w-full pl-10 pr-4 py-3 border-2 border-border rounded-xl text-sm focus:outline-none focus:border-primary bg-background" />
                    </div>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input required value={phone} onChange={(e) => setPhone(e.target.value)} type="tel"
                        placeholder={t("Phone Number *", "फोन नंबर *")} autoComplete="tel"
                        className="w-full pl-10 pr-4 py-3 border-2 border-border rounded-xl text-sm focus:outline-none focus:border-primary bg-background" />
                    </div>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                        placeholder={t("Email Address", "ईमेल एड्रेस")} autoComplete="email"
                        className="w-full pl-10 pr-4 py-3 border-2 border-border rounded-xl text-sm focus:outline-none focus:border-primary bg-background" />
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input required type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                        placeholder={t("Password *", "पासवर्ड *")} minLength={6} autoComplete="new-password"
                        className="w-full pl-10 pr-12 py-3 border-2 border-border rounded-xl text-sm focus:outline-none focus:border-primary bg-background" />
                      <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <button type="submit" disabled={loading}
                      className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-bold text-sm hover:opacity-90 transition disabled:opacity-60">
                      {loading ? t("Please wait...", "कृपया प्रतीक्षा करें...") : t("Create Account", "खाता बनाएं")}
                    </button>
                  </form>
                </>
              )}

              {/* Switch mode links */}
              <p className="text-xs text-muted-foreground text-center mt-6">
                {mode === "signup"
                  ? t("Already have an account?", "पहले से अकाउंट है?")
                  : t("Don't have an account?", "अकाउंट नहीं है?")}
                {" "}
                <button onClick={() => setMode(mode === "signup" ? "login" : "signup")} className="text-primary font-semibold hover:underline">
                  {mode === "signup" ? t("Login", "लॉगिन") : t("Sign Up", "साइन अप")}
                </button>
              </p>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
};

export default AuthPage;
