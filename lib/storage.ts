/**
 * localStorage 작업 데이터 관리 유틸리티
 */

import type { LanguageTranslation } from "@/types/xcstrings";
import { idbGetItem, idbRemoveItem, idbSetItem } from "@/lib/indexeddb";

const STORAGE_KEYS = {
  ORIGINAL_WORK: "multilinq_original_work", // 원본 번역 (xcstrings 파일에서 읽어온 것) - 하위 호환성
  ADDITIONAL_WORK: "multilinq_additional_work", // 추가 번역 (앱에서 생성한 것) - 하위 호환성
  CURRENT_WORK: "multilinq_current_work", // 하위 호환성 (원본+추가 합산)
  SELECTED_LANGUAGES: "multilinq_selected_languages", // 하위 호환성
  UNUSED_TRANSLATIONS: "multilinq_unused_translations", // 하위 호환성
  ORIGINAL_XCSTRINGS: "multilinq_original_xcstrings", // 하위 호환성
  ORIGINAL_FILENAME: "multilinq_original_filename", // 하위 호환성
  CURRENT_ACTIVE_FILENAME: "multilinq_current_active_filename", // 현재 활성 파일명
  OPENAI_SUPPORTED_LANGUAGES: "multilinq_openai_supported_languages", // OpenAI 지원 언어 목록
  CLAUDE_SUPPORTED_LANGUAGES: "multilinq_claude_supported_languages", // Claude 지원 언어 목록
  TRANSLATION_API_KEYS: "multilinq_translation_api_keys", // 번역 API 키들 (provider별)
  TRANSLATION_PROVIDER: "multilinq_translation_provider", // 번역 제공자 선택값
} as const;

function isQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  // DOMException.name: 'QuotaExceededError' (대부분의 브라우저)
  // code: 22 (Chrome/Safari), 1014 (Firefox)
  const anyError = error as { name?: unknown; code?: unknown };
  const name = typeof anyError.name === "string" ? anyError.name : "";
  const code = typeof anyError.code === "number" ? anyError.code : -1;

  return name === "QuotaExceededError" || code === 22 || code === 1014;
}

/**
 * 현재 활성 파일명 가져오기
 */
function getCurrentActiveFilename(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return localStorage.getItem(STORAGE_KEYS.CURRENT_ACTIVE_FILENAME);
  } catch {
    return null;
  }
}

/**
 * 현재 활성 파일명 설정
 */
function setCurrentActiveFilename(filename: string | null): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (filename) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_ACTIVE_FILENAME, filename);
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_ACTIVE_FILENAME);
    }
  } catch (error) {
    console.error("현재 활성 파일명 저장 실패:", error);
  }
}

/**
 * 파일명을 안전한 스토리지 키로 변환
 */
function filenameToStorageKey(filename: string): string {
  // 파일명을 기반으로 안전한 키 생성
  // 특수문자를 언더스코어로 변환하고, 소문자로 변환
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .toLowerCase()
    .replace(/\.xcstrings$/i, '');
}

/**
 * 파일명에 따른 storage 키 가져오기
 */
function getStorageKeys(filename: string | null = null): {
  ORIGINAL_WORK: string;
  ADDITIONAL_WORK: string;
  CURRENT_WORK: string;
  SELECTED_LANGUAGES: string;
  UNUSED_TRANSLATIONS: string;
  ORIGINAL_XCSTRINGS: string;
  ORIGINAL_FILENAME: string;
} {
  // 파일명이 제공되지 않으면 현재 활성 파일명 사용
  const activeFilename = filename || getCurrentActiveFilename();
  
  if (!activeFilename) {
    // 파일명이 없으면 기본 키 사용 (하위 호환성)
    return {
      ORIGINAL_WORK: STORAGE_KEYS.ORIGINAL_WORK,
      ADDITIONAL_WORK: STORAGE_KEYS.ADDITIONAL_WORK,
      CURRENT_WORK: STORAGE_KEYS.CURRENT_WORK,
      SELECTED_LANGUAGES: STORAGE_KEYS.SELECTED_LANGUAGES,
      UNUSED_TRANSLATIONS: STORAGE_KEYS.UNUSED_TRANSLATIONS,
      ORIGINAL_XCSTRINGS: STORAGE_KEYS.ORIGINAL_XCSTRINGS,
      ORIGINAL_FILENAME: STORAGE_KEYS.ORIGINAL_FILENAME,
    };
  }
  
  const fileKey = filenameToStorageKey(activeFilename);
  
  return {
    ORIGINAL_WORK: `multilinq_original_work_${fileKey}`,
    ADDITIONAL_WORK: `multilinq_additional_work_${fileKey}`,
    CURRENT_WORK: `multilinq_current_work_${fileKey}`,
    SELECTED_LANGUAGES: `multilinq_selected_languages_${fileKey}`,
    UNUSED_TRANSLATIONS: `multilinq_unused_translations_${fileKey}`,
    ORIGINAL_XCSTRINGS: `multilinq_original_xcstrings_${fileKey}`,
    ORIGINAL_FILENAME: `multilinq_original_filename_${fileKey}`,
  };
}

