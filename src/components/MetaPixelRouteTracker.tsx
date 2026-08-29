import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";

declare global {
  interface Window { fbq?: (...args: any[]) => void }
}

// Fires Meta Pixel PageView on every client-side route change.
// Initial PageView is fired by the inline snippet in index.html.
const MetaPixelRouteTracker = () => {
  const location = useLocation();
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.fbq !== "function") return;
    // Skip the very first mount — index.html already tracked it
    const w = window as any;
    if (!w.__fbqInitialPageviewSkipped) { w.__fbqInitialPageviewSkipped = true; return; }
    window.fbq("track", "PageView");
  }, [location.pathname, location.search]);
  return null;
};

export default MetaPixelRouteTracker;
