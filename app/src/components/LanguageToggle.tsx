import { motion } from "framer-motion";
import { useI18nStore, useTranslations } from "@/lib/i18n";

export function LanguageToggle() {
  const { language, setLanguage } = useI18nStore();
  const { t } = useTranslations();
  const isSpanish = language === "es";

  return (
    <motion.button
      onClick={() => setLanguage(isSpanish ? "en" : "es")}
      className="relative px-3 py-1.5 rounded-full text-sm font-medium transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-[#FACC15] focus:ring-offset-2 focus:ring-offset-transparent"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--gold) 12%, transparent)',
        color: 'var(--gold-text)',
      }}
      aria-label={t.languageToggle.switchTo.replace('{lang}', isSpanish ? t.languageToggle.english : t.languageToggle.spanish)}
      title={t.languageToggle.switchTo.replace('{lang}', isSpanish ? t.languageToggle.english : t.languageToggle.spanish)}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {isSpanish ? "EN" : "ES"}
    </motion.button>
  );
}
