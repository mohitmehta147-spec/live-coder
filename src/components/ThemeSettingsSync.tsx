import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

const hexToHslToken = (hex: string | undefined | null) => {
  if (!hex) return null;
  const normalized = hex.replace("#", "").trim();
  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) return null;
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b); const min = Math.min(r, g, b);
  let h = 0; let s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) { case r: h = (g - b) / d + (g < b ? 6 : 0); break; case g: h = (b - r) / d + 2; break; default: h = (r - g) / d + 4; break; }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

const ThemeSettingsSync = () => {
  useEffect(() => {
    const applyTheme = async () => {
      try {
        const { data } = await supabase.from("site_settings").select("key, value");
        if (!data) return;
        const settings = Object.fromEntries(data.map((row) => [row.key, row.value || ""]));
        const root = document.documentElement;
        const primary = hexToHslToken(settings['primary_color']);
        const secondary = hexToHslToken(settings['secondary_color']);
        const accent = hexToHslToken(settings['accent_color'] || settings['button_color']);
        const topbar = hexToHslToken(settings['topbar_bg_color']);
        const footer = hexToHslToken(settings['footer_bg_color']);
        if (primary) { root.style.setProperty("--primary", primary); root.style.setProperty("--ring", primary); }
        if (secondary) root.style.setProperty("--secondary", secondary);
        if (accent) { root.style.setProperty("--cta-orange", accent); root.style.setProperty("--accent", accent); }
        if (topbar) root.style.setProperty("--topbar-bg", topbar);
        if (footer) root.style.setProperty("--footer-bg", footer);
      } catch {}
    };
    applyTheme();
    const handler = () => applyTheme();
    window.addEventListener("theme-updated", handler);
    return () => window.removeEventListener("theme-updated", handler);
  }, []);
  return null;
};

export default ThemeSettingsSync;
