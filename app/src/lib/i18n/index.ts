import { create } from "zustand";
import { persist } from "zustand/middleware";
import { translations } from "./translations";
import type { Language, TranslationKeys } from "./translations";

interface I18nState {
  language: Language;
  isAutoDetected: boolean;
  setLanguage: (lang: Language) => void;
  detectLanguage: () => void;
}

// Cookie helpers for cross-subdomain language sync
const COOKIE_DOMAIN = ".soft.law";
const COOKIE_MAX_AGE = 31536000; // 1 year

const getLangFromCookie = (): Language | null => {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/softlaw-lang=(en|es)/);
  return match ? (match[1] as Language) : null;
};

const setLangCookie = (lang: Language) => {
  if (typeof document === "undefined") return;
  document.cookie = `softlaw-lang=${lang}; domain=${COOKIE_DOMAIN}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
};

// Detect language from browser settings
const detectLanguageFromBrowser = (): Language => {
  if (typeof navigator === "undefined") return "en";
  const browserLang = navigator.language;

  // If browser language is Spanish, use Spanish
  if (browserLang?.startsWith("es")) {
    return "es";
  }

  // Default to English
  return "en";
};

// Priority: Cookie > Browser detection
const getInitialLanguage = (): Language => {
  const cookieLang = getLangFromCookie();
  if (cookieLang) return cookieLang;
  return "en"; // Default, will be overridden by detectLanguage()
};

export const useI18nStore = create<I18nState>()(
  persist(
    (set, get) => ({
      language: getInitialLanguage(),
      isAutoDetected: !!getLangFromCookie(),

      setLanguage: (lang) => {
        setLangCookie(lang);
        set({ language: lang });
      },

      detectLanguage: () => {
        // Only auto-detect if no cookie preference exists
        if (!get().isAutoDetected && !getLangFromCookie()) {
          const detectedLang = detectLanguageFromBrowser();
          setLangCookie(detectedLang);
          set({ language: detectedLang, isAutoDetected: true });
        }
      },
    }),
    {
      name: "softlaw-app-i18n",
      partialize: (state) => ({
        language: state.language,
        isAutoDetected: state.isAutoDetected,
      }),
    }
  )
);

// Hook to get translations
export function useTranslations() {
  const { language, setLanguage } = useI18nStore();
  const t = translations[language];

  return {
    t,
    language,
    setLanguage,
    isSpanish: language === "es",
    isEnglish: language === "en",
  };
}

// Export translations for direct access
export { translations };
export type { Language, TranslationKeys };
