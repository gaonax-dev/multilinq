"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import TranslationProgress from "@/components/TranslationProgress";
import TranslationEditor from "@/components/TranslationEditor";
import BatchTranslationProgress from "@/components/BatchTranslationProgress";
import { getCurrentWork, getOriginalXCStrings, getSelectedLanguages, updateTranslationValue, getMergedTranslations, getTranslationApiKey, setTranslationApiKey, getTranslationProvider, setTranslationProvider as saveTranslationProvider, getAdditionalWork, getOriginalFilename, getCurrentActiveFilenamePublic } from "@/lib/storage";
import { calculateTranslationStatus, mergeXCStringsWithStorage, saveMergedData } from "@/lib/merge-utils";
import { findNameByLocale } from "@/lib/language-utils";
import { getSourceInfo, getTranslatableKeys, parseXCStrings, isNeedsReview } from "@/lib/xcstrings-parser";
import { requestWakeLock, releaseWakeLock } from "@/lib/wake-lock";
import type { XCStrings } from "@/types/xcstrings";
import type { TranslationStatus, TranslationProvider } from "@/types/translation";

interface TranslationProgressState {
  isTranslating: boolean;
  current: number;
  total: number;
  currentKey: string | null;
}

interface BatchTranslationProgressState {
  isVisible: boolean;
  totalLanguages: number;
  currentLanguageIndex: number;
  languages: Array<{
    locale: string;
    name: string;
    current: number;
    total: number;
    status: "pending" | "translating" | "completed" | "error";
    error?: string;
  }>;
  cancelToken: { cancelled: boolean } | null;
}

