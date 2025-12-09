/**
 * 언어 코드 매핑 및 유틸리티 함수
 */

export interface LanguageOption {
  name: string;
  locale: string;
}

/**
 * 지원하는 타겟 언어 목록 (레퍼런스 코드 기반)
 */
export const TARGET_LANGUAGES: LanguageOption[] = [
  { name: "English (UK)", locale: "en-GB" },
  { name: "English (AU)", locale: "en-AU" },
  { name: "French", locale: "fr" },
  { name: "German", locale: "de" },
  { name: "Italian", locale: "it" },
  { name: "Portuguese (Portugal)", locale: "pt" },
  { name: "Portuguese (Brazil)", locale: "pt-BR" },
  { name: "Spanish (Spain)", locale: "es" },
  { name: "Spanish (US)", locale: "es-US" },
  { name: "Japanese", locale: "ja" },
  { name: "Korean", locale: "ko" },
  { name: "Chinese (Simplified)", locale: "zh-Hans" },
  { name: "Chinese (Traditional)", locale: "zh-Hant" },
  { name: "Chinese (Hong Kong)", locale: "zh-HK" },
  { name: "Arabic", locale: "ar" },
  { name: "Hebrew", locale: "iw" },
  { name: "Hindi", locale: "hi" },
  { name: "Bengali", locale: "bn" },
  { name: "Tamil", locale: "ta" },
  { name: "Telugu", locale: "te" },
  { name: "Kannada", locale: "kn" },
  { name: "Malayalam", locale: "ml" },
  { name: "Marathi", locale: "mr" },
  { name: "Punjabi", locale: "pa" },
  { name: "Urdu", locale: "ur" },
  { name: "Nepali", locale: "ne" },
  { name: "Sinhala (Sri Lanka)", locale: "si" },
  { name: "Indonesian", locale: "id" },
  { name: "Malay", locale: "ms" },
  { name: "Thai", locale: "th" },
  { name: "Vietnamese", locale: "vi" },
  { name: "Khmer (Cambodian)", locale: "km" },
  { name: "Lao", locale: "lo" },
  { name: "Burmese (Myanmar)", locale: "my" },
  { name: "Filipino", locale: "fil" },
  { name: "Turkish", locale: "tr" },
  { name: "Dutch", locale: "nl" },
  { name: "Swedish", locale: "sv" },
  { name: "Norwegian Bokmål", locale: "nb" },
  { name: "Danish", locale: "da" },
  { name: "Finnish", locale: "fi" },
  { name: "Greek", locale: "el" },
  { name: "Polish", locale: "pl" },
  { name: "Czech", locale: "cs" },
  { name: "Hungarian", locale: "hu" },
  { name: "Romanian", locale: "ro" },
  { name: "Ukrainian", locale: "uk" },
  { name: "Croatian", locale: "hr" },
  { name: "Slovak", locale: "sk" },
  { name: "Catalan", locale: "ca" },
  { name: "Bulgarian", locale: "bg" },
  { name: "Lithuanian", locale: "lt" },
  { name: "Latvian", locale: "lv" },
  { name: "Slovenian", locale: "sl" },
  { name: "Estonian", locale: "et" },
  { name: "Belarusian", locale: "be" },
  { name: "Kazakh", locale: "kk" },
  { name: "Georgian", locale: "ka" },
  { name: "Armenian", locale: "hy" },
  { name: "Azerbaijani", locale: "az" },
  { name: "Maltese", locale: "mt" },
  { name: "Afrikaans", locale: "af" },
  { name: "Amharic (Ethiopia)", locale: "am" },
  { name: "Swahili", locale: "sw" },
  { name: "Hausa", locale: "ha" },
  { name: "Somali", locale: "so" },
  { name: "Yoruba", locale: "yo" },
  { name: "Zulu", locale: "zu" },
  { name: "Xhosa", locale: "xh" },
  { name: "Igbo", locale: "ig" },
  { name: "Sesotho", locale: "st" },
];

/**
 * 번역 API에서 사용하는 언어 코드 매핑
 */
export const TRANSLATION_LOCALE_OVERRIDES: Record<string, string> = {
  "nb": "no", // Norwegian Bokmål
};

/**
 * 언어 코드를 번역 API에 맞게 변환
 */
export function getTranslationLocale(locale: string): string {
  return TRANSLATION_LOCALE_OVERRIDES[locale] || locale;
}

/**
 * 언어 이름으로 locale 찾기
 */
export function findLocaleByName(name: string): string | undefined {
  const lang = TARGET_LANGUAGES.find((l) => l.name === name);
  return lang?.locale;
}

/**
 * locale로 언어 이름 찾기
 */
export function findNameByLocale(locale: string): string | undefined {
  const lang = TARGET_LANGUAGES.find((l) => l.locale === locale);
  return lang?.name;
}

/**
 * iOS 지역화 플레이스홀더 패턴
 * %1$lld, %1$@, %2$s, %lld, %@ 등의 패턴 매칭
 */
export const IOS_PLACEHOLDER_PATTERN = /%\d*\$?[@\w]+/g;

/**
 * 플레이스홀더 추출
 */
export function extractPlaceholders(text: string): string[] {
  return text.match(IOS_PLACEHOLDER_PATTERN) || [];
}

/**
 * 플레이스홀더 보존을 위한 텍스트 변환
 * 더 안전한 마커 사용 (번역 API가 번역하지 않도록)
 */
export function protectPlaceholders(text: string): { protected: string; placeholders: string[] } {
  const placeholders = extractPlaceholders(text);
  let protectedText = text;
  
  // 중복 제거 및 순서 유지
  const uniquePlaceholders = Array.from(new Set(placeholders));
  
  uniquePlaceholders.forEach((ph, idx) => {
    // 더 안전한 마커 사용 (숫자와 특수문자 조합으로 번역되지 않도록)
    const marker = `__PH${idx}__`;
    // 모든 발생을 한 번에 교체 (정규식 사용)
    const regex = new RegExp(ph.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    protectedText = protectedText.replace(regex, marker);
  });
  
  return { protected: protectedText, placeholders: uniquePlaceholders };
}

/**
 * 플레이스홀더 복원
 */
export function restorePlaceholders(text: string, placeholders: string[]): string {
  let restored = text;
  
  // 역순으로 복원 (긴 플레이스홀더부터)
  const sortedPlaceholders = [...placeholders].sort((a, b) => b.length - a.length);
  
  sortedPlaceholders.forEach((ph, idx) => {
    const marker = `__PH${idx}__`;
    // 모든 마커를 원래 플레이스홀더로 복원
    restored = restored.replace(new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), ph);
  });
  
  return restored;
}

