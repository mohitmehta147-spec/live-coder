import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { supabase } from "@/lib/supabase";

const LiveVisitors = () => {
  const [enabled, setEnabled] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    supabase.from("site_settings").select("value").eq("key", "live_visitors_enabled").single()
      .then(({ data }) => setEnabled(data?.value === "true"));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    // Pseudo live count: stable random based on hour, fluctuates slightly
    const base = 12 + Math.floor(Math.random() * 35);
    setCount(base);
    const interval = setInterval(() => {
      setCount(c => Math.max(8, c + (Math.random() > 0.5 ? 1 : -1) + (Math.random() > 0.85 ? Math.floor(Math.random() * 3) - 1 : 0)));
    }, 4000);
    return () => clearInterval(interval);
  }, [enabled]);

  if (!enabled || count === 0) return null;

  return (
    <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 py-1 rounded-full text-[11px] font-semibold">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
      </span>
      <Eye className="h-3 w-3" />
      <span>{count} viewing now</span>
    </div>
  );
};

export default LiveVisitors;
