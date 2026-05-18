import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import vi from './locales/vi.json';

const LANG_KEY = 'e7tracker_lang';

const savedLang = localStorage.getItem(LANG_KEY) || 'en';

i18n
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en },
            vi: { translation: vi },
        },
        lng: savedLang,
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false,
        },
    });

// Persist language selection whenever it changes
i18n.on('languageChanged', (lng) => {
    localStorage.setItem(LANG_KEY, lng);
});

export default i18n;
