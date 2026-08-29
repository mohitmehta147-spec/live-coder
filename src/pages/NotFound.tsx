import { useLocation, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const NotFound = () => {
  const location = useLocation();
  const [state, setState] = useState<"checking" | "notfound" | "redirect">("checking");
  const [redirectTo, setRedirectTo] = useState<string>("");

  useEffect(() => {
    const raw = location.pathname.replace(/^\/+/, "").replace(/\/+$/, "");
    // Single-segment slug — could be a legacy WordPress blog URL
    if (!raw || raw.includes("/")) {
      setState("notfound");
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("blogs")
        .select("slug")
        .eq("slug", raw)
        .eq("is_published", true)
        .maybeSingle();
      if (cancelled) return;
      if (data?.slug) {
        setRedirectTo(`/blog/${data.slug}${location.search}`);
        setState("redirect");
      } else {
        console.error("404 Error:", location.pathname);
        setState("notfound");
      }
    })();
    return () => { cancelled = true; };
  }, [location.pathname, location.search]);

  if (state === "redirect" && redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }
  if (state === "checking") {
    return <div className="flex min-h-screen items-center justify-center bg-muted text-muted-foreground">Loading…</div>;
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
