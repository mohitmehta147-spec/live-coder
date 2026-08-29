import { useEffect, useRef, useState } from "react";

type Props = {
  value: string | number;
  duration?: number;
  className?: string;
};

/**
 * Animate a numeric value from 0 up to the target when it scrolls into view.
 * Preserves any non-numeric prefix/suffix from the original value (e.g. "20L+", "₹50,000", "98%").
 */
const CountUp = ({ value, duration = 1800, className }: Props) => {
  const raw = String(value ?? "");
  const match = raw.match(/^(\D*)([\d.,]+)(.*)$/);
  const prefix = match?.[1] ?? "";
  const numStr = match?.[2] ?? "";
  const suffix = match?.[3] ?? "";
  const target = parseFloat(numStr.replace(/,/g, "")) || 0;
  const hasNumber = !!match && target > 0;

  const [display, setDisplay] = useState(hasNumber ? 0 : target);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!hasNumber || !ref.current) return;
    const el = ref.current;
    const start = () => {
      if (started.current) return;
      started.current = true;
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setDisplay(target * eased);
        if (p < 1) requestAnimationFrame(tick);
        else setDisplay(target);
      };
      requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && start()),
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [target, duration, hasNumber]);

  if (!hasNumber) return <span className={className}>{raw}</span>;
  const isInt = !numStr.includes(".");
  const shown = isInt ? Math.round(display).toLocaleString("en-IN") : display.toFixed(1);
  return <span ref={ref} className={className}>{prefix}{shown}{suffix}</span>;
};

export default CountUp;
