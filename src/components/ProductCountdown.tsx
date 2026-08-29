import { useState, useEffect } from "react";
import { Timer } from "lucide-react";
import { supabase } from "@/lib/supabase";

const getNextSunday = () => {
  const now = new Date();
  const day = now.getDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  const nextSunday = new Date(now);
  nextSunday.setDate(now.getDate() + daysUntilSunday);
  nextSunday.setHours(23, 59, 59, 999);
  return nextSunday;
};

// Shared state across all instances
let cachedEnabled: boolean | null = null;
let fetchPromise: Promise<boolean> | null = null;

const fetchCountdownEnabled = async (): Promise<boolean> => {
  if (cachedEnabled !== null) return cachedEnabled;
  if (fetchPromise) return fetchPromise;
  fetchPromise = (async () => {
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "countdown_enabled")
      .single();
    cachedEnabled = data?.value === "true";
    return cachedEnabled;
  })();
  return fetchPromise;
};

// Reset cache when admin changes it
export const resetCountdownCache = () => { cachedEnabled = null; fetchPromise = null; };

const ProductCountdown = ({ compact = false }: { compact?: boolean }) => {
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0 });
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchCountdownEnabled().then(v => { setEnabled(v); setLoaded(true); });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const update = () => {
      const diff = getNextSunday().getTime() - Date.now();
      if (diff <= 0) return;
      setTimeLeft({
        h: Math.floor(diff / (1000 * 60 * 60)) % 24 + Math.floor(diff / (1000 * 60 * 60 * 24)) * 24,
        m: Math.floor((diff / (1000 * 60)) % 60),
        s: Math.floor((diff / 1000) % 60),
      });
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [enabled]);

  if (!loaded || !enabled) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-1 text-[10px] text-destructive font-semibold">
        <Timer className="h-3 w-3" />
        <span className="tabular-nums">{String(timeLeft.h).padStart(2, "0")}:{String(timeLeft.m).padStart(2, "0")}:{String(timeLeft.s).padStart(2, "0")}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 bg-destructive/10 text-destructive rounded-md px-2 py-1 text-xs font-semibold">
      <Timer className="h-3.5 w-3.5" />
      <span className="tabular-nums">{String(timeLeft.h).padStart(2, "0")}h : {String(timeLeft.m).padStart(2, "0")}m : {String(timeLeft.s).padStart(2, "0")}s</span>
    </div>
  );
};

export default ProductCountdown;