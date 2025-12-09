/**
 * xcstrings 파일 파싱 API Route
 */

import { NextRequest, NextResponse } from "next/server";
import { parseXCStrings } from "@/lib/xcstrings-parser";
import { mergeXCStringsWithStorage } from "@/lib/merge-utils";
import type { XCStrings } from "@/types/xcstrings";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const existingWorkJson = formData.get("existingWork") as string | null;
    const existingUnusedJson = formData.get("existingUnused") as string | null;
    
    if (!file) {
      return NextResponse.json(
        { error: "파일이 제공되지 않았습니다." },
        { status: 400 }
      );
    }
    
    // 파일 내용 읽기
    const content = await file.text();
    
    // xcstrings 파싱
    const xcstrings = parseXCStrings(content);
    
    // 기존 작업 데이터 파싱 (있는 경우)
    let existingWork = {};
    let existingUnused = {};
    
    if (existingWorkJson) {
      try {
        existingWork = JSON.parse(existingWorkJson);
      } catch (e) {
        console.warn("기존 작업 데이터 파싱 실패:", e);
      }
    }
    
    if (existingUnusedJson) {
      try {
        existingUnused = JSON.parse(existingUnusedJson);
      } catch (e) {
        console.warn("사용되지 않는 번역 데이터 파싱 실패:", e);
      }
    }
    
    // 병합 로직 실행
    // mergeXCStringsWithStorage는 클라이언트에서 실행하므로,
    // 여기서는 파싱된 데이터와 기존 데이터를 반환
    const result = {
      xcstrings,
      existingWork,
      existingUnused,
      sourceLanguage: xcstrings.sourceLanguage,
    };
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("파일 파싱 오류:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "파일 파싱 실패" },
      { status: 500 }
    );
  }
}

