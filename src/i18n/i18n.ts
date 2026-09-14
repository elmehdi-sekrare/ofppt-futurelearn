import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from './translations/fr.json';
import en from './translations/en.json';

const getInitialLang = (): string => {
  try {
    const saved = localStorage.getItem('language');
    if (saved === 'fr' || saved === 'en') return saved;
  } catch {
    // ignore (SSR / private mode)
  }
  return 'fr';
};

const initialLang = getInitialLang();

if (typeof document !== 'undefined') {
  document.documentElement.lang = initialLang;
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
    },
    lng: initialLang,
    fallbackLng: 'fr',
    interpolation: {
      escapeValue: false,
    },
  });

i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem('language', lng);
  } catch {
    // ignore
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng;
  }
});

export const getDateLocale = (lng?: string) => (lng || i18n.language || 'fr') === 'fr' ? 'fr-FR' : 'en-GB';

export default i18n;
