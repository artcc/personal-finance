import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import common from './locales/es-ES/common.json';
import foundation from './locales/es-ES/foundation.json';
import errors from './locales/es-ES/errors.json';
import auth from './locales/es-ES/auth.json';
import shell from './locales/es-ES/shell.json';
import workspace from './locales/es-ES/workspace.json';
import security from './locales/es-ES/security.json';
import finance from './locales/es-ES/finance.json';
import accounts from './locales/es-ES/accounts.json';
import sources from './locales/es-ES/sources.json';
import planning from './locales/es-ES/planning.json';
import assets from './locales/es-ES/assets.json';
import data from './locales/es-ES/data.json';

await i18n.use(initReactI18next).init({
  lng: 'es-ES',
  fallbackLng: 'es-ES',
  supportedLngs: ['es-ES'],
  defaultNS: 'common',
  ns: [
    'common',
    'foundation',
    'errors',
    'auth',
    'shell',
    'workspace',
    'security',
    'finance',
    'accounts',
    'sources',
    'planning',
    'assets',
    'data',
  ],
  resources: {
    'es-ES': {
      common,
      foundation,
      errors,
      auth,
      shell,
      workspace,
      security,
      finance,
      accounts,
      sources,
      planning,
      assets,
      data,
    },
  },
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
