export const CATEGORY_COLORS = {
  musical:     '#FACC15',
  literary:    '#E5A913',
  artistic:    '#C49312',
  audiovisual: '#A37B0F',
  software:    '#D4B82C',
  dramatic:    '#8B6914',
} as const

export const THEME_COLORS = {
  dark: {
    background: {
      primary: "#0A0B0F",
      secondary: "#101218",
      tertiary: "#161922",
    },
    text: {
      primary: "#F4F2EB",
      secondary: "#C9C6BB",
      tertiary: "#8A8779",
      muted: "#5C5A52",
    },
    border: {
      primary: "#232730",
      secondary: "#1A1D25",
    },
    accent: {
      gold: "#FFD23F",
      goldText: "#FFD23F",
      goldLight: "#FDE68A",
      goldDark: "#E0A800",
    },
    status: {
      success: "#1F8A5B",
      warning: "#C68A1A",
      error: "#B23A48",
      info: "#FFD23F",
    },
    category: CATEGORY_COLORS,
  },
  light: {
    background: {
      primary: "#ECECEC",
      secondary: "#F4F4F4",
      tertiary: "#FFFFFF",
    },
    text: {
      primary: "#0A0A0A",
      secondary: "#2A2A2A",
      tertiary: "#5A5A5A",
      muted: "#888888",
    },
    border: {
      primary: "#0A0A0A",
      secondary: "#C8C8C8",
    },
    accent: {
      gold: "#F5C518",
      goldText: "#795600",
      goldLight: "#FACC15",
      goldDark: "#B8860B",
    },
    status: {
      success: "#1F8A5B",
      warning: "#B8860B",
      error: "#B23A48",
      info: "#B8860B",
    },
    category: CATEGORY_COLORS,
  },
} as const

export type ThemeColors = typeof THEME_COLORS
