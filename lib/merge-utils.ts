/**
 * xcstrings와 localStorage 병합 로직
 */

import type { XCStrings, LanguageTranslation } from "@/types/xcstrings";
import type { TranslationStatus } from "@/types/translation";
import { generateLanguageTranslations, getSourceInfo, isDontTranslateEntry } from "./xcstrings-parser";
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
  originalKeys: Set<string>;
}

/**
 * xcstrings와 localStorage 병합
 * - 중복 키: xcstrings 파일 우선 (원본이 최신)
 * - 중복되지 않은 키: localStorage 번역을 병합하여 추가 번역 대기 상태로 유지
 * - 사용되지 않는 번역: 원본에 없는 키의 번역은 별도 보관
 */
export function mergeXCStringsWithStorage(
  xcstrings: XCStrings,
  filename: string | null = null
): MergeResult {
  // 1. xcstrings에서 언어별 새 구성 생성 (매번 새롭게)
  const newTranslations = generateLanguageTranslations(xcstrings);
  
  // 2. 기존 localStorage 작업 데이터 가져오기
  const existingOriginalWork = getOriginalWork(filename);
  const existingAdditionalWork = getAdditionalWork(filename);
  const existingUnused = getUnusedTranslations(filename);
  
  // 3. 원본 파일의 모든 키 수집
  const originalKeys = new Set(Object.keys(xcstrings.strings).filter((k) => k !== ""));
  // 3-1. "Don't Translate" 키 수집 (추가 번역은 제거하고, 카운트에서도 제외)
  const dontTranslateKeys = new Set(
    Object.entries(xcstrings.strings)
      .filter(([key, entry]) => key !== "" && isDontTranslateEntry(entry))
      .map(([key]) => key)
  );
  
  // 4. 병합된 결과
  const merged: Record<string, LanguageTranslation> = {};
  const unused: Record<string, Record<string, string>> = { ...existingUnused };
  
  // 5. 각 언어별로 병합
  Object.keys(newTranslations).forEach((locale) => {
    const newLang = newTranslations[locale];
    
    // 원본 번역 (xcstrings 파일에서 가져온 것)
    // 원본 파일에서 이미 삭제된 번역은 자동으로 포함되지 않음
    const originalTranslations: Record<string, string> = { ...(newLang.originalTranslations || {}) };
    
    // 추가 번역 (기존 localStorage에 있던 것 중 원본에 있는 키)
    const additionalTranslations: Record<string, string> = {};
    const existingAdditional = existingAdditionalWork[locale] || {};
    
    // 기존 추가 번역 중 원본에 있는 키만 유지
    Object.entries(existingAdditional).forEach(([key, value]) => {
      // "Don't Translate"는 번역본을 저장/유지하지 않음 (추가 번역 삭제)
      if (dontTranslateKeys.has(key)) {
        return;
      }

      if (originalKeys.has(key)) {
        // 원본에 있는 키인 경우
        // 새로 업로드된 원본 번역이 있으면 추가 번역 제거 (원본 번역 우선)
        // 원본 번역이 없으면 추가 번역 유지 (번역 작업으로 생성된 경우)
        if (!originalTranslations[key] || !originalTranslations[key].trim()) {
          // 원본 번역이 없으면 추가 번역으로 유지
          additionalTranslations[key] = value;
        }
        // 원본 번역이 있으면 추가 번역 제거 (원본 번역 우선)
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
  // 원본 파일이 기준이므로, 새 파일에 없는 언어는 제거하지 않지만
  // 추가 번역도 원본 파일의 키만 유지해야 함
  Object.keys(existingAdditionalWork).forEach((locale) => {
    if (!merged[locale]) {
      // 새 파일에 없는 언어는 추가 번역만 유지하되, 원본 파일의 키만 필터링
      const existingOriginal = existingOriginalWork[locale];
      if (existingOriginal) {
        // 원본 파일의 키만 필터링
        const filteredAdditional: Record<string, string> = {};
        Object.entries(existingAdditionalWork[locale]).forEach(([key, value]) => {
          if (originalKeys.has(key) && !dontTranslateKeys.has(key)) {
            filteredAdditional[key] = value;
          } else {
            // 원본에 없는 키는 unused로 이동
            if (!unused[locale]) {
              unused[locale] = {};
            }
            unused[locale][key] = value;
          }
        });
        
        merged[locale] = {
          ...existingOriginal,
          additionalTranslations: filteredAdditional,
        };
      }
    }
  });
  
  // 7. 사용되지 않는 번역 저장
  setUnusedTranslations(unused, filename);
  
  return { merged, unused, originalKeys };
}

/**
 * 병합된 데이터를 localStorage에 저장 (원본과 추가 분리)
 * 원본 파일의 키만 저장 (원본에 없는 키는 제거)
 */
export function saveMergedData(
  result: MergeResult,
  filename: string | null = null,
  originalKeys?: Set<string>
): void {
  // 원본과 추가를 분리해서 저장
  const originalWork: Record<string, LanguageTranslation> = {};
  const additionalWork: Record<string, Record<string, string>> = {};
  
  Object.entries(result.merged).forEach(([locale, translation]) => {
    // 원본 번역 저장 (번역이 없어도 언어는 저장)
    // 원본 번역도 원본 파일의 키만 필터링
    const filteredOriginalTranslations: Record<string, string> = {};
    if (originalKeys) {
      Object.entries(translation.originalTranslations || {}).forEach(([key, value]) => {
        if (originalKeys.has(key)) {
          filteredOriginalTranslations[key] = value;
        }
      });
    } else {
      // originalKeys가 제공되지 않으면 모든 원본 번역 포함 (하위 호환성)
      Object.assign(filteredOriginalTranslations, translation.originalTranslations || {});
    }
    
    originalWork[locale] = {
      locale: translation.locale,
      sourceLanguage: translation.sourceLanguage,
      info: translation.info,
      originalTranslations: filteredOriginalTranslations,
    };
    
    // 추가 번역 저장 (원본 파일의 키만)
    if (translation.additionalTranslations && Object.keys(translation.additionalTranslations).length > 0) {
      const filteredAdditional: Record<string, string> = {};
      Object.entries(translation.additionalTranslations).forEach(([key, value]) => {
        if (!originalKeys || originalKeys.has(key)) {
          filteredAdditional[key] = value;
        }
      });
      
      if (Object.keys(filteredAdditional).length > 0) {
        additionalWork[locale] = filteredAdditional;
      }
    }
  });
  
  setOriginalWork(originalWork, filename);
  setAdditionalWork(additionalWork, filename);
  setUnusedTranslations(result.unused, filename);
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

