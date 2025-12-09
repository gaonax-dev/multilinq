"use client";

import { findNameByLocale } from "@/lib/language-utils";

interface LanguageProgress {
  locale: string;
  name: string;
  current: number;
  total: number;
  status: "pending" | "translating" | "completed" | "error";
  error?: string;
}

interface BatchTranslationProgressProps {
  isVisible: boolean;
  totalLanguages: number;
  currentLanguageIndex: number;
  languages: LanguageProgress[];
  onCancel: () => void;
}

export default function BatchTranslationProgress({
  isVisible,
  totalLanguages,
  currentLanguageIndex,
  languages,
  onCancel,
}: BatchTranslationProgressProps) {
  if (!isVisible) return null;

  const overallProgress = totalLanguages > 0 ? ((currentLanguageIndex + 1) / totalLanguages) * 100 : 0;
  const completedCount = languages.filter((l) => l.status === "completed").length;
  const translatingCount = languages.filter((l) => l.status === "translating").length;
  const errorCount = languages.filter((l) => l.status === "error").length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">전체 언어 번역 진행도</h2>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {/* 전체 진행도 */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">전체 진행도</span>
              <span className="text-sm font-bold text-blue-600">
                {currentLanguageIndex + 1} / {totalLanguages} 언어 ({overallProgress.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <div className="flex gap-4 mt-2 text-xs text-gray-600">
              <span>완료: {completedCount}</span>
              <span>진행 중: {translatingCount}</span>
              <span>대기: {totalLanguages - completedCount - translatingCount - errorCount}</span>
              {errorCount > 0 && <span className="text-red-600">오류: {errorCount}</span>}
            </div>
          </div>

          {/* 언어별 진행도 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">언어별 진행도</h3>
            {languages.map((lang) => {
              const progress = lang.total > 0 ? (lang.current / lang.total) * 100 : 0;
              const getStatusColor = () => {
                if (lang.status === "completed") return "bg-green-500";
                if (lang.status === "translating") return "bg-blue-600";
                if (lang.status === "error") return "bg-red-500";
                return "bg-gray-300";
              };

              const getStatusText = () => {
                if (lang.status === "completed") return "완료";
                if (lang.status === "translating") return "번역 중...";
                if (lang.status === "error") return "오류";
                return "대기 중";
              };

              return (
                <div key={lang.locale} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{lang.name}</span>
                      <span className="text-xs text-gray-500">({lang.locale})</span>
                      {lang.status === "translating" && (
                        <span className="text-xs text-blue-600 animate-pulse">●</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-600">
                        {lang.current} / {lang.total} ({progress.toFixed(0)}%)
                      </span>
                      <span
                        className={`text-xs font-medium ${
                          lang.status === "completed"
                            ? "text-green-600"
                            : lang.status === "error"
                            ? "text-red-600"
                            : lang.status === "translating"
                            ? "text-blue-600"
                            : "text-gray-500"
                        }`}
                      >
                        {getStatusText()}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${getStatusColor()}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  {lang.error && (
                    <div className="mt-2 text-xs text-red-600">{lang.error}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200">
          <button
            onClick={onCancel}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
          >
            번역 취소
          </button>
        </div>
      </div>
    </div>
  );
}

