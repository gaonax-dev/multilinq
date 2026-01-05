"use client";

import { useState } from "react";
import FileUpload from "./FileUpload";
import LanguageList from "./LanguageList";
import { getCurrentWork, getSelectedLanguages, getOriginalXCStrings, getUnusedTranslations, setOriginalXCStrings } from "@/lib/storage";
import { mergeXCStringsWithStorage, saveMergedData } from "@/lib/merge-utils";
import { parseXCStrings } from "@/lib/xcstrings-parser";
import type { XCStrings } from "@/types/xcstrings";
import type { TranslationProvider } from "@/types/translation";

interface SidebarProps {
  xcstrings: XCStrings | null;
  selectedLocale: string | null;
  onXCStringsLoad: (xcstrings: XCStrings, filename: string | null) => void;
  onLocaleSelect: (locale: string) => void;
  onTranslateAll: () => void;
  onTranslateSelected?: () => void;
  onExport: (exportAll: boolean) => void;
  translationProvider?: TranslationProvider;
  translationApiKey?: string;
  onTranslationProviderChange?: (provider: TranslationProvider) => void;
  onTranslationApiKeyChange?: (key: string) => void;
  isTranslating?: boolean;
  refreshKey?: number;
}

export default function Sidebar({
  xcstrings,
  selectedLocale,
  onXCStringsLoad,
  onLocaleSelect,
  onTranslateAll,
  onTranslateSelected,
  onExport,
  translationProvider: externalProvider,
  translationApiKey: externalApiKey,
  onTranslationProviderChange,
  onTranslationApiKeyChange,
  isTranslating = false,
  refreshKey = 0,
}: SidebarProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [internalProvider, setInternalProvider] = useState<TranslationProvider>("google-translator");
  const [internalApiKey, setInternalApiKey] = useState("");
  
  const translationProvider = externalProvider ?? internalProvider;
  const apiKey = externalApiKey ?? internalApiKey;
  
  const handleProviderChange = (provider: TranslationProvider) => {
    if (onTranslationProviderChange) {
      onTranslationProviderChange(provider);
    } else {
      setInternalProvider(provider);
    }
  };
  
  const handleApiKeyChange = (key: string) => {
    if (onTranslationApiKeyChange) {
      onTranslationApiKeyChange(key);
    } else {
      setInternalApiKey(key);
    }
  };

  const handleFileSelect = async (file: File) => {
    setIsLoading(true);
    try {
      const content = await file.text();
      const parsed = parseXCStrings(content);
      
      // 원본 파일 저장 (파일명 기반)
      await setOriginalXCStrings(content, file.name);
      
      // 병합 로직 실행 (파일명 기반)
      const result = mergeXCStringsWithStorage(parsed, file.name);
      saveMergedData(result, file.name, result.originalKeys);
      
      onXCStringsLoad(parsed, file.name);
    } catch (error) {
      console.error("파일 로드 실패:", error);
      alert(`파일 로드 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportAll = () => {
    onExport(true);
  };

  const handleExportSelected = () => {
    onExport(false);
  };

  return (
    <div className="w-80 bg-white border-r border-gray-200 h-screen overflow-y-auto flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">MultiLinq</h1>
        <p className="text-xs text-gray-700 mt-1">Localizable.xcstrings 번역 도구</p>
      </div>

      <div className="p-4 space-y-4 flex-1">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">파일 업로드</h2>
          <FileUpload onFileSelect={handleFileSelect} disabled={isLoading} />
        </div>

        {xcstrings && (
          <>
            <div className="border-t border-gray-200 pt-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-2">번역 설정</h2>
              <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="text-yellow-600 text-sm">⚠️</span>
                  <div className="text-xs text-yellow-800">
                    <p className="font-semibold mb-1">번역 시 주의사항:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li><code className="bg-yellow-100 px-1 rounded">%1$lld</code>, <code className="bg-yellow-100 px-1 rounded">%1$@</code> 같은 플레이스홀더는 원문과 동일하게 유지됩니다</li>
                      <li>줄바꿈(<code className="bg-yellow-100 px-1 rounded">\n</code>)도 원문과 동일하게 보존됩니다</li>
                      <li>권장 워크플로우: <code className="bg-yellow-100 px-1 rounded">xcodebuild -exportLocalizations</code> → 기계 번역 → <code className="bg-yellow-100 px-1 rounded">xcodebuild -importLocalizations</code></li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-800 mb-1 font-medium">번역 제공자</label>
                  <select
                    value={translationProvider}
                    onChange={(e) => handleProviderChange(e.target.value as TranslationProvider)}
                    disabled={isTranslating}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="google-translator">Google Translator (무료)</option>
                    <option value="google-cloud">Google Cloud Translate</option>
                    <option value="deepl">DeepL</option>
                    <option value="openai">OpenAI GPT</option>
                    <option value="claude">Claude</option>
                  </select>
                </div>
                {(translationProvider === "google-cloud" ||
                  translationProvider === "deepl" ||
                  translationProvider === "openai" ||
                  translationProvider === "claude") && (
                  <div>
                    <label className="block text-xs text-gray-800 mb-1 font-medium">API 키</label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => handleApiKeyChange(e.target.value)}
                      placeholder="API 키를 입력하세요"
                      disabled={isTranslating}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 bg-white placeholder:text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-gray-700">언어 목록</h2>
              </div>
              <LanguageList
                xcstrings={xcstrings}
                selectedLocale={selectedLocale}
                onLocaleSelect={onLocaleSelect}
                translationProvider={translationProvider}
                refreshKey={refreshKey}
              />
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-2">
              <button
                onClick={onTranslateAll}
                disabled={isTranslating}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                전체 언어 번역
              </button>
              {onTranslateSelected && (
                <button
                  onClick={onTranslateSelected}
                  disabled={isTranslating}
                  className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  선택 언어 번역
                </button>
              )}
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-2">
              <h2 className="text-sm font-semibold text-gray-700 mb-2">내보내기</h2>
              <button
                onClick={handleExportAll}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                전체 결과 내보내기
              </button>
              <button
                onClick={handleExportSelected}
                className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
              >
                선택 결과 내보내기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