/**
 * 원본 번역 데이터 가져오기 (xcstrings 파일에서 읽어온 것)
 */
export function getOriginalWork(filename: string | null = null): Record<string, LanguageTranslation> {
  if (typeof window === "undefined") {
    return {};
  }
  
  try {
    const keys = getStorageKeys(filename);
    const data = localStorage.getItem(keys.ORIGINAL_WORK);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error("원본 번역 데이터 로드 실패:", error);
    return {};
  }
}

export function setOriginalWork(data: Record<string, LanguageTranslation>, filename: string | null = null): void {
  if (typeof window === "undefined") {
    return;
  }
  
  try {
    const keys = getStorageKeys(filename);
    localStorage.setItem(keys.ORIGINAL_WORK, JSON.stringify(data));
  } catch (error) {
    console.error("원본 번역 데이터 저장 실패:", error);
  }
}

/**
 * 추가 번역 데이터 가져오기 (앱에서 생성한 것)
 */
export function getAdditionalWork(filename: string | null = null): Record<string, Record<string, string>> {
  if (typeof window === "undefined") {
    return {};
  }
  
  try {
    const keys = getStorageKeys(filename);
    const data = localStorage.getItem(keys.ADDITIONAL_WORK);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error("추가 번역 데이터 로드 실패:", error);
    return {};
  }
}

export function setAdditionalWork(data: Record<string, Record<string, string>>, filename: string | null = null): void {
  if (typeof window === "undefined") {
    return;
  }
  
  try {
    const keys = getStorageKeys(filename);
    localStorage.setItem(keys.ADDITIONAL_WORK, JSON.stringify(data));
  } catch (error) {
    console.error("추가 번역 데이터 저장 실패:", error);
  }
}

/**
 * 현재 작업 중인 번역 데이터 (원본 + 추가 합산, 하위 호환성)
 * 메모리에서만 합산하여 반환 (localStorage 읽기만 수행)
 * 원본 파일의 키만 필터링하여 반환 (원본 파일이 기준)
 */
