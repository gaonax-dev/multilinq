/**
 * localStorage 작업 데이터 관리 유틸리티
 */

import type { LanguageTranslation } from "@/types/xcstrings";

const STORAGE_KEYS = {
  ORIGINAL_WORK: "multilinq_original_work", // 원본 번역 (xcstrings 파일에서 읽어온 것)
  ADDITIONAL_WORK: "multilinq_additional_work", // 추가 번역 (앱에서 생성한 것)
  CURRENT_WORK: "multilinq_current_work", // 하위 호환성 (원본+추가 합산)
  SELECTED_LANGUAGES: "multilinq_selected_languages",
  UNUSED_TRANSLATIONS: "multilinq_unused_translations",
  ORIGINAL_XCSTRINGS: "multilinq_original_xcstrings",
  OPENAI_SUPPORTED_LANGUAGES: "multilinq_openai_supported_languages", // OpenAI 지원 언어 목록
  CLAUDE_SUPPORTED_LANGUAGES: "multilinq_claude_supported_languages", // Claude 지원 언어 목록
  TRANSLATION_API_KEYS: "multilinq_translation_api_keys", // 번역 API 키들 (provider별)
  TRANSLATION_PROVIDER: "multilinq_translation_provider", // 번역 제공자 선택값
} as const;

/**
 * 원본 번역 데이터 가져오기 (xcstrings 파일에서 읽어온 것)
 */
export function getOriginalWork(): Record<string, LanguageTranslation> {
  if (typeof window === "undefined") {
    return {};
  }
  
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ORIGINAL_WORK);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error("원본 번역 데이터 로드 실패:", error);
    return {};
  }
}

export function setOriginalWork(data: Record<string, LanguageTranslation>): void {
  if (typeof window === "undefined") {
    return;
  }
  
  try {
    localStorage.setItem(STORAGE_KEYS.ORIGINAL_WORK, JSON.stringify(data));
  } catch (error) {
    console.error("원본 번역 데이터 저장 실패:", error);
  }
}

/**
 * 추가 번역 데이터 가져오기 (앱에서 생성한 것)
 */
export function getAdditionalWork(): Record<string, Record<string, string>> {
  if (typeof window === "undefined") {
    return {};
  }
  
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ADDITIONAL_WORK);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error("추가 번역 데이터 로드 실패:", error);
    return {};
  }
}

export function setAdditionalWork(data: Record<string, Record<string, string>>): void {
  if (typeof window === "undefined") {
    return;
  }
  
  try {
    localStorage.setItem(STORAGE_KEYS.ADDITIONAL_WORK, JSON.stringify(data));
  } catch (error) {
    console.error("추가 번역 데이터 저장 실패:", error);
  }
}

/**
 * 현재 작업 중인 번역 데이터 (원본 + 추가 합산, 하위 호환성)
 * 메모리에서만 합산하여 반환 (localStorage 읽기만 수행)
 */
export function getCurrentWork(): Record<string, LanguageTranslation> {
  const originalWork = getOriginalWork();
  const additionalWork = getAdditionalWork();
  
  // 원본과 추가를 합산 (메모리에서만)
  const merged: Record<string, LanguageTranslation> = {};
  
  // 모든 언어 locale 수집
  const allLocales = new Set([
    ...Object.keys(originalWork),
    ...Object.keys(additionalWork),
  ]);
  
  allLocales.forEach((locale) => {
    const original = originalWork[locale];
    const additional = additionalWork[locale] || {};
    
    if (original) {
      merged[locale] = {
        ...original,
        additionalTranslations: additional,
      };
    } else {
      // 원본이 없으면 추가만 있는 경우
      // 기본 구조 생성
      merged[locale] = {
        locale,
        sourceLanguage: "",
        info: {
          sourceText: "",
        },
        originalTranslations: {},
        additionalTranslations: additional,
      };
    }
  });
  
  return merged;
}

/**
 * 현재 작업 데이터 설정 (하위 호환성)
 * 메모리에서만 분리 작업 수행, localStorage에는 저장하지 않음
 * 실제 저장은 setOriginalWork()와 setAdditionalWork()를 직접 사용해야 함
 */
export function setCurrentWork(data: Record<string, LanguageTranslation>): void {
  // 메모리에서만 분리 작업 수행 (localStorage 저장 안 함)
  // 실제로 저장하려면 setOriginalWork()와 setAdditionalWork()를 직접 호출해야 함
  // 이 함수는 하위 호환성을 위해 유지하지만, 실제 저장은 하지 않음
  console.warn("setCurrentWork()는 메모리에서만 작동합니다. 실제 저장은 setOriginalWork()와 setAdditionalWork()를 사용하세요.");
}

/**
 * 특정 언어의 번역 데이터 가져오기 (원본 + 추가 합산)
 */
export function getLanguageTranslation(locale: string): LanguageTranslation | null {
  const work = getCurrentWork();
  return work[locale] || null;
}

/**
 * 특정 언어의 번역 데이터 업데이트
 */
