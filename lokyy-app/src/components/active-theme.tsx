import { ReactNode, createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_THEME, ThemeType } from "@/lib/themes";

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : undefined;
}

function readInitialThemeFromCookies(): ThemeType {
  const preset = readCookie("theme_preset") as ThemeType["preset"] | undefined;
  const scale = readCookie("theme_scale") as ThemeType["scale"] | undefined;
  const radius = readCookie("theme_radius") as ThemeType["radius"] | undefined;
  const contentLayout = readCookie("theme_content_layout") as ThemeType["contentLayout"] | undefined;
  return {
    ...DEFAULT_THEME,
    preset: preset ?? DEFAULT_THEME.preset,
    scale: scale ?? DEFAULT_THEME.scale,
    radius: radius ?? DEFAULT_THEME.radius,
    contentLayout: contentLayout ?? DEFAULT_THEME.contentLayout,
  };
}

function setThemeCookie(key: string, value: string | null) {
  if (typeof window === "undefined") return;

  if (!value) {
    document.cookie = `${key}=; path=/; max-age=0; SameSite=Lax; ${window.location.protocol === "https:" ? "Secure;" : ""}`;
  } else {
    document.cookie = `${key}=${value}; path=/; max-age=31536000; SameSite=Lax; ${window.location.protocol === "https:" ? "Secure;" : ""}`;
  }
}

type ThemeContextType = {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ActiveThemeProvider({
  children,
  initialTheme
}: {
  children: ReactNode;
  initialTheme?: ThemeType;
}) {
  const [theme, setTheme] = useState<ThemeType>(() =>
    initialTheme ? initialTheme : readInitialThemeFromCookies()
  );

  useEffect(() => {
    const body = document.body;

    setThemeCookie("theme_radius", theme.radius);
    body.setAttribute("data-theme-radius", theme.radius);

    if (theme.radius != "default") {
      setThemeCookie("theme_preset", theme.radius);
      body.setAttribute("data-theme-radius", theme.radius);
    } else {
      setThemeCookie("theme_preset", null);
      body.removeAttribute("data-theme-radius");
    }

    if (theme.preset != "default") {
      setThemeCookie("theme_preset", theme.preset);
      body.setAttribute("data-theme-preset", theme.preset);
    } else {
      setThemeCookie("theme_preset", null);
      body.removeAttribute("data-theme-preset");
    }

    setThemeCookie("theme_content_layout", theme.contentLayout);
    body.setAttribute("data-theme-content-layout", theme.contentLayout);

    if (theme.scale != "none") {
      setThemeCookie("theme_scale", theme.scale);
      body.setAttribute("data-theme-scale", theme.scale);
    } else {
      setThemeCookie("theme_scale", null);
      body.removeAttribute("data-theme-scale");
    }
  }, [theme.preset, theme.radius, theme.scale, theme.contentLayout]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useThemeConfig() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useThemeConfig must be used within an ActiveThemeProvider");
  }
  return context;
}
