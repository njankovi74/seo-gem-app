import srConfig from './sr.json';
import enConfig from './en.json';
import plConfig from './pl.json';
import sqConfig from './sq.json';

export interface LanguageConfig {
  code: string;
  bcp47: string;
  name: string;
  nativeName: string;
  flag: string;
  stopWords: string[];
  intentIndicators: {
    informational: string[];
    commercial: string[];
    transactional: string[];
    navigational: string[];
  };
  bannedTokens: string[];
  basicCorpus: string[];
  conceptAssociations: Record<string, string[]>;
  tokenizer: {
    allowedChars: string;
  };
  ui: {
    generateButton: string;
    generatedButton: string;
    workingButton: string;
    loadingTitles: string;
    loadingGenerate: string;
    successMessage: string;
    errorMinLength: string;
    errorSelectTitle: string;
    categories: {
      informativni: string;
      geo_pitanje: string;
      discover_hook: string;
    };
    customLabel: string;
    confirmButton: string;
    regenerateButton: string;
    closeButton: string;
    redoButton: string;
  };
}

const configs: Record<string, LanguageConfig> = {
  sr: srConfig as LanguageConfig,
  en: enConfig as LanguageConfig,
  pl: plConfig as LanguageConfig,
  sq: sqConfig as LanguageConfig,
};

export type SupportedLanguage = 'sr' | 'en' | 'pl' | 'sq';

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['sr', 'en', 'pl', 'sq'];

export function getLanguageConfig(lang?: string): LanguageConfig {
  const code = (lang || 'sr').toLowerCase();
  return configs[code] || configs['sr'];
}

export function isValidLanguage(lang: string): lang is SupportedLanguage {
  return lang in configs;
}

export function detectLanguageFromUrl(url: string): SupportedLanguage {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();

    if (hostname.endsWith('.al') || hostname.includes('balkans.al')) return 'sq';
    if (hostname.endsWith('.pl') || hostname.includes('polska.pl')) return 'pl';
    if (pathname.startsWith('/english')) return 'en';
    return 'sr';
  } catch {
    return 'sr';
  }
}
