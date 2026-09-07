import { useState, useEffect } from "react";
import { Timer } from "lucide-react";
import { useCountdownDiscount, isDiscountActive, isProductDiscounted } from "@/hooks/use-countdown-discount";

const getNextSunday = () => {
  const now = new Date();
  const day = now.getDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  const nextSunday = new Date(now);
  nextSunday.setDate(now.getDate() + daysUntilSunday);
  nextSunday.setHours(23, 59, 59, 999);
  return nextSunday;
};

/**
 * Sale countdown timer — admin ke "Countdown Discount" setting se chalta hai.
 * endsAt set hai to wahi, warna agla Sunday 23:59 fallback.
 * `product` dene par sirf us card pe dikhta hai jispe discount lag raha hai.
 */
const ProductCountdown = ({ compact = false, product }: { compact?: boolean; product?: any }) => {
  const cfg = useCountdownDiscount();
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0 });

  const active = isDiscountActive(cfg) && (product ? isProductDiscounted(cfg, product) : true);
  const endTime = cfg.endsAt ? new Date(cfg.endsAt).getTime() : getNextSunday().getTime();

  useEffect(() => {
    if (!active) return;
    const update = () => {
      const diff = endTime - Date.now();
      if (diff <= 0) { setTimeLeft({ h: 0, m: 0, s: 0 }); return; }
      setTimeLeft({
        h: Math.floor(diff / (1000 * 60 * 60)),
        m: Math.floor((diff / (1000 * 60)) % 60),
        s: Math.floor((diff / 1000) % 60),
      });
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [active, endTime]);

  if (!active || (timeLeft.h + timeLeft.m + timeLeft.s) <= 0) return null;

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

// Admin preview ke liye cache reset ab zaroori nahi — hook khud 30s TTL rakhta hai.
export const resetCountdownCache = () => {};
