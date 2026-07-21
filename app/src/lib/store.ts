import { create } from "zustand";

type Theme = "dark" | "light";
type Density = "spacious" | "balanced" | "dense";
export type IptypeMode = "off" | "subtle" | "loud";

const getStoredDensity = (): Density => {
  if (typeof window === "undefined") return "dense";
  const v = localStorage.getItem("sl_density");
  if (v === "spacious" || v === "balanced" || v === "dense") return v;
  return "dense";
};

const getStoredIptypeMode = (): IptypeMode => {
  if (typeof window === "undefined") return "subtle";
  const v = localStorage.getItem("sl_iptype_mode");
  if (v === "off" || v === "subtle" || v === "loud") return v;
  return "subtle";
};

interface StoreState {
  mouseX: number;
  mouseY: number;
  scrollY: number;
  currentSection: string;
  theme: Theme;
  density: Density;
  iptypeMode: IptypeMode;
  setMouse: (x: number, y: number) => void;
  setScrollY: (y: number) => void;
  setCurrentSection: (section: string) => void;
  setDensity: (density: Density) => void;
  setIptypeMode: (mode: IptypeMode) => void;
  syncWithSystem: () => void;
}

const getSystemTheme = (): Theme => {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "dark";
};

export const useStore = create<StoreState>()((set) => ({
  mouseX: 0,
  mouseY: 0,
  scrollY: 0,
  currentSection: "hero",
  theme: getSystemTheme(),
  density: getStoredDensity(),
  iptypeMode: getStoredIptypeMode(),
  setMouse: (x, y) => set({ mouseX: x, mouseY: y }),
  setScrollY: (y) => set({ scrollY: y }),
  setCurrentSection: (section) => set({ currentSection: section }),
  setDensity: (density) => {
    localStorage.setItem("sl_density", density);
    set({ density });
  },
  setIptypeMode: (mode) => {
    localStorage.setItem("sl_iptype_mode", mode);
    set({ iptypeMode: mode });
  },
  syncWithSystem: () => set({ theme: getSystemTheme() }),
}));

// Keep theme in sync with OS preference
if (typeof window !== "undefined" && window.matchMedia) {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", () => {
    useStore.getState().syncWithSystem();
  });
}
