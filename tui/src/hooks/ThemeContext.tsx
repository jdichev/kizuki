import React, { createContext, useContext, useState, ReactNode } from "react";
import { execSync } from "node:child_process";
import { TuiTheme } from "../types/index.js";
import {
  WALLSTREET_THEME,
  DEFAULT_THEME,
  THEMES,
} from "../constants/themes.js";

interface ThemeContextType {
  theme: TuiTheme;
  setTheme: (theme: TuiTheme) => void;
  availableThemes: TuiTheme[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const isDarkColorCode = (value: number): boolean => value >= 0 && value <= 6;

const detectDarkMode = (): boolean => {
  const colorFgBg = process.env.COLORFGBG;
  if (colorFgBg) {
    const parts = colorFgBg.split(";");
    const bgRaw = parts[parts.length - 1];
    const bg = Number(bgRaw);
    if (Number.isInteger(bg)) {
      return isDarkColorCode(bg);
    }
  }

  if (process.platform === "darwin") {
    try {
      const output = execSync("defaults read -g AppleInterfaceStyle", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      })
        .trim()
        .toLowerCase();
      return output === "dark";
    } catch {
      return false;
    }
  }

  return false;
};

const getInitialTheme = (): TuiTheme =>
  detectDarkMode() ? WALLSTREET_THEME : DEFAULT_THEME;

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [theme, setTheme] = useState<TuiTheme>(getInitialTheme);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, availableThemes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
