/**
 * 내보내기 API Route
 */

import { NextRequest, NextResponse } from "next/server";
import type { XCStrings } from "@/types/xcstrings";

/**
 * xcstrings에 번역값 설정
 */
function setStringValueInXCStrings(
  xcstrings: XCStrings,
  key: string,
  locale: string,
  value: string
): void {
  if (!xcstrings.strings[key]) {
    xcstrings.strings[key] = { localizations: {} };
  }
  
  const entry = xcstrings.strings[key];
  if (!entry.localizations) {
    entry.localizations = {};
  }
  
  if (!entry.localizations[locale]) {
    entry.localizations[locale] = { stringUnit: { state: "translated", value: "" } };
  }
  
  entry.localizations[locale].stringUnit = {
    state: "translated",
    value: value,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      originalXCStrings,
      translations,
      selectedLocales,
      exportAll = false,
    } = body as {
      originalXCStrings: string;
      translations: Record<string, Record<string, string>>; // locale -> { key -> value }
      selectedLocales?: string[];
      exportAll?: boolean;
    };
    
    if (!originalXCStrings) {
      return NextResponse.json(
        { error: "원본 xcstrings 파일이 필요합니다." },
        { status: 400 }
      );
    }
    
    // 원본 xcstrings 파싱
    const xcstrings: XCStrings = JSON.parse(originalXCStrings);
    
    // 내보낼 언어 목록 결정
    const localesToExport = exportAll
      ? Object.keys(translations)
      : selectedLocales || [];
    
    // 각 언어의 번역을 xcstrings에 병합
    localesToExport.forEach((locale) => {
      const localeTranslations = translations[locale];
      if (!localeTranslations) {
        return;
      }
      
      Object.entries(localeTranslations).forEach(([key, value]) => {
        if (value && value.trim()) {
          setStringValueInXCStrings(xcstrings, key, locale, value);
        }
      });
    });
    
    // JSON 문자열로 변환
    const exportedContent = JSON.stringify(xcstrings, null, 2);
    
    return NextResponse.json({
      content: exportedContent,
      filename: "Localizable.xcstrings",
    });
  } catch (error) {
    console.error("내보내기 오류:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "내보내기 실패",
      },
      { status: 500 }
    );
  }
}

