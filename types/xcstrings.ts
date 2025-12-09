/**
 * Xcode Localizable.xcstrings 파일 구조 타입 정의
 */

export interface StringUnit {
  state: "translated" | "new" | "stale";
  value: string;
}

export interface Localization {
  stringUnit: StringUnit;
  comment?: string;
}

export interface StringEntry {
  localizations?: Record<string, Localization>;
  comment?: string;
  extractionState?: string;
}

export interface XCStrings {
  sourceLanguage: string;
  strings: Record<string, StringEntry>;
  version: string;
}

/**
 * 언어별 JSON 구조 (기본 언어 기준으로 생성)
 */
export interface LanguageTranslation {
  locale: string;
  sourceLanguage: string;
  info: {
    sourceText: string;
    comment?: string;
  };
  originalTranslations?: Record<string, string>; // 원본 xcstrings 파일에 있던 번역
  additionalTranslations?: Record<string, string>; // 새로 번역한 추가 번역
}

/**
 * 병합된 번역 데이터
 */
export interface MergedTranslationData {
  sourceLanguage: string;
  languages: Record<string, LanguageTranslation>;
}

