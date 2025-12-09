/**
 * xcstrings 파일 파싱 유틸리티
 */

import type { XCStrings, StringEntry, LanguageTranslation } from "@/types/xcstrings";

/**
 * xcstrings 파일 파싱
 */
export function parseXCStrings(content: string): XCStrings {
  try {
    return JSON.parse(content) as XCStrings;
  } catch (error) {
    throw new Error(`xcstrings 파일 파싱 실패: ${error}`);
  }
}

/**
 * 기본 언어의 문자열 값 가져오기
 * xcstrings 파일에서 키 자체가 원문일 수 있으므로, localizations에 없으면 키를 원문으로 사용
 */
export function getSourceStringValue(entry: StringEntry, sourceLanguage: string, key?: string): string {
  // localizations[sourceLanguage]에서 먼저 찾기
  if (entry.localizations) {
    const localization = entry.localizations[sourceLanguage];
    if (localization?.stringUnit?.value) {
      return localization.stringUnit.value;
    }
  }
  
  // localizations에 없으면 키 자체를 원문으로 사용
  if (key) {
    return key;
  }
  
  return "";
}

/**
 * 특정 언어의 문자열 값 가져오기
 */
export function getStringValue(entry: StringEntry, locale: string): string {
  if (!entry.localizations) {
    return "";
  }
  
  const localization = entry.localizations[locale];
  if (!localization?.stringUnit) {
    return "";
  }
  
  return localization.stringUnit.value || "";
}

/**
 * 기본 언어를 기준으로 각 언어별 JSON 생성
 * 매번 새롭게 언어별 구성 생성
 */
export function generateLanguageTranslations(
  xcstrings: XCStrings
): Record<string, LanguageTranslation> {
  const { sourceLanguage, strings } = xcstrings;
  const result: Record<string, LanguageTranslation> = {};
  
  // 모든 언어 locale 수집
  const allLocales = new Set<string>();
  
  Object.values(strings).forEach((entry) => {
    if (entry.localizations) {
      Object.keys(entry.localizations).forEach((locale) => {
        if (locale !== sourceLanguage) {
          allLocales.add(locale);
        }
      });
    }
  });
  
  // 각 언어별로 번역 데이터 구성
  allLocales.forEach((locale) => {
    const translations: Record<string, string> = {};
    
    // 첫 번째 키의 정보를 먼저 찾기 (info 설정용)
    let firstKeyInfo: { sourceText: string; comment?: string } | null = null;
    const firstKey = Object.keys(strings).find((key) => key !== "");
    if (firstKey) {
      const firstEntry = strings[firstKey];
      const sourceText = getSourceStringValue(firstEntry, sourceLanguage, firstKey);
      const comment = firstEntry.comment || firstEntry.localizations?.[sourceLanguage]?.comment;
      firstKeyInfo = { sourceText: sourceText || "", comment };
    }
    
    Object.entries(strings).forEach(([key, entry]) => {
      if (key === "") {
        return; // 빈 키는 건너뛰기
      }
      
      // 해당 언어의 번역값
      const translatedValue = getStringValue(entry, locale);
      
      if (translatedValue) {
        translations[key] = translatedValue;
      }
    });
    
    // 모든 언어에 대해 result 생성 (번역이 없어도 언어는 생성)
    result[locale] = {
      locale,
      sourceLanguage,
      info: firstKeyInfo || {
        sourceText: "",
        comment: undefined,
      },
      originalTranslations: translations,
    };
  });
  
  return result;
}

/**
 * xcstrings에서 특정 키의 기본 언어 정보 가져오기
 */
export function getSourceInfo(
  xcstrings: XCStrings,
  key: string
): { sourceText: string; comment?: string } | null {
  const entry = xcstrings.strings[key];
  if (!entry) {
    return null;
  }
  
  const sourceText = getSourceStringValue(entry, xcstrings.sourceLanguage, key);
  const comment = entry.comment || entry.localizations?.[xcstrings.sourceLanguage]?.comment;
  
  return {
    sourceText,
    comment,
  };
}

