/**
 * xcstrings 파일 파싱 유틸리티
 */

import type { XCStrings, StringEntry, LanguageTranslation } from "@/types/xcstrings";

/**
 * Xcode "Don't Translate" 키인지 여부
 * - String Catalog(.xcstrings)에서 shouldTranslate=false인 경우 번역 대상에서 제외
 */
export function isDontTranslateEntry(entry: StringEntry | undefined | null): boolean {
  if (!entry) {
    return false;
  }
  return entry.shouldTranslate === false;
}

/**
 * 번역 대상(Translatable) 키 목록
 * - 빈 키("") 제외
 * - "Don't Translate"로 표시된 키 제외
 */
export function getTranslatableKeys(xcstrings: XCStrings): string[] {
  return Object.keys(xcstrings.strings).filter((key) => {
    if (key === "") {
      return false;
    }
    const entry = xcstrings.strings[key];
    return !isDontTranslateEntry(entry);
  });
}

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
      if (key === "" || isDontTranslateEntry(entry)) {
        return; // 빈 키는 건너뛰기
      }
      
      // 해당 언어의 번역값
      const translatedValue = getStringValue(entry, locale);
      const localization = entry.localizations?.[locale];
      const state = localization?.stringUnit?.state;
      
      // "needs_review" 상태인 경우 번역값이 있어도 번역 대상으로 처리 (재번역 필요)
      if (state === "needs_review") {
        // needs_review 상태는 번역값이 있어도 originalTranslations에 포함하지 않음
        // (재번역이 필요하므로 pending으로 처리)
        return;
      }
      
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
 * 특정 키의 특정 언어에서 "needs_review" 상태인지 확인
 */
export function isNeedsReview(xcstrings: XCStrings, key: string, locale: string): boolean {
  const entry = xcstrings.strings[key];
  if (!entry?.localizations?.[locale]) {
    return false;
  }
  const state = entry.localizations[locale].stringUnit?.state;
  return state === "needs_review";
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

/**
 * Info.plist 파일인지 확인 (키 이름으로 판단)
 */
export function isInfoPlistFile(xcstrings: XCStrings): boolean {
  const keys = Object.keys(xcstrings.strings).filter((k) => k !== "");
  if (keys.length === 0) {
    return false;
  }
  
  // Info.plist에만 있는 구체적인 키 패턴
  // CFBundle으로 시작하는 키는 Info.plist에만 있음
  // NS로 시작하지만 NSLocalizedString은 제외 (Localizable에 있을 수 있음)
  // UI로 시작하지만 일반적인 UI 키는 제외
  const infoPlistKeyPatterns = [
    /^CFBundle/i, // CFBundleName, CFBundleDisplayName 등
    /^NSHumanReadableCopyright/i,
    /^NSPrincipalClass/i,
    /^NSHighResolutionCapable/i,
    /^NSSupportsAutomaticGraphicsSwitching/i,
    /^UIApplication/i, // UIApplicationSceneManifest 등
    /^UILaunchScreen/i,
    /^UISupportedInterfaceOrientations/i,
    /^Privacy/i, // Privacy - Camera Usage Description 등
    /^ITSAppUsesNonExemptEncryption/i,
    /^LSRequiresIPhoneOS/i,
    /^UIFileSharingEnabled/i,
    /^UISupportsDocumentBrowser/i,
  ];
  
  // Localizable에 있을 수 있는 키 패턴 (제외)
  const localizableKeyPatterns = [
    /^NSLocalizedString/i,
    /^LocalizedString/i,
  ];
  
  // Info.plist 패턴에 매칭되는 키가 있고, Localizable 패턴에는 매칭되지 않는 경우
  const hasInfoPlistKey = keys.some((key) => 
    infoPlistKeyPatterns.some((pattern) => pattern.test(key))
  );
  
  const hasLocalizableKey = keys.some((key) =>
    localizableKeyPatterns.some((pattern) => pattern.test(key))
  );
  
  // Info.plist 키가 있고 Localizable 키가 없으면 Info.plist로 판단
  // 또는 CFBundle 키가 있으면 확실히 Info.plist
  return hasInfoPlistKey && !hasLocalizableKey;
}