export default function Home() {
  const [xcstrings, setXCStrings] = useState<XCStrings | null>(null);
  const [selectedLocale, setSelectedLocale] = useState<string | null>(null);
  const [currentFilename, setCurrentFilename] = useState<string | null>(null);
  const [translationStatus, setTranslationStatus] = useState<TranslationStatus | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [translationProgress, setTranslationProgress] = useState<TranslationProgressState>({
    isTranslating: false,
    current: 0,
    total: 0,
    currentKey: null,
  });
  const [translationCancelToken, setTranslationCancelToken] = useState<{ cancelled: boolean } | null>(null);
  const [translationProvider, setTranslationProviderState] = useState<TranslationProvider>("google-translator");
  const [translationApiKey, setTranslationApiKeyState] = useState<string>("");
  const [isLoadingSaved, setIsLoadingSaved] = useState(true);
  const [batchTranslationProgress, setBatchTranslationProgress] = useState<BatchTranslationProgressState>({
    isVisible: false,
    totalLanguages: 0,
    currentLanguageIndex: -1,
    languages: [],
    cancelToken: null,
  });

  // 앱 시작 시 저장된 xcstrings 파일 및 API 키 자동 로드
  useEffect(() => {
    const loadSavedXCStrings = async () => {
      try {
        // 현재 활성 파일명 가져오기
        const activeFilename = getCurrentActiveFilenamePublic();
        
        if (activeFilename) {
          // 활성 파일명이 있으면 해당 파일 로드
          const savedContent = await getOriginalXCStrings(activeFilename);
          
          if (savedContent) {
            const parsed = parseXCStrings(savedContent);
            
            // 병합 로직 실행
            const result = mergeXCStringsWithStorage(parsed, activeFilename);
            saveMergedData(result, activeFilename, result.originalKeys);
            
            setXCStrings(parsed);
            setCurrentFilename(activeFilename);
            
            // 첫 번째 언어 자동 선택
            const originalKeys = new Set(getTranslatableKeys(parsed));
            const work = getCurrentWork(activeFilename, originalKeys);
            const locales = Object.keys(work);
            if (locales.length > 0) {
              setSelectedLocale(locales[0]);
            }
          }
        }
      } catch (error) {
        console.error("저장된 xcstrings 파일 로드 실패:", error);
      } finally {
        setIsLoadingSaved(false);
      }
    };

    // 저장된 번역 제공자 로드
    const savedProvider = getTranslationProvider();
    setTranslationProviderState(savedProvider as TranslationProvider);
    
    // 저장된 API 키 로드
    const savedApiKey = getTranslationApiKey(savedProvider);
    if (savedApiKey) {
      setTranslationApiKeyState(savedApiKey);
    }

    void loadSavedXCStrings();
  }, []);

  useEffect(() => {
    if (!xcstrings || !selectedLocale) {
      setTranslationStatus(null);
      return;
    }

    const sourceKeys = getTranslatableKeys(xcstrings);
    const originalKeys = new Set(sourceKeys);
    const work = getCurrentWork(currentFilename, originalKeys);
    const translation = work[selectedLocale];

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
  }, [xcstrings, selectedLocale, refreshKey, currentFilename]);

  const handleXCStringsLoad = (parsed: XCStrings, filename: string | null = null) => {
    setXCStrings(parsed);
    setCurrentFilename(filename);
    // 첫 번째 언어 자동 선택
    const sourceKeys = getTranslatableKeys(parsed);
    const originalKeys = new Set(sourceKeys);
    const work = getCurrentWork(filename, originalKeys);
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

  const translateLanguage = async (
    locale: string,
    cancelToken: { cancelled: boolean },
    onProgress: (current: number, total: number) => void
  ): Promise<{ success: number; total: number; error?: string; cancelled?: boolean }> => {
    if (!xcstrings) {
      return { success: 0, total: 0, error: "xcstrings 파일이 없습니다." };
    }

    const sourceKeys = getTranslatableKeys(xcstrings);
    const originalKeys = new Set(sourceKeys);
    const work = getCurrentWork(currentFilename, originalKeys);
    const translation = work[locale];
    
    // 번역 데이터가 없는 경우, xcstrings 파일에서 직접 확인
    let originalTranslations: Record<string, string> = {};
    let additionalTranslations: Record<string, string> = {};
    
    if (translation) {
      originalTranslations = translation.originalTranslations || {};
      additionalTranslations = translation.additionalTranslations || {};
    } else {
      // 번역 데이터가 없으면 xcstrings 파일에서 직접 원본 번역 수집
      sourceKeys.forEach((key) => {
        const entry = xcstrings.strings[key];
        if (entry?.localizations?.[locale]?.stringUnit?.value) {
          const value = entry.localizations[locale].stringUnit.value;
          if (value && value.trim()) {
            originalTranslations[key] = value;
          }
        }
      });
    }
    
    const missingTranslatedKeys = sourceKeys.filter((key) => {
      // "needs review" 상태인 경우 항상 재번역 대상
      if (isNeedsReview(xcstrings, key, locale)) {
        return true;
      }
      
      // 원본 번역 확인
      const originalValue = originalTranslations[key];
      const hasOriginal = originalValue && typeof originalValue === "string" && originalValue.trim().length > 0;
      
      // 추가 번역 확인
      const additionalValue = additionalTranslations[key];
      const hasAdditional = additionalValue && typeof additionalValue === "string" && additionalValue.trim().length > 0;
      
      // 원본 번역도 없고 추가 번역도 없는 경우만 번역 대상
      return !hasOriginal && !hasAdditional;
    });

    if (missingTranslatedKeys.length === 0) {
      return { success: 0, total: sourceKeys.length };
    }

    // 번역 데이터가 없으면 기본 구조 생성
    if (!translation) {
      // xcstrings 파일에서 sourceLanguage 찾기
      const sourceLanguage = xcstrings.sourceLanguage || "en";
      // 첫 번째 키의 sourceInfo 가져오기
      const firstKey = sourceKeys[0];
      const sourceInfo = firstKey ? getSourceInfo(xcstrings, firstKey) : null;
      
      // 기본 번역 구조 생성 (실제로는 번역만 수행하고 저장은 updateTranslationValue에서 처리)
    }
    
    // 유료 서비스의 경우 배치 번역 사용
    const isPaidService = ["google-cloud", "deepl", "openai", "claude"].includes(translationProvider);
    
    if (isPaidService) {
      // 배치 번역: 모든 키를 한 번에 번역
      try {
        const texts = missingTranslatedKeys.map((key) => {
          const sourceInfo = getSourceInfo(xcstrings, key);
          return {
            key,
            text: sourceInfo?.sourceText || key,
            comment: sourceInfo?.comment,
          };
        }).filter((item) => item.text && item.text.trim());

        if (texts.length === 0) {
          return { success: 0, total: missingTranslatedKeys.length };
        }

        // 초기 진행율 설정
        onProgress(0, texts.length);

        // API 요청 전 진행율 표시 (번역 요청 중)
        const response = await fetch("/api/translate", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            texts: texts.map((t) => ({ key: t.key, text: t.text })),
            sourceLanguage: xcstrings.sourceLanguage,
            targetLanguage: locale,
            provider: translationProvider,
            apiKey: translationApiKey || undefined,
            options: {
              preservePlaceholders: true,
              preserveLineBreaks: true,
            },
          }),
        });

        if (response.ok) {
          const result = await response.json();
          let successCount = 0;
          let processedCount = 0;

          // 결과 처리 중 진행율 업데이트
          texts.forEach((item, index) => {
            if (cancelToken.cancelled) {
              return; // 취소되면 더 이상 처리하지 않음 (이미 처리된 항목은 저장됨)
            }

            const translatedValue = result.results[item.key];
            if (translatedValue && translatedValue.trim()) {
              const sourceInfo = getSourceInfo(xcstrings, item.key);
              updateTranslationValue(
                locale,
                item.key,
                translatedValue.trim(),
                xcstrings.sourceLanguage,
                sourceInfo?.sourceText,
                sourceInfo?.comment,
                currentFilename
              );
              successCount++;
            }

            processedCount++;
            // 각 항목 처리 후 진행율 업데이트
            onProgress(processedCount, texts.length);
          });

          // 취소된 경우 실제 저장된 개수 반환
          return { 
            success: successCount, 
            total: texts.length, 
            cancelled: cancelToken.cancelled 
          };
        } else {
          const errorData = await response.json().catch(() => ({}));
          return { success: 0, total: texts.length, error: errorData.error || "배치 번역 실패" };
        }
      } catch (error) {
        console.error(`배치 번역 실패 (${locale}):`, error);
        return { success: 0, total: missingTranslatedKeys.length, error: error instanceof Error ? error.message : "알 수 없는 오류" };
      }
    } else {
      // 무료 서비스: 개별 번역 (기존 로직)
      let successCount = 0;

      for (let i = 0; i < missingTranslatedKeys.length; i++) {
        if (cancelToken.cancelled) {
          break;
        }

        const key = missingTranslatedKeys[i];
        onProgress(i + 1, missingTranslatedKeys.length);

        const sourceInfo = getSourceInfo(xcstrings, key);
        const sourceText = sourceInfo?.sourceText || key;

        if (!sourceText || !sourceText.trim()) {
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
              targetLanguage: locale,
              provider: translationProvider,
              apiKey: translationApiKey || undefined,
              comment: sourceInfo?.comment,
              options: {
                preservePlaceholders: true,
                preserveLineBreaks: true,
              },
            }),
          });

          if (response.ok) {
            const result = await response.json();
            if (result.translatedText && result.translatedText.trim()) {
              const translatedValue = result.translatedText.trim();
              updateTranslationValue(
                locale,
                key,
                translatedValue,
                xcstrings.sourceLanguage,
                sourceInfo?.sourceText,
                sourceInfo?.comment,
                currentFilename
              );
              successCount++;
            }
          }
        } catch (error) {
          console.error(`번역 실패 (${locale}/${key}):`, error);
        }

        // 무료 서비스만 딜레이 적용
        const minDelay = 1000;
        const maxDelay = 3000;
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      // 취소된 경우 실제 저장된 개수 반환
      return { 
        success: successCount, 
        total: missingTranslatedKeys.length,
        cancelled: cancelToken.cancelled
      };
    }
  };

  const handleTranslateAll = async () => {
    if (!xcstrings) {
      alert("xcstrings 파일을 먼저 업로드하세요.");
      return;
    }

    // API 키 필요 여부 확인
    const isPaidService = ["google-cloud", "deepl", "openai", "claude"].includes(translationProvider);
    if (isPaidService && (!translationApiKey || !translationApiKey.trim())) {
      alert("API 키가 필요합니다. 번역 설정에서 API 키를 입력하세요.");
      return;
    }

    const sourceKeys = getTranslatableKeys(xcstrings);
    const originalKeys = new Set(sourceKeys);
    const work = getCurrentWork(currentFilename, originalKeys);
    const allLocales = Object.keys(work).filter((l) => l !== xcstrings.sourceLanguage);
    
    if (allLocales.length === 0) {
      alert("번역할 언어가 없습니다.");
      return;
    }

    // Wake Lock 획득
    await requestWakeLock();

    const cancelToken = { cancelled: false };
    
    // 각 언어별 번역할 항목 수 미리 계산
    const allLanguages = allLocales.map((locale) => {
      const translation = work[locale];
      if (!translation) {
        return {
          locale,
          name: findNameByLocale(locale) || locale,
          current: 0,
          total: sourceKeys.length,
          status: "pending" as const,
        };
      }
      
      const originalTranslations = translation.originalTranslations || {};
      const additionalTranslations = translation.additionalTranslations || {};
      const missingCount = sourceKeys.filter((key) => {
        // "needs review" 상태인 경우 항상 재번역 대상
        if (isNeedsReview(xcstrings, key, locale)) {
          return true;
        }
        const originalValue = originalTranslations[key];
        const hasOriginal = originalValue && typeof originalValue === "string" && originalValue.trim().length > 0;
        const additionalValue = additionalTranslations[key];
        const hasAdditional = additionalValue && typeof additionalValue === "string" && additionalValue.trim().length > 0;
        return !hasOriginal && !hasAdditional;
      }).length;
      
      return {
        locale,
        name: findNameByLocale(locale) || locale,
        current: 0,
        total: missingCount,
        status: "pending" as const,
      };
    });
    
    // 번역할 단어가 있는 언어만 필터링
    const languages = allLanguages.filter((lang) => lang.total > 0);
    const locales = languages.map((lang) => lang.locale);
    
    if (locales.length === 0) {
      alert("번역할 단어가 있는 언어가 없습니다.");
      await releaseWakeLock();
      return;
    }

    setBatchTranslationProgress({
      isVisible: true,
      totalLanguages: locales.length,
      currentLanguageIndex: -1,
      languages,
      cancelToken,
    });

    try {
      for (let i = 0; i < locales.length; i++) {
        if (cancelToken.cancelled) {
          break;
        }

        const locale = locales[i];
        
        // 현재 언어를 번역 중으로 표시
        setBatchTranslationProgress((prev) => ({
          ...prev,
          currentLanguageIndex: i,
          languages: prev.languages.map((lang) =>
            lang.locale === locale ? { ...lang, status: "translating" as const } : lang
          ),
        }));

        const result = await translateLanguage(locale, cancelToken, (current, total) => {
          setBatchTranslationProgress((prev) => ({
            ...prev,
            languages: prev.languages.map((lang) =>
              lang.locale === locale
                ? { ...lang, current, total, status: "translating" as const }
                : lang
            ),
          }));
        });

        // 완료 상태로 업데이트
        setBatchTranslationProgress((prev) => ({
          ...prev,
          languages: prev.languages.map((lang) =>
            lang.locale === locale
              ? {
                  ...lang,
                  current: result.total,
                  total: result.total,
                  status: result.error ? ("error" as const) : (result.cancelled ? ("error" as const) : ("completed" as const)),
                  error: result.error || (result.cancelled ? `취소됨 (${result.success}개 저장됨)` : undefined),
                }
              : lang
          ),
        }));

        setRefreshKey((prev) => prev + 1);
      }
    } catch (error) {
      console.error("전체 언어 번역 오류:", error);
      alert(`번역 중 오류가 발생했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
    } finally {
      // Wake Lock 해제
      await releaseWakeLock();
    }
  };

  const handleTranslateSelected = async () => {
    if (!xcstrings) {
      alert("xcstrings 파일을 먼저 업로드하세요.");
      return;
    }

    // API 키 필요 여부 확인
    const isPaidService = ["google-cloud", "deepl", "openai", "claude"].includes(translationProvider);
    if (isPaidService && (!translationApiKey || !translationApiKey.trim())) {
      alert("API 키가 필요합니다. 번역 설정에서 API 키를 입력하세요.");
      return;
    }

    const allSelectedLocales = getSelectedLanguages(currentFilename);
    if (allSelectedLocales.length === 0) {
      alert("번역할 언어를 선택하세요.");
      return;
    }

    // Wake Lock 획득
    await requestWakeLock();

    const cancelToken = { cancelled: false };
    
    // 각 언어별 번역할 항목 수 미리 계산
    const sourceKeys = getTranslatableKeys(xcstrings);
    const originalKeys = new Set(sourceKeys);
    const work = getCurrentWork(currentFilename, originalKeys);
    const allLanguages = allSelectedLocales.map((locale) => {
      const translation = work[locale];
      if (!translation) {
        return {
          locale,
          name: findNameByLocale(locale) || locale,
          current: 0,
          total: sourceKeys.length,
          status: "pending" as const,
        };
      }
      
      const originalTranslations = translation.originalTranslations || {};
      const additionalTranslations = translation.additionalTranslations || {};
      const missingCount = sourceKeys.filter((key) => {
        // "needs review" 상태인 경우 항상 재번역 대상
        if (isNeedsReview(xcstrings, key, locale)) {
          return true;
        }
        const originalValue = originalTranslations[key];
        const hasOriginal = originalValue && typeof originalValue === "string" && originalValue.trim().length > 0;
        const additionalValue = additionalTranslations[key];
        const hasAdditional = additionalValue && typeof additionalValue === "string" && additionalValue.trim().length > 0;
        return !hasOriginal && !hasAdditional;
      }).length;
      
      return {
        locale,
        name: findNameByLocale(locale) || locale,
        current: 0,
        total: missingCount,
        status: "pending" as const,
      };
    });
    
    // 번역할 단어가 있는 언어만 필터링
    const languages = allLanguages.filter((lang) => lang.total > 0);
    const selectedLocales = languages.map((lang) => lang.locale);
    
    if (selectedLocales.length === 0) {
      alert("번역할 단어가 있는 언어가 없습니다.");
      await releaseWakeLock();
      return;
    }

    setBatchTranslationProgress({
      isVisible: true,
      totalLanguages: selectedLocales.length,
      currentLanguageIndex: -1,
      languages,
      cancelToken,
    });

    try {
      for (let i = 0; i < selectedLocales.length; i++) {
        if (cancelToken.cancelled) {
          break;
        }

        const locale = selectedLocales[i];
        
        // 현재 언어를 번역 중으로 표시
        setBatchTranslationProgress((prev) => ({
          ...prev,
          currentLanguageIndex: i,
          languages: prev.languages.map((lang) =>
            lang.locale === locale ? { ...lang, status: "translating" as const } : lang
          ),
        }));

        const result = await translateLanguage(locale, cancelToken, (current, total) => {
          setBatchTranslationProgress((prev) => ({
            ...prev,
            languages: prev.languages.map((lang) =>
              lang.locale === locale
                ? { ...lang, current, total, status: "translating" as const }
                : lang
            ),
          }));
        });

        // 완료 상태로 업데이트
        setBatchTranslationProgress((prev) => ({
          ...prev,
          languages: prev.languages.map((lang) =>
            lang.locale === locale
              ? {
                  ...lang,
                  current: result.total,
                  total: result.total,
                  status: result.error ? ("error" as const) : (result.cancelled ? ("error" as const) : ("completed" as const)),
                  error: result.error || (result.cancelled ? `취소됨 (${result.success}개 저장됨)` : undefined),
                }
              : lang
          ),
        }));

        setRefreshKey((prev) => prev + 1);
      }
    } catch (error) {
      console.error("선택 언어 번역 오류:", error);
      alert(`번역 중 오류가 발생했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
    } finally {
      // Wake Lock 해제
      await releaseWakeLock();
    }
  };

  const handleExport = async (exportAll: boolean) => {
    if (!xcstrings) {
      alert("xcstrings 파일을 먼저 업로드하세요.");
      return;
    }

    const originalContent = await getOriginalXCStrings(currentFilename);
    if (!originalContent) {
      alert("원본 xcstrings 파일이 없습니다.");
      return;
    }

    const sourceKeys = getTranslatableKeys(xcstrings);
    const originalKeys = new Set(sourceKeys);
    const work = getCurrentWork(currentFilename, originalKeys);
    const selectedLocales = exportAll ? Object.keys(work) : getSelectedLanguages(currentFilename);

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
      
      // 파일명 결정: 원본 파일명이 있으면 사용, 없으면 기본값
      const originalFilename = getOriginalFilename(currentFilename);
      const filename = originalFilename || currentFilename || "Localizable.xcstrings";
      
      // 파일 다운로드
      const blob = new Blob([data.content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
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
        onTranslateSelected={handleTranslateSelected}
        onExport={handleExport}
        translationProvider={translationProvider}
        translationApiKey={translationApiKey}
        onTranslationProviderChange={(provider) => {
          if (!translationProgress.isTranslating) {
            setTranslationProviderState(provider);
            // 번역 제공자를 로컬 스토리지에 저장
            saveTranslationProvider(provider);
            // provider 변경 시 해당 provider의 저장된 API 키 로드
            const savedApiKey = getTranslationApiKey(provider);
            setTranslationApiKeyState(savedApiKey);
          }
        }}
        onTranslationApiKeyChange={(key) => {
          if (!translationProgress.isTranslating) {
            setTranslationApiKeyState(key);
            // API 키를 로컬 스토리지에 저장
            setTranslationApiKey(translationProvider, key);
          }
        }}
        isTranslating={translationProgress.isTranslating}
        refreshKey={refreshKey}
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
                            onClick={async () => {
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
                                // Wake Lock 해제
                                await releaseWakeLock();
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
                          
                          const sourceKeys = getTranslatableKeys(xcstrings);
                          const originalKeys = new Set(sourceKeys);
                          const work = getCurrentWork(currentFilename, originalKeys);
                          const translation = work[selectedLocale];
                          if (!translation) return;
                          // 원본 번역과 추가 번역 모두 확인
                          const originalTranslations = translation.originalTranslations || {};
                          const additionalTranslations = translation.additionalTranslations || {};
                          // 원본 번역도 없고 추가 번역도 없는 항목만 필터링 (번역이 없는 항목만 번역)
                          const missingTranslatedKeys = sourceKeys.filter(
                            (key) => {
                              // 원본 번역 확인
                              const originalValue = originalTranslations[key];
                              const hasOriginal = originalValue && typeof originalValue === "string" && originalValue.trim().length > 0;
                              
                              // 추가 번역 확인
                              const additionalValue = additionalTranslations[key];
                              const hasAdditional = additionalValue && typeof additionalValue === "string" && additionalValue.trim().length > 0;
                              
                              // 원본 번역도 없고 추가 번역도 없는 경우만 번역 대상
                              return !hasOriginal && !hasAdditional;
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

                          // API 키 필요 여부 확인
                          const isPaidService = ["google-cloud", "deepl", "openai", "claude"].includes(translationProvider);
                          if (isPaidService && (!translationApiKey || !translationApiKey.trim())) {
                            alert("API 키가 필요합니다. 번역 설정에서 API 키를 입력하세요.");
                            return;
                          }

                          // Wake Lock 획득
                          await requestWakeLock();

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

                            // 유료 서비스의 경우 배치 번역 사용
                            const isPaidService = ["google-cloud", "deepl", "openai", "claude"].includes(translationProvider);

                            if (isPaidService) {
                              // 배치 번역: 모든 키를 한 번에 번역
                              const texts = missingTranslatedKeys.map((key) => {
                                const sourceInfo = getSourceInfo(xcstrings, key);
                                return {
                                  key,
                                  text: sourceInfo?.sourceText || key,
                                  comment: sourceInfo?.comment,
                                };
                              }).filter((item) => item.text && item.text.trim());

                              if (texts.length === 0) {
                                setTranslationProgress({
                                  isTranslating: false,
                                  current: 0,
                                  total: 0,
                                  currentKey: null,
                                });
                                setTranslationCancelToken(null);
                                return;
                              }

                              // 초기 진행율 설정
                              setTranslationProgress((prev) => ({
                                ...prev,
                                currentKey: "번역 요청 중...",
                                current: 0,
                                total: texts.length,
                              }));

                              try {
                                const response = await fetch("/api/translate", {
                                  method: "PUT",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    texts: texts.map((t) => ({ key: t.key, text: t.text })),
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

                                if (response.ok) {
                                  // 번역 결과 수신 완료, 처리 시작
                                  setTranslationProgress((prev) => ({
                                    ...prev,
                                    currentKey: "번역 결과 처리 중...",
                                    current: 0,
                                  }));

                                  const result = await response.json();
                                  
                                  // 결과 처리 중 진행율 업데이트
                                  let processedCount = 0;
                                  texts.forEach((item, index) => {
                                    if (cancelToken.cancelled) {
                                      return; // 취소되면 더 이상 처리하지 않음 (이미 처리된 항목은 저장됨)
                                    }

                                    const translatedValue = result.results[item.key];
                                    if (translatedValue && translatedValue.trim()) {
                                      const sourceInfo = getSourceInfo(xcstrings, item.key);
                                      updateTranslationValue(
                                        selectedLocale,
                                        item.key,
                                        translatedValue.trim(),
                                        xcstrings.sourceLanguage,
                                        sourceInfo?.sourceText,
                                        sourceInfo?.comment,
                                        currentFilename
                                      );
                                      
                                      // 저장 확인 (직접 additionalWork에서 확인)
                                      const savedAdditionalWork = getAdditionalWork(currentFilename);
                                      const savedAdditional = savedAdditionalWork[selectedLocale]?.[item.key];
                                      if (savedAdditional === translatedValue.trim()) {
                                        translatedCount++;
                                        console.log(`✓ 번역 성공 및 저장 완료 (${index + 1}/${texts.length}): ${item.key} = "${translatedValue.trim().substring(0, 30)}..."`);
                                      }
                                    }

                                    processedCount++;
                                    // 각 항목 처리 후 진행율 업데이트
                                    setTranslationProgress((prev) => ({
                                      ...prev,
                                      current: processedCount,
                                      currentKey: item.key,
                                    }));
                                  });
                                  
                                  // 취소된 경우 저장된 개수 알림
                                  if (cancelToken.cancelled && translatedCount > 0) {
                                    alert(`번역이 취소되었습니다. ${translatedCount}개 항목이 저장되었습니다.`);
                                  }
                                } else {
                                  const errorData = await response.json().catch(() => ({}));
                                  console.error("배치 번역 실패:", errorData.error || "알 수 없는 오류");
                                }
                              } catch (error) {
                                console.error("배치 번역 오류:", error);
                              }
                            } else {
                              // 무료 서비스: 개별 번역 (기존 로직)
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
                                      comment: sourceInfo?.comment,
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
                                      
                                      // 번역값 저장 (sourceLanguage, sourceText, comment 포함)
                                      updateTranslationValue(
                                        selectedLocale,
                                        key,
                                        translatedValue,
                                        xcstrings.sourceLanguage,
                                        sourceInfo?.sourceText,
                                        sourceInfo?.comment,
                                        currentFilename
                                      );
                                      
                                      // 저장 확인 (직접 additionalWork에서 확인)
                                      const savedAdditionalWork = getAdditionalWork(currentFilename);
                                      const savedAdditional = savedAdditionalWork[selectedLocale]?.[key];
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

                                // 무료 서비스만 딜레이 적용
                                const minDelay = 1000; // 1초
                                const maxDelay = 3000; // 3초
                                const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
                                await new Promise((resolve) => setTimeout(resolve, delay));
                              }
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
                            } else {
                              // 취소된 경우 저장된 개수 알림
                              if (translatedCount > 0) {
                                alert(`번역이 취소되었습니다. ${translatedCount}개 항목이 저장되었습니다.`);
                              } else {
                                alert(`번역이 취소되었습니다.`);
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
                          } finally {
                            // Wake Lock 해제
                            await releaseWakeLock();
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

      <BatchTranslationProgress
        isVisible={batchTranslationProgress.isVisible}
        totalLanguages={batchTranslationProgress.totalLanguages}
        currentLanguageIndex={batchTranslationProgress.currentLanguageIndex}
        languages={batchTranslationProgress.languages}
        onCancel={async () => {
          if (batchTranslationProgress.cancelToken) {
            batchTranslationProgress.cancelToken.cancelled = true;
          }
          setBatchTranslationProgress({
            isVisible: false,
            totalLanguages: 0,
            currentLanguageIndex: -1,
            languages: [],
            cancelToken: null,
          });
          setRefreshKey((prev) => prev + 1);
          // Wake Lock 해제
          await releaseWakeLock();
        }}
      />
    </div>
  );
}
