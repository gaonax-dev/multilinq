"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import TranslationProgress from "@/components/TranslationProgress";
import TranslationEditor from "@/components/TranslationEditor";
import { getCurrentWork, getOriginalXCStrings, getSelectedLanguages, updateTranslationValue, getCurrentWork as getCurrentWorkStorage, getMergedTranslations } from "@/lib/storage";
import { calculateTranslationStatus, mergeXCStringsWithStorage, saveMergedData } from "@/lib/merge-utils";
import { findNameByLocale } from "@/lib/language-utils";
import { getSourceInfo, parseXCStrings } from "@/lib/xcstrings-parser";
import type { XCStrings } from "@/types/xcstrings";
import type { TranslationStatus } from "@/types/translation";

interface TranslationProgressState {
  isTranslating: boolean;
  current: number;
  total: number;
  currentKey: string | null;
}

export default function Home() {
  const [xcstrings, setXCStrings] = useState<XCStrings | null>(null);
  const [selectedLocale, setSelectedLocale] = useState<string | null>(null);
  const [translationStatus, setTranslationStatus] = useState<TranslationStatus | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [translationProgress, setTranslationProgress] = useState<TranslationProgressState>({
    isTranslating: false,
    current: 0,
    total: 0,
    currentKey: null,
  });
  const [translationCancelToken, setTranslationCancelToken] = useState<{ cancelled: boolean } | null>(null);
  const [translationProvider, setTranslationProvider] = useState<string>("google-translator");
  const [translationApiKey, setTranslationApiKey] = useState<string>("");
  const [isLoadingSaved, setIsLoadingSaved] = useState(true);

  // 앱 시작 시 저장된 xcstrings 파일 자동 로드
  useEffect(() => {
    const loadSavedXCStrings = () => {
      try {
        const savedContent = getOriginalXCStrings();
        if (savedContent) {
          const parsed = parseXCStrings(savedContent);
          
          // 병합 로직 실행
          const result = mergeXCStringsWithStorage(parsed);
          saveMergedData(result);
          
          setXCStrings(parsed);
          
          // 첫 번째 언어 자동 선택
          const work = getCurrentWork();
          const locales = Object.keys(work);
          if (locales.length > 0) {
            setSelectedLocale(locales[0]);
          }
        }
      } catch (error) {
        console.error("저장된 xcstrings 파일 로드 실패:", error);
      } finally {
        setIsLoadingSaved(false);
      }
    };

    loadSavedXCStrings();
  }, []);

  useEffect(() => {
    if (!xcstrings || !selectedLocale) {
      setTranslationStatus(null);
      return;
    }

    const work = getCurrentWork();
    const translation = work[selectedLocale];
    const sourceKeys = Object.keys(xcstrings.strings).filter((k) => k !== "");

    if (translation) {
      const status = calculateTranslationStatus(translation, sourceKeys);
      setTranslationStatus(status);
    } else {
      setTranslationStatus({
        translated: 0,
        additional: 0,
        total: sourceKeys.length,
        percentage: 0,
        pending: 0,
      });
    }
  }, [xcstrings, selectedLocale, refreshKey]);

  const handleXCStringsLoad = (parsed: XCStrings) => {
    setXCStrings(parsed);
    // 첫 번째 언어 자동 선택
    const work = getCurrentWork();
    const locales = Object.keys(work);
    if (locales.length > 0) {
      setSelectedLocale(locales[0]);
    }
    // 상태 업데이트를 위해 refreshKey 증가
    setRefreshKey((prev) => prev + 1);
  };

  const handleLocaleSelect = (locale: string) => {
    setSelectedLocale(locale);
  };

  const handleTranslateAll = async () => {
    if (!xcstrings) {
      alert("xcstrings 파일을 먼저 업로드하세요.");
      return;
    }

    const work = getCurrentWork();
    const locales = Object.keys(work);
    const sourceKeys = Object.keys(xcstrings.strings).filter((k) => k !== "");

    // TODO: 실제 번역 API 호출 구현
    alert(`전체 ${locales.length}개 언어 번역을 시작합니다.`);
  };

  const handleExport = async (exportAll: boolean) => {
    if (!xcstrings) {
      alert("xcstrings 파일을 먼저 업로드하세요.");
      return;
    }

    const originalContent = getOriginalXCStrings();
    if (!originalContent) {
      alert("원본 xcstrings 파일이 없습니다.");
      return;
    }

    const work = getCurrentWork();
    const selectedLocales = exportAll ? Object.keys(work) : getSelectedLanguages();

    if (selectedLocales.length === 0) {
      alert("내보낼 언어를 선택하세요.");
      return;
    }

    // 번역 데이터 준비 (병합된 translations 사용)
    const translations: Record<string, Record<string, string>> = {};
    selectedLocales.forEach((locale) => {
      const translation = work[locale];
      if (translation) {
        translations[locale] = getMergedTranslations(translation);
      }
    });

    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          originalXCStrings: originalContent,
          translations,
          selectedLocales: exportAll ? undefined : selectedLocales,
          exportAll,
        }),
      });

      if (!response.ok) {
        throw new Error("내보내기 실패");
      }

      const data = await response.json();
      
      // 파일 다운로드
      const blob = new Blob([data.content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename || "Localizable.xcstrings";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert(`내보내기 완료: ${selectedLocales.length}개 언어`);
    } catch (error) {
      console.error("내보내기 오류:", error);
      alert(`내보내기 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
    }
  };

  const handleTranslationUpdate = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const selectedLanguageName = selectedLocale ? findNameByLocale(selectedLocale) : null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        xcstrings={xcstrings}
        selectedLocale={selectedLocale}
        onXCStringsLoad={handleXCStringsLoad}
        onLocaleSelect={handleLocaleSelect}
        onTranslateAll={handleTranslateAll}
        onExport={handleExport}
        translationProvider={translationProvider}
        translationApiKey={translationApiKey}
        onTranslationProviderChange={(provider) => {
          if (!translationProgress.isTranslating) {
            setTranslationProvider(provider);
          }
        }}
        onTranslationApiKeyChange={(key) => {
          if (!translationProgress.isTranslating) {
            setTranslationApiKey(key);
          }
        }}
        isTranslating={translationProgress.isTranslating}
      />

      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="p-6 space-y-6">
          {isLoadingSaved ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <h2 className="text-xl font-semibold text-gray-700 mb-2">
                저장된 파일을 불러오는 중...
              </h2>
            </div>
          ) : xcstrings ? (
            <>
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  {selectedLanguageName || selectedLocale || "언어 선택"}
                </h2>
                
                {translationStatus && (
                  <TranslationProgress
                    status={translationStatus}
                    label="번역 진행률"
                  />
                )}

                {selectedLocale && (
                  <div className="mt-4 space-y-4">
                    {translationProgress.isTranslating ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">
                            번역 진행 중...
                          </span>
                          <button
                            onClick={() => {
                              if (translationCancelToken) {
                                translationCancelToken.cancelled = true;
                                setTranslationCancelToken(null);
                                setTranslationProgress({
                                  isTranslating: false,
                                  current: 0,
                                  total: 0,
                                  currentKey: null,
                                });
                                alert(`번역이 취소되었습니다. ${translationProgress.current}개 항목이 저장되었습니다.`);
                                setRefreshKey((prev) => prev + 1);
                              }
                            }}
                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-medium"
                          >
                            취소
                          </button>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                            style={{
                              width: `${translationProgress.total > 0 ? (translationProgress.current / translationProgress.total) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>
                            {translationProgress.current} / {translationProgress.total}
                          </span>
                          <span>
                            {translationProgress.currentKey ? `번역 중: ${translationProgress.currentKey}` : ""}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={async () => {
                          if (!xcstrings || !selectedLocale) return;
                          
                          const work = getCurrentWork();
                          const translation = work[selectedLocale];
                          if (!translation) return;

                          const sourceKeys = Object.keys(xcstrings.strings).filter((k) => k !== "");
                          // 원본 번역만 확인 (추가 번역 제외)
                          const originalTranslations = translation.originalTranslations || {};
                          // 원본 번역이 없는 항목만 필터링 (번역이 없는 항목만 번역)
                          const missingTranslatedKeys = sourceKeys.filter(
                            (key) => {
                              const value = originalTranslations[key];
                              return !value || typeof value !== "string" || value.trim().length === 0;
                            }
                          );

                          console.log(`=== 번역 대상 목록 (${missingTranslatedKeys.length}개) ===`);
                          console.log(`기본 언어: ${xcstrings.sourceLanguage}`);
                          missingTranslatedKeys.forEach((key, index) => {
                            const originalValue = originalTranslations[key] || "";
                            const additionalValue = translation.additionalTranslations?.[key] || "";
                            const sourceInfo = getSourceInfo(xcstrings, key);
                            const entry = xcstrings.strings[key];
                            const hasLocalizations = !!entry?.localizations;
                            const sourceLocalization = entry?.localizations?.[xcstrings.sourceLanguage];
                            const sourceValue = sourceLocalization?.stringUnit?.value;
                            
                            console.log(`${index + 1}. [${key}]`);
                            console.log(`   원문 (getSourceInfo): "${sourceInfo?.sourceText || ""}"`);
                            console.log(`   원문 (직접 접근): "${sourceValue || ""}"`);
                            console.log(`   localizations 존재: ${hasLocalizations}`);
                            console.log(`   sourceLanguage localization 존재: ${!!sourceLocalization}`);
                            console.log(`   원본 번역: "${originalValue || ""}"`);
                            console.log(`   추가 번역: "${additionalValue || ""}"`);
                            
                            // 원문이 없으면 entry 구조 전체 출력 (처음 3개만)
                            if (!sourceValue && index < 3) {
                              console.log(`   [디버그] entry 구조:`, JSON.stringify(entry, null, 2));
                            }
                          });
                          console.log(`=== 번역 시작 ===`);

                          if (missingTranslatedKeys.length === 0) {
                            alert("번역할 항목이 없습니다. 모든 항목이 원본 번역을 가지고 있습니다.");
                            return;
                          }

                          // 번역 시작
                          const cancelToken = { cancelled: false };
                          setTranslationCancelToken(cancelToken);
                          setTranslationProgress({
                            isTranslating: true,
                            current: 0,
                            total: missingTranslatedKeys.length,
                            currentKey: null,
                          });

                          try {
                            let translatedCount = 0;

                            for (let i = 0; i < missingTranslatedKeys.length; i++) {
                              const key = missingTranslatedKeys[i];
                              
                              if (cancelToken.cancelled) {
                                break;
                              }

                              // 진행률 업데이트 (시작 시)
                              setTranslationProgress((prev) => ({
                                ...prev,
                                currentKey: key,
                                current: i,
                              }));

                              const sourceInfo = getSourceInfo(xcstrings, key);
                              // 원본 텍스트가 없으면 키 자체를 원문으로 사용
                              const sourceText = sourceInfo?.sourceText || key;
                              
                              if (!sourceText || !sourceText.trim()) {
                                // 진행률만 업데이트하고 건너뛰기
                                setTranslationProgress((prev) => ({
                                  ...prev,
                                  current: i + 1,
                                }));
                                continue;
                              }

                              try {
                                const response = await fetch("/api/translate", {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    text: sourceText,
                                    sourceLanguage: xcstrings.sourceLanguage,
                                    targetLanguage: selectedLocale,
                                    provider: translationProvider,
                                    apiKey: translationApiKey || undefined,
                                    options: {
                                      preservePlaceholders: true,
                                      preserveLineBreaks: true,
                                    },
                                  }),
                                });

                                if (!response.ok) {
                                  const errorData = await response.json().catch(() => ({}));
                                  const errorMessage = errorData.error || `번역 실패 (HTTP ${response.status})`;
                                  console.error(`번역 실패 (${key}):`, errorMessage);
                                  // 에러가 발생해도 계속 진행
                                } else {
                                  const result = await response.json();
                                  
                                  if (result.error) {
                                    console.error(`번역 실패 (${key}):`, result.error);
                                  } else if (result.translatedText && result.translatedText.trim()) {
                                    const translatedValue = result.translatedText.trim();
                                    
                                    // sourceInfo에서 정보 가져오기
                                    const sourceInfo = getSourceInfo(xcstrings, key);
                                    
                                    // 번역값 저장 (sourceLanguage, sourceText, comment 포함)
                                    updateTranslationValue(
                                      selectedLocale,
                                      key,
                                      translatedValue,
                                      xcstrings.sourceLanguage,
                                      sourceInfo?.sourceText,
                                      sourceInfo?.comment
                                    );
                                    
                                    // 저장 확인
                                    const saved = getCurrentWorkStorage();
                                    const savedAdditional = saved[selectedLocale]?.additionalTranslations?.[key];
                                    if (savedAdditional === translatedValue) {
                                      translatedCount++;
                                      console.log(`✓ 번역 성공 및 저장 완료 (${i + 1}/${missingTranslatedKeys.length}): ${key} = "${translatedValue.substring(0, 30)}..."`);
                                    } else {
                                      console.error(`✗ 번역 저장 실패 (${key}): 저장된 값이 일치하지 않음. 저장된 값: "${savedAdditional}", 번역 값: "${translatedValue}"`);
                                    }
                                  } else {
                                    console.warn(`번역 결과가 비어있습니다 (${key})`, result);
                                  }
                                }
                              } catch (error) {
                                console.error(`번역 실패 (${key}):`, error);
                                // 에러가 발생해도 계속 진행 (다음 항목 번역)
                              }

                              // 진행률 업데이트 (각 항목 처리 후)
                              setTranslationProgress((prev) => ({
                                ...prev,
                                current: i + 1,
                              }));

                              // API 제한을 위한 대기 (1초~3초 랜덤)
                              const minDelay = 1000; // 1초
                              const maxDelay = 3000; // 3초
                              const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
                              await new Promise((resolve) => setTimeout(resolve, delay));
                            }
                            
                            // 최종 진행률 업데이트
                            setTranslationProgress((prev) => ({
                              ...prev,
                              current: missingTranslatedKeys.length,
                            }));

                            if (!cancelToken.cancelled) {
                              if (translatedCount > 0) {
                                alert(`번역 완료: ${translatedCount}개 항목이 번역되었습니다.`);
                              } else {
                                alert(`번역 완료: ${missingTranslatedKeys.length}개 항목을 처리했지만 번역 결과가 없습니다. 콘솔을 확인하세요.`);
                              }
                            }

                            setTranslationProgress({
                              isTranslating: false,
                              current: 0,
                              total: 0,
                              currentKey: null,
                            });
                            setTranslationCancelToken(null);
                            setRefreshKey((prev) => prev + 1);
                          } catch (error) {
                            console.error("번역 오류:", error);
                            alert(`번역 중 오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
                            setTranslationProgress({
                              isTranslating: false,
                              current: 0,
                              total: 0,
                              currentKey: null,
                            });
                            setTranslationCancelToken(null);
                            setRefreshKey((prev) => prev + 1);
                          }
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        해당 언어 번역
                      </button>
                    )}
                  </div>
                )}
              </div>

              {selectedLocale && (
                <div className="bg-white rounded-lg shadow p-6">
                  <TranslationEditor
                    xcstrings={xcstrings}
                    locale={selectedLocale}
                    onTranslationUpdate={handleTranslationUpdate}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                xcstrings 파일을 업로드하세요
              </h2>
              <p className="text-gray-700">
                왼쪽 사이드바에서 Localizable.xcstrings 파일을 업로드하여 시작하세요.
          </p>
        </div>
          )}
        </div>
      </main>
    </div>
  );
}