export function updateLanguageTranslation(
  locale: string,
  translation: LanguageTranslation
): void {
  // 원본과 추가를 분리해서 저장
  setOriginalWork({
    [locale]: {
      locale: translation.locale,
      sourceLanguage: translation.sourceLanguage,
      info: translation.info,
      originalTranslations: translation.originalTranslations || {},
    },
  });
  
  if (translation.additionalTranslations && Object.keys(translation.additionalTranslations).length > 0) {
    setAdditionalWork({
      [locale]: translation.additionalTranslations,
    });
  }
}

/**
 * 특정 언어의 특정 키 번역값 업데이트 (추가 번역으로 저장)
 */
export function updateTranslationValue(
  locale: string,
  key: string,
  value: string,
  sourceLanguage?: string,
  sourceText?: string,
  comment?: string
): void {
  const additionalWork = getAdditionalWork();
  
  if (!additionalWork[locale]) {
    additionalWork[locale] = {};
  }
  
  if (value.trim()) {
    // 추가 번역으로 저장
    additionalWork[locale][key] = value;
  } else {
    // 빈 값이면 추가 번역에서 삭제
    delete additionalWork[locale][key];
    // 빈 객체가 되면 언어 자체도 삭제
    if (Object.keys(additionalWork[locale]).length === 0) {
      delete additionalWork[locale];
    }
  }
  
  setAdditionalWork(additionalWork);
}

/**
 * 선택된 언어 목록
 */
export function getSelectedLanguages(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SELECTED_LANGUAGES);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("선택된 언어 목록 로드 실패:", error);
    return [];
  }
}

export function setSelectedLanguages(locales: string[]): void {
  if (typeof window === "undefined") {
    return;
  }
  
  try {
    localStorage.setItem(STORAGE_KEYS.SELECTED_LANGUAGES, JSON.stringify(locales));
  } catch (error) {
    console.error("선택된 언어 목록 저장 실패:", error);
  }
}

/**
 * 사용되지 않는 번역 (원본 파일에 없는 키의 번역)
 */
export function getUnusedTranslations(): Record<string, Record<string, string>> {
  if (typeof window === "undefined") {
    return {};
  }
  
  try {
    const data = localStorage.getItem(STORAGE_KEYS.UNUSED_TRANSLATIONS);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error("사용되지 않는 번역 로드 실패:", error);
    return {};
  }
}

export function setUnusedTranslations(
  data: Record<string, Record<string, string>>
): void {
  if (typeof window === "undefined") {
    return;
  }
  
  try {
    localStorage.setItem(STORAGE_KEYS.UNUSED_TRANSLATIONS, JSON.stringify(data));
  } catch (error) {
    console.error("사용되지 않는 번역 저장 실패:", error);
  }
}

/**
 * 원본 xcstrings 파일 저장 (병합 시 사용)
 */
export function getOriginalXCStrings(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  
  try {
    return localStorage.getItem(STORAGE_KEYS.ORIGINAL_XCSTRINGS);
  } catch (error) {
    console.error("원본 xcstrings 로드 실패:", error);
    return null;
  }
}

export function setOriginalXCStrings(content: string): void {
  if (typeof window === "undefined") {
    return;
  }
  
  try {
    localStorage.setItem(STORAGE_KEYS.ORIGINAL_XCSTRINGS, content);
  } catch (error) {
    console.error("원본 xcstrings 저장 실패:", error);
  }
}

/**
 * 원본과 추가 번역을 합산하여 반환 (내보내기 시 사용)
 */
export function getMergedTranslations(translation: LanguageTranslation): Record<string, string> {
  // 원본 + 추가 합산 (추가가 우선)
  return {
    ...(translation.originalTranslations || {}),
    ...(translation.additionalTranslations || {}),
  };
}

/**
 * 추가 번역 삭제
 */
export function deleteAdditionalTranslation(locale: string, key: string): void {
  const additionalWork = getAdditionalWork();
  
  if (!additionalWork[locale]) {
    return;
  }
  
  delete additionalWork[locale][key];
  
  // 빈 객체가 되면 언어 자체도 삭제
  if (Object.keys(additionalWork[locale]).length === 0) {
    delete additionalWork[locale];
  }
  
  setAdditionalWork(additionalWork);
}

/**
 * 모든 작업 데이터 초기화
 */
export function clearAllWork(): void {
  if (typeof window === "undefined") {
    return;
  }
  
  try {
    localStorage.removeItem(STORAGE_KEYS.ORIGINAL_WORK);
    localStorage.removeItem(STORAGE_KEYS.ADDITIONAL_WORK);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_WORK);
    localStorage.removeItem(STORAGE_KEYS.SELECTED_LANGUAGES);
    localStorage.removeItem(STORAGE_KEYS.UNUSED_TRANSLATIONS);
    localStorage.removeItem(STORAGE_KEYS.ORIGINAL_XCSTRINGS);
  } catch (error) {
    console.error("작업 데이터 초기화 실패:", error);
  }
}

/**
 * 기본 OpenAI 지원 언어 목록
 */
