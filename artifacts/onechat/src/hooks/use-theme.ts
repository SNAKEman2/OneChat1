import { useState, useEffect } from "react";

export const THEMES = {
  "midnight-void": {
    label: "Midnight Void",
    description: "Deep space dark",
    preview: "#313338",
    surface: "#2B2D31",
  },
  "slate-dusk": {
    label: "Slate Dusk",
    description: "Twilight blue-gray",
    preview: "#2E3148",
    surface: "#272A3D",
  },
  "frost-air": {
    label: "Frost Air",
    description: "Clean and light",
    preview: "#F2F5F9",
    surface: "#FFFFFF",
  },
} as const;

export type ThemeId = keyof typeof THEMES;

const STORAGE_KEY = "onechat-theme";
const DEFAULT_THEME: ThemeId = "midnight-void";

function applyTheme(theme: ThemeId) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
      return stored && stored in THEMES ? stored : DEFAULT_THEME;
    } catch {
      return DEFAULT_THEME;
    }
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = (t: ThemeId) => {
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {}
    applyTheme(t);
    setThemeState(t);
  };

  return { theme, setTheme };
}

export function initTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    const theme = stored && stored in THEMES ? stored : DEFAULT_THEME;
    document.documentElement.setAttribute("data-theme", theme);
  } catch {}
}