export function getCurrentWork(
  filename: string | null = null,
  originalKeys?: Set<string>
): Record<string, LanguageTranslation> {
  const originalWork = getOriginalWork(filename);
  const additionalWork = getAdditionalWork(filename);
  
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
    
    // 원본 파일의 키만 필터링 (원본 파일이 기준)
    let filteredAdditional: Record<string, string> = {};
    if (originalKeys) {
      Object.entries(additional).forEach(([key, value]) => {
        if (originalKeys.has(key)) {
          filteredAdditional[key] = value;
        }
      });
    } else {
      // 원본 키가 제공되지 않으면 모든 추가 번역 포함 (하위 호환성)
      filteredAdditional = additional;
    }
    
    if (original) {
      merged[locale] = {
        ...original,
        additionalTranslations: filteredAdditional,
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
        additionalTranslations: filteredAdditional,
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
  comment?: string,
  filename: string | null = null
): void {
  const additionalWork = getAdditionalWork(filename);
  
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
  
  setAdditionalWork(additionalWork, filename);
}

/**
 * 선택된 언어 목록
 */
export function getSelectedLanguages(filename: string | null = null): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  
  try {
    const keys = getStorageKeys(filename);
    const data = localStorage.getItem(keys.SELECTED_LANGUAGES);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("선택된 언어 목록 로드 실패:", error);
    return [];
  }
}

export function setSelectedLanguages(locales: string[], filename: string | null = null): void {
  if (typeof window === "undefined") {
    return;
  }
  
  try {
    const keys = getStorageKeys(filename);
    localStorage.setItem(keys.SELECTED_LANGUAGES, JSON.stringify(locales));
  } catch (error) {
    console.error("선택된 언어 목록 저장 실패:", error);
  }
}

/**
 * 사용되지 않는 번역 (원본 파일에 없는 키의 번역)
 */
export function getUnusedTranslations(filename: string | null = null): Record<string, Record<string, string>> {
  if (typeof window === "undefined") {
    return {};
  }
  
  try {
    const keys = getStorageKeys(filename);
    const data = localStorage.getItem(keys.UNUSED_TRANSLATIONS);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error("사용되지 않는 번역 로드 실패:", error);
    return {};
  }
}

export function setUnusedTranslations(
  data: Record<string, Record<string, string>>,
  filename: string | null = null
): void {
  if (typeof window === "undefined") {
    return;
  }
  
  try {
    const keys = getStorageKeys(filename);
    localStorage.setItem(keys.UNUSED_TRANSLATIONS, JSON.stringify(data));
  } catch (error) {
    console.error("사용되지 않는 번역 저장 실패:", error);
  }
}

/**
 * 원본 xcstrings 파일 저장 (병합 시 사용)
 */
export async function getOriginalXCStrings(filename: string | null = null): Promise<string | null> {
  if (typeof window === "undefined") {
    return null;
  }
  
  const keys = getStorageKeys(filename);
  
  // IndexedDB만 사용 (중복 저장소 제거)
  try {
    return await idbGetItem(keys.ORIGINAL_XCSTRINGS);
  } catch (error) {
    console.error("원본 xcstrings(IndexedDB) 로드 실패:", error);
    return null;
  }
}

export async function setOriginalXCStrings(content: string, filename: string | null = null): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }
  
  if (!filename) {
    throw new Error("파일명이 필요합니다.");
  }
  
  // 현재 활성 파일명 설정
  setCurrentActiveFilename(filename);
  
  const keys = getStorageKeys(filename);
  
  // IndexedDB만 사용 (중복 저장소 제거)
  try {
    await idbSetItem(keys.ORIGINAL_XCSTRINGS, content);
    console.log(`원본 xcstrings 저장 완료 (IndexedDB): ${keys.ORIGINAL_XCSTRINGS}, 파일명: ${filename}`);
    
    // 저장 확인 (디버깅용)
    const saved = await idbGetItem(keys.ORIGINAL_XCSTRINGS);
    if (!saved) {
      console.warn("원본 xcstrings 저장 후 확인 실패: 저장된 데이터를 찾을 수 없습니다.");
    } else {
      console.log(`원본 xcstrings 저장 확인 완료: ${saved.length} bytes`);
    }
    
    // 파일명 저장 (localStorage에 저장 - 작은 데이터이므로)
    try {
      localStorage.setItem(keys.ORIGINAL_FILENAME, filename);
      console.log(`원본 파일명 저장 완료: ${filename}`);
    } catch (error) {
      console.error("원본 파일명 저장 실패:", error);
    }
    
    // 기존 localStorage에 남아있을 수 있는 중복 데이터 제거
    try {
      localStorage.removeItem(keys.ORIGINAL_XCSTRINGS);
    } catch {
      // ignore
    }
  } catch (idbError) {
    console.error("원본 xcstrings(IndexedDB) 저장 실패:", idbError);
    throw idbError;
  }
}

/**
 * 원본 파일명 가져오기
 */
export function getOriginalFilename(filename: string | null = null): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  
  try {
    const keys = getStorageKeys(filename);
    return localStorage.getItem(keys.ORIGINAL_FILENAME);
  } catch (error) {
    console.error("원본 파일명 로드 실패:", error);
    return null;
  }
}

/**
 * 현재 활성 파일명 가져오기 (외부에서 사용)
 */
export function getCurrentActiveFilenamePublic(): string | null {
  return getCurrentActiveFilename();
}

/**
 * 원본과 추가 번역을 합산하여 반환 (내보내기 시 사용)
 */