function getDefaultOpenAISupportedLanguages(): string[] {
  return [
    "ko",
    "en",
    "en-US",
    "en-GB",
    "ja",
    "zh-Hans",
    "zh-Hant",
    "zh-CN",
    "zh-TW",
    "zh-HK",
    "fr",
    "de",
    "es",
    "es-ES",
    "es-419",
    "es-US",
    "it",
    "pt-PT",
    "pt-BR",
    "ru",
    "nl",
    "sv",
    "da",
    "fi",
    "nb",
    "pl",
    "cs",
    "hu",
    "el",
    "ro",
    "uk",
    "tr",
    "ar",
    "he",
    "hi",
    "bn",
    "ta",
    "te",
    "kn",
    "ml",
    "mr",
    "ur",
    "id",
    "ms",
    "th",
    "vi",
    "fil",
    "tl",
  ];
}

/**
 * OpenAI 지원 언어 목록 가져오기
 */
export function getOpenAISupportedLanguages(): string[] {
  if (typeof window === "undefined") {
    return getDefaultOpenAISupportedLanguages();
  }
  
  try {
    const data = localStorage.getItem(STORAGE_KEYS.OPENAI_SUPPORTED_LANGUAGES);
    if (data) {
      return JSON.parse(data);
    }
    // 기본값 반환
    return getDefaultOpenAISupportedLanguages();
  } catch (error) {
    console.error("OpenAI 지원 언어 목록 로드 실패:", error);
    return getDefaultOpenAISupportedLanguages();
  }
}

/**
 * OpenAI 지원 언어 목록 저장하기
 */
export function setOpenAISupportedLanguages(languages: string[]): void {
  if (typeof window === "undefined") {
    return;
  }
  
  try {
    localStorage.setItem(STORAGE_KEYS.OPENAI_SUPPORTED_LANGUAGES, JSON.stringify(languages));
  } catch (error) {
    console.error("OpenAI 지원 언어 목록 저장 실패:", error);
  }
}

/**
 * Claude 지원 언어 목록 가져오기
 */
export function getClaudeSupportedLanguages(): string[] {
  if (typeof window === "undefined") {
    return getDefaultOpenAISupportedLanguages(); // OpenAI와 동일한 기본값 사용
  }
  
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CLAUDE_SUPPORTED_LANGUAGES);
    if (data) {
      return JSON.parse(data);
    }
    // 기본값 반환
    return getDefaultOpenAISupportedLanguages();
  } catch (error) {
    console.error("Claude 지원 언어 목록 로드 실패:", error);
    return getDefaultOpenAISupportedLanguages();
  }
}

/**
 * Claude 지원 언어 목록 저장하기
 */
export function setClaudeSupportedLanguages(languages: string[]): void {
  if (typeof window === "undefined") {
    return;
  }
  
  try {
    localStorage.setItem(STORAGE_KEYS.CLAUDE_SUPPORTED_LANGUAGES, JSON.stringify(languages));
  } catch (error) {
    console.error("Claude 지원 언어 목록 저장 실패:", error);
  }
}

/**
 * 번역 API 키 가져오기 (provider별)
 */
export function getTranslationApiKey(provider: string): string {
  if (typeof window === "undefined") {
    return "";
  }
  
  try {
    const data = localStorage.getItem(STORAGE_KEYS.TRANSLATION_API_KEYS);
    if (data) {
      const keys = JSON.parse(data);
      return keys[provider] || "";
    }
    return "";
  } catch (error) {
    console.error("번역 API 키 로드 실패:", error);
    return "";
  }
}

/**
 * 번역 API 키 저장하기 (provider별)
 */
export function setTranslationApiKey(provider: string, apiKey: string): void {
  if (typeof window === "undefined") {
    return;
  }
  
  try {
    const data = localStorage.getItem(STORAGE_KEYS.TRANSLATION_API_KEYS);
    const keys = data ? JSON.parse(data) : {};
    keys[provider] = apiKey;
    localStorage.setItem(STORAGE_KEYS.TRANSLATION_API_KEYS, JSON.stringify(keys));
  } catch (error) {
    console.error("번역 API 키 저장 실패:", error);
  }
}

/**
 * 모든 번역 API 키 가져오기
 */
export function getAllTranslationApiKeys(): Record<string, string> {
  if (typeof window === "undefined") {
    return {};
  }
  
  try {
    const data = localStorage.getItem(STORAGE_KEYS.TRANSLATION_API_KEYS);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error("번역 API 키 로드 실패:", error);
    return {};
  }
}

/**
 * 번역 제공자 가져오기
 */
export function getTranslationProvider(): string {
  if (typeof window === "undefined") {
    return "google-translator";
  }
  
  try {
    const provider = localStorage.getItem(STORAGE_KEYS.TRANSLATION_PROVIDER);
    return provider || "google-translator";
  } catch (error) {
    console.error("번역 제공자 로드 실패:", error);
    return "google-translator";
  }
}

/**
 * 번역 제공자 저장하기
 */
export function setTranslationProvider(provider: string): void {
  if (typeof window === "undefined") {
    return;
  }
  
  try {
    localStorage.setItem(STORAGE_KEYS.TRANSLATION_PROVIDER, provider);
  } catch (error) {
    console.error("번역 제공자 저장 실패:", error);
  }
}

