/**
 * 번역 API Route
 */

import { NextRequest, NextResponse } from "next/server";
import { translateText } from "@/lib/translation-service";
import type { TranslationRequest } from "@/types/translation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      text,
      sourceLanguage,
      targetLanguage,
      provider,
      apiKey,
      options,
    } = body as TranslationRequest;
    
    if (!text || !sourceLanguage || !targetLanguage || !provider) {
      return NextResponse.json(
        { error: "필수 파라미터가 누락되었습니다." },
        { status: 400 }
      );
    }
    
    // 번역 실행
    const result = await translateText({
      text,
      sourceLanguage,
      targetLanguage,
      provider,
      apiKey,
      options,
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("번역 오류:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "번역 실패",
      },
      { status: 500 }
    );
  }
}

/**
 * 배치 번역 (여러 텍스트를 한 번에 번역)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      texts,
      sourceLanguage,
      targetLanguage,
      provider,
      apiKey,
      options,
    } = body as {
      texts: Array<{ key: string; text: string }>;
      sourceLanguage: string;
      targetLanguage: string;
      provider: TranslationRequest["provider"];
      apiKey?: string;
      options?: TranslationRequest["options"];
    };
    
    if (!texts || !Array.isArray(texts) || !sourceLanguage || !targetLanguage || !provider) {
      return NextResponse.json(
        { error: "필수 파라미터가 누락되었습니다." },
        { status: 400 }
      );
    }
    
    // 순차적으로 번역 (API 제한 고려)
    const results: Record<string, string> = {};
    
    for (const item of texts) {
      try {
        const result = await translateText({
          text: item.text,
          sourceLanguage,
          targetLanguage,
          provider,
          apiKey,
          options,
        });
        
        results[item.key] = result.translatedText;
        
        // API 제한을 위한 짧은 대기 (필요시)
        if (provider === "google-translator") {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`번역 실패 (${item.key}):`, error);
        results[item.key] = ""; // 실패 시 빈 문자열
      }
    }
    
    return NextResponse.json({ results });
  } catch (error) {
    console.error("배치 번역 오류:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "배치 번역 실패",
      },
      { status: 500 }
    );
  }
}

