/**
 * xcstrings와 localStorage 병합 로직
 */

import type { XCStrings, LanguageTranslation } from "@/types/xcstrings";
import type { TranslationStatus } from "@/types/translation";
import { generateLanguageTranslations, getSourceInfo } from "./xcstrings-parser";
import {
  getOriginalWork,
  setOriginalWork,
  getAdditionalWork,
  setAdditionalWork,
  getUnusedTranslations,
  setUnusedTranslations,
} from "./storage";

/**
 * 병합 결과
 */
export interface MergeResult {
  merged: Record<string, LanguageTranslation>;
  unused: Record<string, Record<string, string>>;
}

/**
 * xcstrings와 localStorage 병합
 * - 중복 키: xcstrings 파일 우선 (원본이 최신)
 * - 중복되지 않은 키: localStorage 번역을 병합하여 추가 번역 대기 상태로 유지
 * - 사용되지 않는 번역: 원본에 없는 키의 번역은 별도 보관
 */
export function mergeXCStringsWithStorage(
  xcstrings: XCStrings
): MergeResult {
  // 1. xcstrings에서 언어별 새 구성 생성 (매번 새롭게)
  const newTranslations = generateLanguageTranslations(xcstrings);
  
  // 2. 기존 localStorage 작업 데이터 가져오기
  const existingOriginalWork = getOriginalWork();
  const existingAdditionalWork = getAdditionalWork();
  const existingUnused = getUnusedTranslations();
  
  // 3. 원본 파일의 모든 키 수집
  const originalKeys = new Set(Object.keys(xcstrings.strings).filter((k) => k !== ""));
  
  // 4. 병합된 결과
  const merged: Record<string, LanguageTranslation> = {};
  const unused: Record<string, Record<string, string>> = { ...existingUnused };
  
  // 5. 각 언어별로 병합
  Object.keys(newTranslations).forEach((locale) => {
    const newLang = newTranslations[locale];
    
    // 원본 번역 (xcstrings 파일에서 가져온 것)
    const originalTranslations: Record<string, string> = { ...(newLang.originalTranslations || {}) };
    
    // 추가 번역 (기존 localStorage에 있던 것 중 원본에 있는 키)
    const additionalTranslations: Record<string, string> = {};
    const existingAdditional = existingAdditionalWork[locale] || {};
    
    // 기존 추가 번역 중 원본에 있는 키만 유지
    Object.entries(existingAdditional).forEach(([key, value]) => {
      if (originalKeys.has(key)) {
        // 원본에 있는 키만 추가 번역으로 유지
        additionalTranslations[key] = value;
      } else {
        // 원본에 없는 키: 사용되지 않는 번역으로 분류
        if (!unused[locale]) {
          unused[locale] = {};
        }
        unused[locale][key] = value;
      }
    });
    
    // 새 언어 구조 생성 (원본과 추가 분리)
    merged[locale] = {
      locale: newLang.locale,
      sourceLanguage: newLang.sourceLanguage,
      info: newLang.info,
      originalTranslations,
      additionalTranslations,
    };
  });
  
  // 6. 기존 추가 작업에 있지만 새 xcstrings에 없는 언어 처리
  Object.keys(existingAdditionalWork).forEach((locale) => {
    if (!merged[locale]) {
      // 새 파일에 없는 언어는 추가 번역만 유지
      const existingOriginal = existingOriginalWork[locale];
      if (existingOriginal) {
        merged[locale] = {
          ...existingOriginal,
          additionalTranslations: existingAdditionalWork[locale],
        };
      }
    }
  });
  
  // 7. 사용되지 않는 번역 저장
  setUnusedTranslations(unused);
  
  return { merged, unused };
}

/**
 * 병합된 데이터를 localStorage에 저장 (원본과 추가 분리)
 */
export function saveMergedData(result: MergeResult): void {
  // 원본과 추가를 분리해서 저장
  const originalWork: Record<string, LanguageTranslation> = {};
  const additionalWork: Record<string, Record<string, string>> = {};
  
  Object.entries(result.merged).forEach(([locale, translation]) => {
    // 원본 번역 저장
    originalWork[locale] = {
      locale: translation.locale,
      sourceLanguage: translation.sourceLanguage,
      info: translation.info,
      originalTranslations: translation.originalTranslations || {},
    };
    
    // 추가 번역 저장
    if (translation.additionalTranslations && Object.keys(translation.additionalTranslations).length > 0) {
      additionalWork[locale] = translation.additionalTranslations;
    }
  });
  
  setOriginalWork(originalWork);
  setAdditionalWork(additionalWork);
  setUnusedTranslations(result.unused);
}

/**
 * 특정 키가 원본에 있는지 확인
 */
export function isKeyInOriginal(xcstrings: XCStrings, key: string): boolean {
  return key !== "" && key in xcstrings.strings;
}

/**
 * 번역 상태 계산
 */
export function calculateTranslationStatus(
  translation: LanguageTranslation,
  sourceKeys: string[]
): TranslationStatus {
  const total = sourceKeys.length;
  let translated = 0; // 원본 번역 수
  let additional = 0; // 추가 번역 수 (원본에 포함된 키만)
  let pending = 0;
  
  const originalTranslations = translation.originalTranslations || {};
  const additionalTranslations = translation.additionalTranslations || {};
  
  sourceKeys.forEach((key) => {
    const originalValue = originalTranslations[key];
    const additionalValue = additionalTranslations[key];
    
    // 원본 번역이 있는지 확인
    const hasOriginal = originalValue && typeof originalValue === "string" && originalValue.trim().length > 0;
    // 추가 번역이 있는지 확인 (원본에 포함된 키만)
    const hasAdditional = additionalValue !== undefined && additionalValue !== null && typeof additionalValue === "string" && additionalValue.trim().length > 0;
    
    if (hasOriginal) {
      // 원본 번역이 있음
      translated++;
    } else if (hasAdditional) {
      // 추가 번역만 있음 (원본에 포함된 키만 카운트)
      additional++;
    } else {
      // 번역이 없음
      // 기본 언어 정보가 있으면 번역 대기 상태
      const sourceInfo = translation.info;
      if (sourceInfo && sourceInfo.sourceText) {
        pending++;
      }
    }
  });
  
  // 퍼센트 계산: (원본 + 추가) / 전체 * 100
  const totalTranslated = translated + additional;
  const percentage = total > 0 ? (totalTranslated / total) * 100 : 0;
  
  return {
    translated,
    additional,
    total,
    percentage,
    pending,
  };
}

