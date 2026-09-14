import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import common from './locales/es-ES/common.json';
import foundation from './locales/es-ES/foundation.json';
import errors from './locales/es-ES/errors.json';

await i18n.use(initReactI18next).init({
  lng: 'es-ES',
  fallbackLng: 'es-ES',
  supportedLngs: ['es-ES'],
  defaultNS: 'common',
  ns: ['common', 'foundation', 'errors'],
  resources: { 'es-ES': { common, foundation, errors } },
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
