import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import enUs from './locales/en-us.json';
import zhCn from './locales/zh-cn.json';

const option = {
  fallbackLng: 'zh-cn',
  debug: process.env.NODE_ENV !== 'production',
  resources: {
    'en-US': {
      translation: enUs,
    },
    'zh-CN': {
      translation: zhCn,
    },
  },
  interpolation: {
    escapeValue: false, // not needed for react!!
  },
};
i18n.use(LanguageDetector).use(initReactI18next).init(option);

export default i18n;
