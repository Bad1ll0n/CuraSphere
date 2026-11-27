/**
 * UX-07 — i18n na app móvel: o idioma segue o do telemóvel (português por omissão).
 * Os textos estão em src/locales/{pt,en}.json; o teste i18n.spec.ts garante que as duas
 * línguas têm as mesmas chaves.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import pt from '../locales/pt.json';
import en from '../locales/en.json';

export const IDIOMAS = ['pt', 'en'] as const;

/** 'en' só se o telemóvel estiver em inglês; tudo o resto fica em português. */
export function idiomaDoDispositivo(): (typeof IDIOMAS)[number] {
  try {
    return getLocales()[0]?.languageCode === 'en' ? 'en' : 'pt';
  } catch {
    return 'pt';
  }
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: { pt: { translation: pt }, en: { translation: en } },
    lng: idiomaDoDispositivo(),
    fallbackLng: 'pt',
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

export default i18n;
