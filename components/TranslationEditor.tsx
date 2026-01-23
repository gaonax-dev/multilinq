"use client";

import { useState, useEffect, useMemo } from "react";
import { getCurrentWork, updateTranslationValue, getMergedTranslations, deleteAdditionalTranslation, deleteOriginalTranslation, getSelectedLanguages, setSelectedLanguages } from "@/lib/storage";
import { getSourceInfo, getStringValue, getTranslatableKeys } from "@/lib/xcstrings-parser";
import { getCurrentActiveFilenamePublic } from "@/lib/storage";
import { calculateTranslationStatus } from "@/lib/merge-utils";
import type { XCStrings } from "@/types/xcstrings";

interface TranslationEditorProps {
  xcstrings: XCStrings | null;
  locale: string | null;
  onTranslationUpdate?: () => void;
  mode?: "translation" | "phonetic";
  refreshKey?: number;
}

export default function TranslationEditor({
  xcstrings,
  locale,
  onTranslationUpdate,
  mode = "translation",
  refreshKey = 0,
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedSourceScripts, setSelectedSourceScripts] = useState<Set<string>>(new Set());
  const [selectedPhoneticScripts, setSelectedPhoneticScripts] = useState<Set<string>>(new Set());

  // 문자 형식(스크립트) 추출 함수
  const extractScripts = (text: string): Set<string> => {
    if (!text) return new Set();
    
    const scripts = new Set<string>();
    
    // 유니코드 범위별 문자 형식 정의
    for (const char of text) {
      const code = char.charCodeAt(0);
      
      // 공백, 제어문자, 숫자 제외
      if (code <= 32 || (code >= 48 && code <= 57)) continue;
      
      // 히라가나 (ひらがな)
      if (code >= 0x3040 && code <= 0x309F) {
        scripts.add("히라가나");
      }
      // 가타카나 (カタカナ)
      else if (code >= 0x30A0 && code <= 0x30FF) {
        scripts.add("가타카나");
      }
      // 한자 (CJK 통합 한자)
      else if (code >= 0x4E00 && code <= 0x9FFF) {
        scripts.add("한자");
      }
      // 한글 완성형
      else if (code >= 0xAC00 && code <= 0xD7A3) {
        scripts.add("한글");
      }
      // 한글 자모
      else if (code >= 0x1100 && code <= 0x11FF) {
        scripts.add("한글자모");
      }
      // 주음부호 (注音符号, Bopomofo)
      else if (code >= 0x3105 && code <= 0x312F) {
        scripts.add("주음부호");
      }
      // 아랍 문자
      else if (code >= 0x0600 && code <= 0x06FF) {
        scripts.add("아랍문자");
      }
      // 히브리 문자
      else if (code >= 0x0590 && code <= 0x05FF) {
        scripts.add("히브리문자");
      }
      // 태국 문자
      else if (code >= 0x0E00 && code <= 0x0E7F) {
        scripts.add("태국문자");
      }
      // 그리스 문자
      else if (code >= 0x0370 && code <= 0x03FF) {
        scripts.add("그리스문자");
      }
      // 키릴 문자
      else if (code >= 0x0400 && code <= 0x04FF) {
        scripts.add("키릴문자");
      }
      // 조지아 문자
      else if (code >= 0x10A0 && code <= 0x10FF) {
        scripts.add("조지아문자");
      }
      // 아르메니아 문자
      else if (code >= 0x0530 && code <= 0x058F) {
        scripts.add("아르메니아문자");
      }
      // 라틴 문자 (기본 영문 알파벳)
      else if ((code >= 0x0041 && code <= 0x005A) || (code >= 0x0061 && code <= 0x007A)) {
        scripts.add("라틴문자");
      }
      // 라틴 확장 (다이어크리틱 포함)
      else if (code >= 0x00C0 && code <= 0x024F) {
        scripts.add("라틴확장");
      }
      // 기타 문자 (위에 해당하지 않는 모든 문자)
      else if (char.trim() && char.length > 0) {
        scripts.add("기타문자");
      }
    }
    
    return scripts;
  };

  useEffect(() => {
    if (!xcstrings || !locale) {
      setEntries([]);
      return;
    }

    const filename = getCurrentActiveFilenamePublic();
    const sourceKeys = getTranslatableKeys(xcstrings);
    const originalKeys = new Set(sourceKeys);
    const work = getCurrentWork(filename, originalKeys);
    const translation = work[locale];

    // 병합된 번역 가져오기
    const mergedTranslations = translation ? getMergedTranslations(translation) : {};
    
    const entryList = sourceKeys
      .map((key) => {
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
      })
      .filter((entry) => {
        // 모드에 따라 comment 필터링
        if (mode === "translation") {
          // 번역 모드: [PHONETIC]이 없는 것만
          return !entry.comment || !entry.comment.includes("[PHONETIC]");
        } else {
          // 음가변환 모드: [PHONETIC]이 있는 것만
          return entry.comment && entry.comment.includes("[PHONETIC]");
        }
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

    // 음가변환 모드일 때 문자 형식 필터링
    if (mode === "phonetic") {
      // 원문 문자 형식 필터링 (체크된 것이 있을 때만 필터링)
      if (selectedSourceScripts.size > 0) {
        filtered = filtered.filter((entry) => {
          const sourceScripts = extractScripts(entry.sourceText);
          return Array.from(selectedSourceScripts).some((script) => sourceScripts.has(script));
        });
      }
      
      // 발음 문자 형식 필터링 (체크된 것이 있을 때만 필터링)
      if (selectedPhoneticScripts.size > 0) {
        filtered = filtered.filter((entry) => {
          const phoneticScripts = extractScripts(entry.translatedValue);
          return Array.from(selectedPhoneticScripts).some((script) => phoneticScripts.has(script));
        });
      }
    }

    // 필터링된 항목을 entries에 저장하기 전에 entryList도 업데이트 (개수 계산용)
    // entryList는 필터링 전의 전체 목록이므로 그대로 유지

    setEntries(filtered);
  }, [xcstrings, locale, searchQuery, filter, mode, selectedSourceScripts, selectedPhoneticScripts, refreshKey]);

  const handleValueChange = (key: string, value: string) => {
    if (!locale || !xcstrings) return;

    const filename = getCurrentActiveFilenamePublic();
    updateTranslationValue(locale, key, value, undefined, undefined, undefined, filename);
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

  const handleDeleteSelected = async () => {
    if (!locale || selectedKeys.size === 0 || isDeleting || !xcstrings) return;

    const keysToDelete = Array.from(selectedKeys);
    setIsDeleting(true);

    try {
      // 비동기로 삭제 작업 수행
      await new Promise<void>((resolve) => {
        // 다음 틱에서 실행하여 UI가 업데이트될 시간을 줌
        setTimeout(() => {
          void (async () => {
            if (!xcstrings) return;
            const filename = getCurrentActiveFilenamePublic();
            
            if (filter === "translated") {
              // 번역 필터: 추가 번역만 삭제 (원본은 유지)
              keysToDelete.forEach((key) => {
                deleteAdditionalTranslation(locale, key, filename);
              });
            } else if (filter === "original") {
              // 원본 필터: 원본 번역 삭제 (원본 xcstrings는 IndexedDB를 사용할 수 있어 async)
              await Promise.all(keysToDelete.map((key) => deleteOriginalTranslation(locale, key, filename)));
            } else if (filter === "additional") {
              // 추가본 필터: 추가 번역 삭제
              keysToDelete.forEach((key) => {
                deleteAdditionalTranslation(locale, key, filename);
              });
            }

            // 삭제 후 번역 상태 확인
            const sourceKeys = getTranslatableKeys(xcstrings);
            const originalKeys = new Set(sourceKeys);
            const work = getCurrentWork(filename, originalKeys);
            const translation = work[locale];
            
            if (translation) {
              const status = calculateTranslationStatus(translation, sourceKeys);
              // 번역이 0%가 되면 선택된 언어 리스트에서도 제거
              if (status.percentage === 0) {
                const selectedLanguages = getSelectedLanguages();
                const updatedSelected = selectedLanguages.filter((l) => l !== locale);
                setSelectedLanguages(updatedSelected);
              }
            } else {
              // 번역 데이터가 없으면 선택된 언어 리스트에서 제거
              const selectedLanguages = getSelectedLanguages();
              const updatedSelected = selectedLanguages.filter((l) => l !== locale);
              setSelectedLanguages(updatedSelected);
            }

            setSelectedKeys(new Set());
            onTranslationUpdate?.();
            
            // 상태 업데이트를 위해 강제 리렌더링
            setEntries((prev) => prev.filter((entry) => !keysToDelete.includes(entry.key)));
            
            resolve();
          })().catch((error) => {
            console.error("선택 삭제 실패:", error);
            resolve();
          });
        }, 0);
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusColor = (entry: typeof entries[0]) => {
    if (entry.translatedValue && entry.translatedValue.trim()) {
      return "border-green-200 bg-green-50";
    }
    return "border-red-200 bg-red-50";
  };

  // 사용 가능한 문자 형식 목록 계산 (음가변환 모드일 때만)
  const availableSourceScripts = useMemo(() => {
    if (mode !== "phonetic" || !xcstrings || !locale) return [];
    
    const sourceKeys = getTranslatableKeys(xcstrings);
    const scriptCounts = new Map<string, number>();
    
    sourceKeys.forEach((key) => {
      const sourceInfo = getSourceInfo(xcstrings, key);
      if (sourceInfo?.comment && sourceInfo.comment.includes("[PHONETIC]")) {
        const sourceScripts = extractScripts(sourceInfo.sourceText || "");
        sourceScripts.forEach((script) => {
          scriptCounts.set(script, (scriptCounts.get(script) || 0) + 1);
        });
      }
    });
    
    return Array.from(scriptCounts.entries())
      .map(([script, count]) => ({ script, count }))
      .sort((a, b) => a.script.localeCompare(b.script));
  }, [mode, xcstrings, locale]);

  const availablePhoneticScripts = useMemo(() => {
    if (mode !== "phonetic" || !xcstrings || !locale) return [];
    
    const sourceKeys = getTranslatableKeys(xcstrings);
    const filename = getCurrentActiveFilenamePublic();
    const originalKeys = new Set(sourceKeys);
    const work = getCurrentWork(filename, originalKeys);
    const translation = work[locale];
    const mergedTranslations = translation ? getMergedTranslations(translation) : {};
    
    const scriptCounts = new Map<string, number>();
    sourceKeys.forEach((key) => {
      const sourceInfo = getSourceInfo(xcstrings, key);
      if (sourceInfo?.comment && sourceInfo.comment.includes("[PHONETIC]")) {
        const translatedValue = mergedTranslations[key] || "";
        
        if (translatedValue) {
          const phoneticScripts = extractScripts(translatedValue);
          phoneticScripts.forEach((script) => {
            scriptCounts.set(script, (scriptCounts.get(script) || 0) + 1);
          });
        }
      }
    });
    
    return Array.from(scriptCounts.entries())
      .map(([script, count]) => ({ script, count }))
      .sort((a, b) => a.script.localeCompare(b.script));
  }, [mode, xcstrings, locale, refreshKey]);

  const handleSourceScriptToggle = (script: string) => {
    setSelectedSourceScripts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(script)) {
        newSet.delete(script);
      } else {
        newSet.add(script);
      }
      return newSet;
    });
  };

  const handlePhoneticScriptToggle = (script: string) => {
    setSelectedPhoneticScripts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(script)) {
        newSet.delete(script);
      } else {
        newSet.add(script);
      }
      return newSet;
    });
  };

  const handleDeleteAllPhonetic = async () => {
    if (!locale || !xcstrings || mode !== "phonetic") return;

    // 음가변환 모드에서 번역값이 있는 항목만 필터링
    const phoneticEntries = entries.filter((entry) => entry.translatedValue && entry.translatedValue.trim());
    const count = phoneticEntries.length;

    if (count === 0) {
      alert("삭제할 음가 변환 결과가 없습니다.");
      return;
    }

    const confirmed = window.confirm(`${count}개 음가를 삭제하시겠습니까?`);
    if (!confirmed) return;

    setIsDeleting(true);

    try {
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          void (async () => {
            if (!xcstrings) return;
            const filename = getCurrentActiveFilenamePublic();
            
            // 모든 음가 변환 결과 삭제 (추가 번역 + 원본 번역 모두 삭제)
            await Promise.all(
              phoneticEntries.map(async (entry) => {
                // 추가 번역 삭제
                deleteAdditionalTranslation(locale, entry.key, filename);
                // 원본 번역도 삭제
                await deleteOriginalTranslation(locale, entry.key, filename);
              })
            );

            // 번역 상태 확인
            const sourceKeys = getTranslatableKeys(xcstrings);
            const originalKeys = new Set(sourceKeys);
            const work = getCurrentWork(filename, originalKeys);
            const translation = work[locale];
            
            if (translation) {
              const status = calculateTranslationStatus(translation, sourceKeys);
              // 번역이 0%가 되면 선택된 언어 리스트에서도 제거
              if (status.percentage === 0) {
                const selectedLanguages = getSelectedLanguages();
                const updatedSelected = selectedLanguages.filter((l) => l !== locale);
                setSelectedLanguages(updatedSelected);
              }
            } else {
              // 번역 데이터가 없으면 선택된 언어 리스트에서 제거
              const selectedLanguages = getSelectedLanguages();
              const updatedSelected = selectedLanguages.filter((l) => l !== locale);
              setSelectedLanguages(updatedSelected);
            }

            // 삭제 후 즉시 UI 업데이트를 위해 entries 상태 업데이트
            setEntries((prev) => 
              prev.map((entry) => {
                const wasDeleted = phoneticEntries.some((deleted) => deleted.key === entry.key);
                if (wasDeleted) {
                  return {
                    ...entry,
                    translatedValue: "",
                    originalValue: "",
                    additionalValue: "",
                    isOriginal: false,
                    isAdditional: false,
                  };
                }
                return entry;
              })
            );
            
            // onTranslationUpdate 호출로 refreshKey 업데이트 트리거
            onTranslationUpdate?.();
            
            resolve();
          })().catch((error) => {
            console.error("음가 변환 결과 삭제 실패:", error);
            alert("삭제 중 오류가 발생했습니다.");
            resolve();
          });
        }, 0);
      });
    } finally {
      setIsDeleting(false);
    }
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

        {/* 음가변환 모드일 때만 문자 형식 필터 표시 */}
        {mode === "phonetic" && (
          <div className="space-y-4 border-t pt-4 mt-4">
            <div>
              <div className="text-sm font-semibold text-gray-900 mb-3">
                해당 언어 알파벳 형식 (원문)
              </div>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-3 bg-gray-50 rounded-lg border border-gray-200">
                {availableSourceScripts.length > 0 ? (
                  availableSourceScripts.map(({ script, count }) => (
                    <label
                      key={script}
                      className="flex items-center gap-2 cursor-pointer hover:bg-blue-50 px-3 py-2 rounded border border-gray-300 bg-white transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSourceScripts.has(script)}
                        onChange={() => handleSourceScriptToggle(script)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                      />
                      <span className="text-sm font-medium text-gray-800">
                        {script} <span className="text-gray-500 font-normal">({count}개)</span>
                      </span>
                    </label>
                  ))
                ) : (
                  <div className="w-full text-center py-4">
                    <span className="text-sm text-gray-500">문자 형식이 없습니다.</span>
                  </div>
                )}
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900 mb-3">
                해당 언어 발음 알파벳 형식 (번역값)
              </div>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-3 bg-gray-50 rounded-lg border border-gray-200">
                {availablePhoneticScripts.length > 0 ? (
                  availablePhoneticScripts.map(({ script, count }) => (
                    <label
                      key={script}
                      className="flex items-center gap-2 cursor-pointer hover:bg-blue-50 px-3 py-2 rounded border border-gray-300 bg-white transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPhoneticScripts.has(script)}
                        onChange={() => handlePhoneticScriptToggle(script)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                      />
                      <span className="text-sm font-medium text-gray-800">
                        {script} <span className="text-gray-500 font-normal">({count}개)</span>
                      </span>
                    </label>
                  ))
                ) : (
                  <div className="w-full text-center py-4">
                    <span className="text-sm text-gray-500">문자 형식이 없습니다.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
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
        {mode === "phonetic" && entries.filter((e) => e.translatedValue && e.translatedValue.trim()).length > 0 && (
          <button
            onClick={handleDeleteAllPhonetic}
            disabled={isDeleting}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>삭제 중...</span>
              </>
            ) : (
              <span>결과값 삭제</span>
            )}
          </button>
        )}
        {(filter === "translated" || filter === "original" || filter === "additional") && entries.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={handleSelectAll}
              disabled={isDeleting}
              className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              전체 선택
            </button>
            {selectedKeys.size > 0 && (
              <>
                <button
                  onClick={handleDeselectAll}
                  disabled={isDeleting}
                  className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  선택 해제
                </button>
                <button
                  onClick={handleDeleteSelected}
                  disabled={isDeleting}
                  className="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {isDeleting ? (
                    <>
                      <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>삭제 중...</span>
                    </>
                  ) : (
                    <span>{filter === "translated" ? "선택 번역 제거" : "선택 삭제"} ({selectedKeys.size})</span>
                  )}
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
                  disabled={isDeleting}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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

