"use client";

import { useState, useEffect } from "react";
import { getCurrentWork, updateTranslationValue, getMergedTranslations, deleteAdditionalTranslation, deleteOriginalTranslation } from "@/lib/storage";
import { getSourceInfo, getStringValue } from "@/lib/xcstrings-parser";
import type { XCStrings } from "@/types/xcstrings";

interface TranslationEditorProps {
  xcstrings: XCStrings | null;
  locale: string | null;
  onTranslationUpdate?: () => void;
}

export default function TranslationEditor({
  xcstrings,
  locale,
  onTranslationUpdate,
}: TranslationEditorProps) {
  const [entries, setEntries] = useState<
    Array<{ 
      key: string; 
      sourceText: string; 
      comment?: string; 
      translatedValue: string;
      originalValue: string; // 원본 파일의 번역값
      additionalValue: string; // 추가 번역값
      isOriginal: boolean; // 원본 파일에 있던 번역인지
      isAdditional: boolean; // 추가 번역인지
    }>
  >([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "translated" | "untranslated" | "original" | "additional">("all");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!xcstrings || !locale) {
      setEntries([]);
      return;
    }

    const work = getCurrentWork();
    const translation = work[locale];
    const sourceKeys = Object.keys(xcstrings.strings).filter((k) => k !== "");

    // 병합된 번역 가져오기
    const mergedTranslations = translation ? getMergedTranslations(translation) : {};
    
    const entryList = sourceKeys.map((key) => {
      const sourceInfo = getSourceInfo(xcstrings, key);
      const entry = xcstrings.strings[key];
      
      // 원본 파일에서 해당 언어의 번역값 가져오기
      const originalValue = locale && entry ? getStringValue(entry, locale) : "";
      
      // 원본 번역 (xcstrings 파일에 있던 것)
      const originalTranslation = translation?.originalTranslations?.[key] || originalValue || "";
      
      // 추가 번역 (새로 번역한 것)
      const additionalTranslation = translation?.additionalTranslations?.[key] || "";
      
      // 병합된 번역값 (표시용)
      const translatedValue = mergedTranslations[key] || "";
      
      // 원본 파일에 번역값이 있었는지 확인
      const isOriginal = originalTranslation && originalTranslation.trim() ? true : false;
      // 추가 번역이 있는지 확인
      const isAdditional = additionalTranslation && additionalTranslation.trim() ? true : false;

      return {
        key,
        sourceText: sourceInfo?.sourceText || "",
        comment: sourceInfo?.comment,
        translatedValue,
        originalValue: originalTranslation,
        additionalValue: additionalTranslation,
        isOriginal,
        isAdditional,
      };
    });

    // 검색 필터링
    let filtered = searchQuery
      ? entryList.filter(
          (entry) =>
            entry.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
            entry.sourceText.toLowerCase().includes(searchQuery.toLowerCase()) ||
            entry.translatedValue.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : entryList;

    // 상태 필터링
    if (filter === "translated") {
      // 번역된 항목 (번역값이 있는 항목)
      filtered = filtered.filter((entry) => entry.translatedValue && entry.translatedValue.trim());
    } else if (filter === "untranslated") {
      // 미번역 항목 (번역값이 없는 항목)
      filtered = filtered.filter((entry) => !entry.translatedValue || !entry.translatedValue.trim());
    } else if (filter === "original") {
      // 원본: 사용자가 입력한 데이터의 번역본 (원본 파일에 있던 번역)
      filtered = filtered.filter((entry) => entry.isOriginal);
    } else if (filter === "additional") {
      // 추가본: 새로 번역해서 로컬에 저장된 번역본 (추가 번역이 있는 것)
      filtered = filtered.filter((entry) => entry.isAdditional);
    }
    // "all"은 모든 항목 표시

    setEntries(filtered);
  }, [xcstrings, locale, searchQuery, filter]);

  const handleValueChange = (key: string, value: string) => {
    if (!locale) return;

    updateTranslationValue(locale, key, value);
    onTranslationUpdate?.();

    // 로컬 상태 업데이트
    setEntries((prev) =>
      prev.map((entry) =>
        entry.key === key ? { ...entry, translatedValue: value } : entry
      )
    );
  };

  const handleToggleSelect = (key: string) => {
    setSelectedKeys((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (filter === "translated") {
      // 번역 필터: 번역된 항목만 선택
      setSelectedKeys(new Set(entries.map((e) => e.key)));
    } else if (filter === "original") {
      // 원본 필터: 원본 번역이 있는 항목만 선택
      const originalEntries = entries.filter((entry) => entry.isOriginal);
      setSelectedKeys(new Set(originalEntries.map((e) => e.key)));
    } else if (filter === "additional") {
      // 추가본 필터: 추가 번역이 있는 항목만 선택
      const additionalEntries = entries.filter((entry) => entry.isAdditional);
      setSelectedKeys(new Set(additionalEntries.map((e) => e.key)));
    }
  };

  const handleDeselectAll = () => {
    setSelectedKeys(new Set());
  };

  const handleDeleteSelected = () => {
    if (!locale || selectedKeys.size === 0) return;

    const keysToDelete = Array.from(selectedKeys);
    
    if (filter === "translated") {
      // 번역 필터: 추가 번역만 삭제 (원본은 유지)
      keysToDelete.forEach((key) => {
        deleteAdditionalTranslation(locale, key);
      });
    } else if (filter === "original") {
      // 원본 필터: 원본 번역 삭제
      keysToDelete.forEach((key) => {
        deleteOriginalTranslation(locale, key);
      });
    } else if (filter === "additional") {
      // 추가본 필터: 추가 번역 삭제
      keysToDelete.forEach((key) => {
        deleteAdditionalTranslation(locale, key);
      });
    }

    setSelectedKeys(new Set());
    onTranslationUpdate?.();
    
    // 상태 업데이트를 위해 강제 리렌더링
    setEntries((prev) => prev.filter((entry) => !keysToDelete.includes(entry.key)));
  };

  const getStatusColor = (entry: typeof entries[0]) => {
    if (entry.translatedValue && entry.translatedValue.trim()) {
      return "border-green-200 bg-green-50";
    }
    return "border-red-200 bg-red-50";
  };

  if (!xcstrings || !locale) {
    return (
      <div className="text-center text-gray-700 p-8">
        언어를 선택하세요.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <input
            type="text"
            placeholder="키, 원문, 번역값으로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === "all"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            전체
          </button>
          <button
            onClick={() => setFilter("translated")}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === "translated"
                ? "bg-green-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            번역
          </button>
          <button
            onClick={() => setFilter("untranslated")}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === "untranslated"
                ? "bg-red-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            미번역
          </button>
          <button
            onClick={() => setFilter("original")}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === "original"
                ? "bg-purple-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            원본
          </button>
          <button
            onClick={() => setFilter("additional")}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === "additional"
                ? "bg-orange-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            추가본
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-800">
          총 {entries.length}개 항목
          {(filter === "translated" || filter === "original" || filter === "additional") && selectedKeys.size > 0 && (
            <span className="ml-2 text-blue-600 font-medium">
              ({selectedKeys.size}개 선택됨)
            </span>
          )}
        </div>
        {(filter === "translated" || filter === "original" || filter === "additional") && entries.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={handleSelectAll}
              className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              전체 선택
            </button>
            {selectedKeys.size > 0 && (
              <>
                <button
                  onClick={handleDeselectAll}
                  className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                >
                  선택 해제
                </button>
                <button
                  onClick={handleDeleteSelected}
                  className="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  {filter === "translated" ? "선택 번역 제거" : "선택 삭제"} ({selectedKeys.size})
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4 max-h-[600px] overflow-y-auto">
        {entries.map((entry) => (
          <div
            key={entry.key}
            className={`border rounded-lg p-4 ${getStatusColor(entry)} ${
              (filter === "translated" || filter === "original" || filter === "additional") && selectedKeys.has(entry.key)
                ? "ring-2 ring-blue-500"
                : ""
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {(filter === "translated" || filter === "original" || filter === "additional") && (
                <input
                  type="checkbox"
                  checked={selectedKeys.has(entry.key)}
                  onChange={() => handleToggleSelect(entry.key)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
              )}
              <span className="font-mono text-sm font-semibold text-gray-900">
                {entry.key}
              </span>
              {entry.translatedValue && entry.translatedValue.trim() ? (
                <span className="text-xs px-2 py-1 bg-green-200 text-green-800 rounded">
                  번역됨
                </span>
              ) : (
                <span className="text-xs px-2 py-1 bg-red-200 text-red-800 rounded">
                  번역 필요
                </span>
              )}
            </div>

            {entry.comment && (
              <div className="text-xs text-gray-700 mb-2 italic">
                {entry.comment}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                번역 ({locale})
              </label>
              <textarea
                value={entry.translatedValue}
                onChange={(e) => handleValueChange(entry.key, e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                rows={3}
                placeholder="번역을 입력하세요..."
              />
            </div>
          </div>
        ))}

        {entries.length === 0 && (
          <div className="text-center text-gray-700 p-8">
            {searchQuery ? "검색 결과가 없습니다." : "번역할 항목이 없습니다."}
          </div>
        )}
      </div>
    </div>
  );
}