export function getMergedTranslations(translation: LanguageTranslation): Record<string, string> {
  // 원본 + 추가 합산 (원본이 우선, 원본이 없으면 추가 사용)
  const merged: Record<string, string> = {};
  
  // 먼저 추가 번역을 설정
  const additionalTranslations = translation.additionalTranslations || {};
  Object.entries(additionalTranslations).forEach(([key, value]) => {
    merged[key] = value;
  });
  
  // 그 다음 원본 번역으로 덮어씀 (원본 번역이 우선)
  const originalTranslations = translation.originalTranslations || {};
  Object.entries(originalTranslations).forEach(([key, value]) => {
    if (value && value.trim()) {
      merged[key] = value;
    }
  });
  
  return merged;
}

/**
 * 추가 번역 삭제
 */
export function deleteAdditionalTranslation(locale: string, key: string, filename: string | null = null): void {
  const additionalWork = getAdditionalWork(filename);
  
  if (!additionalWork[locale]) {
    return;
  }
  
  delete additionalWork[locale][key];
  
  // 빈 객체가 되면 언어 자체도 삭제
  if (Object.keys(additionalWork[locale]).length === 0) {
    delete additionalWork[locale];
  }
  
  setAdditionalWork(additionalWork, filename);
}

/**
 * 원본 xcstrings 파일에서 특정 언어의 번역 제거
 */
async function removeTranslationFromOriginalXCStrings(locale: string, key: string, filename: string | null = null): Promise<void> {
  const originalContent = await getOriginalXCStrings(filename);
  if (!originalContent) {
    return;
  }
  
  try {
    const xcstrings = JSON.parse(originalContent);
    
    // 해당 키의 entry가 있는지 확인
    if (!xcstrings.strings || !xcstrings.strings[key]) {
      return;
    }
    
    const entry = xcstrings.strings[key];
    
    // localizations에서 해당 언어의 번역 제거
    if (entry.localizations && entry.localizations[locale]) {
      delete entry.localizations[locale];
      
      // localizations가 비어있으면 localizations 객체 자체를 제거할 수도 있지만,
      // 다른 언어가 있을 수 있으므로 그대로 유지
      
      // 업데이트된 xcstrings를 다시 저장
      const updatedContent = JSON.stringify(xcstrings, null, 2);
      await setOriginalXCStrings(updatedContent, filename);
    }
  } catch (error) {
    console.error("원본 xcstrings 파일에서 번역 제거 실패:", error);
  }
}

/**
 * 원본 번역 삭제
 */
export async function deleteOriginalTranslation(locale: string, key: string, filename: string | null = null): Promise<void> {
  const originalWork = getOriginalWork(filename);
  
  if (!originalWork[locale]) {
    return;
  }
  
  if (!originalWork[locale].originalTranslations) {
    return;
  }
  
  // localStorage의 originalWork에서 삭제
  delete originalWork[locale].originalTranslations[key];
  
  // 빈 객체가 되면 originalTranslations를 빈 객체로 유지
  if (Object.keys(originalWork[locale].originalTranslations).length === 0) {
    originalWork[locale].originalTranslations = {};
  }
  
  setOriginalWork(originalWork, filename);
  
  // 저장된 원본 xcstrings 파일에서도 제거
  // 원본 파일에서 제거하면 병합 로직이 실행될 때 자동으로 제외됨
  await removeTranslationFromOriginalXCStrings(locale, key, filename);
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
    // ORIGINAL_XCSTRINGS는 IndexedDB만 사용하므로 localStorage에서 제거 (중복 제거)
    localStorage.removeItem(STORAGE_KEYS.ORIGINAL_XCSTRINGS);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_ACTIVE_FILENAME);
    
    // 모든 파일명 기반 키 제거 (localStorage에서 multilinq_로 시작하는 모든 키 찾아서 제거)
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("multilinq_")) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
    });
  } catch (error) {
    console.error("작업 데이터 초기화 실패:", error);
  }

  // IndexedDB 저장소도 함께 정리 (fire-and-forget)
  // 모든 파일명 기반 키 제거는 복잡하므로 주요 키만 정리
  void idbRemoveItem(STORAGE_KEYS.ORIGINAL_XCSTRINGS).catch((error) => {
    console.error("작업 데이터(IndexedDB) 초기화 실패:", error);
  });
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

