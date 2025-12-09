/**
 * 번역 관련 타입 정의
 */

export type TranslationProvider = 
  | "google-translator" // @iamtraction/google-translate (무료, 비공식)
  | "google-cloud" // @google-cloud/translate (공식 API)
  | "deepl"
  | "openai"
  | "claude";

export interface TranslationRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  provider: TranslationProvider;
  apiKey?: string;
  options?: {
    preservePlaceholders?: boolean;
    preserveLineBreaks?: boolean;
  };
}

export interface TranslationResponse {
  translatedText: string;
  provider: TranslationProvider;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface TranslationStatus {
  locale?: string; // LanguageInfo에서만 사용
  translated: number; // 원본 번역 수
  additional: number; // 추가 번역 수 (원본에 포함된 키만)
  total: number;
  percentage: number; // (원본 + 추가) / 전체 * 100
  pending: number; // 번역 대기 중인 항목 수
}

export interface LanguageInfo {
  name: string;
  locale: string;
  status: TranslationStatus;
  isSelected: boolean;
}

