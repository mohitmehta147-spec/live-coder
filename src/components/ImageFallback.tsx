import { useEffect } from "react";

// Some legacy /uploads files are missing on the server (CDN answers 422/404).
// Instead of showing broken-image icons everywhere, swap in the placeholder once.
export default function ImageFallback() {
  useEffect(() => {
    const onError = (e: Event) => {
      const el = e.target as HTMLImageElement | null;
      if (!el || el.tagName !== "IMG") return;
      if (el.dataset.fallbackApplied === "1") return;
      el.dataset.fallbackApplied = "1";
      el.src = "/placeholder.svg";
    };
    window.addEventListener("error", onError, true);
    return () => window.removeEventListener("error", onError, true);
  }, []);
  return null;
}
