"use client";

import { useState, useEffect } from "react";
import { TARGET_LANGUAGES, isGoogleTranslatorUnsupported } from "@/lib/language-utils";
import { getCurrentWork, getSelectedLanguages, setSelectedLanguages } from "@/lib/storage";
import { calculateTranslationStatus } from "@/lib/merge-utils";
import { getTranslatableKeys } from "@/lib/xcstrings-parser";
import { getCurrentActiveFilenamePublic } from "@/lib/storage";
import type { XCStrings } from "@/types/xcstrings";
import type { LanguageInfo, TranslationProvider } from "@/types/translation";

interface LanguageListProps {
  xcstrings: XCStrings | null;
  selectedLocale: string | null;
  onLocaleSelect: (locale: string) => void;
  translationProvider?: TranslationProvider;
  refreshKey?: number;
}

export default function LanguageList({
  xcstrings,
  selectedLocale,
  onLocaleSelect,
  translationProvider,
  refreshKey = 0,
}: LanguageListProps) {
  const [languages, setLanguages] = useState<LanguageInfo[]>([]);
  const [selectedLocales, setSelectedLocalesState] = useState<string[]>([]);

  // 초기 로드 시 selectedLocales 설정
  useEffect(() => {
    if (!xcstrings) return;
    const filename = getCurrentActiveFilenamePublic();
    const savedSelected = getSelectedLanguages(filename);
    if (savedSelected.length > 0 && selectedLocales.length === 0) {
      setSelectedLocalesState(savedSelected);
    }
  }, [xcstrings]);


  useEffect(() => {
    if (!xcstrings) {
      setLanguages([]);
      return;
    }

    const filename = getCurrentActiveFilenamePublic();
    const sourceKeys = getTranslatableKeys(xcstrings);
    const originalKeys = new Set(sourceKeys);
    const work = getCurrentWork(filename, originalKeys);
    // selectedLocales가 있으면 사용, 없으면 localStorage에서 가져오기
    const currentSelected = selectedLocales.length > 0 ? selectedLocales : getSelectedLanguages(filename);

    const langInfos: LanguageInfo[] = [];

    // xcstrings 파일에서 모든 언어 수집 (generateLanguageTranslations 사용)
    const allLocalesFromFile = new Set<string>();
    Object.values(xcstrings.strings).forEach((entry) => {
      if (entry.localizations) {
        Object.keys(entry.localizations).forEach((locale) => {
          if (locale !== xcstrings.sourceLanguage) {
            allLocalesFromFile.add(locale);
          }
        });
      }
    });

    // 작업 데이터에 있는 언어들도 추가 (추가 번역만 있는 경우)
    Object.keys(work).forEach((locale) => {
      if (locale !== xcstrings.sourceLanguage) {
        allLocalesFromFile.add(locale);
      }
    });

    // 모든 언어에 대해 처리
    allLocalesFromFile.forEach((locale) => {
      const translation = work[locale];
      const langOption = TARGET_LANGUAGES.find((l) => l.locale === locale);
      
      if (translation) {
        // 작업 데이터에 있는 언어: 번역 상태 계산
        const status = calculateTranslationStatus(translation, sourceKeys);
        langInfos.push({
          name: langOption?.name || locale,
          locale,
          status,
          isSelected: currentSelected.includes(locale),
        });
      } else {
        // 작업 데이터에 없지만 xcstrings 파일에 있는 언어: 번역이 없는 상태로 표시
        // xcstrings 파일에서 해당 언어의 번역 개수 확인
        let translatedCount = 0;
        sourceKeys.forEach((key) => {
          const entry = xcstrings.strings[key];
          const value = entry?.localizations?.[locale]?.stringUnit?.value;
          if (value && value.trim()) {
            translatedCount++;
          }
        });
        
        langInfos.push({
          name: langOption?.name || locale,
          locale,
          status: {
            translated: translatedCount,
            additional: 0,
            total: sourceKeys.length,
            percentage: sourceKeys.length > 0 ? (translatedCount / sourceKeys.length) * 100 : 0,
            pending: sourceKeys.length - translatedCount,
          },
          isSelected: currentSelected.includes(locale),
        });
      }
    });

    // 정렬: 완료율 높은 순, 그 다음 이름 순
    langInfos.sort((a, b) => {
      if (a.status.percentage !== b.status.percentage) {
        return b.status.percentage - a.status.percentage;
      }
      return a.name.localeCompare(b.name);
    });

    setLanguages(langInfos);
  }, [xcstrings, selectedLocales, refreshKey]);

  const handleCheckboxChange = (locale: string, checked: boolean) => {
    const newSelected = checked
      ? [...selectedLocales, locale]
      : selectedLocales.filter((l) => l !== locale);
    
    setSelectedLocalesState(newSelected);
    const filename = getCurrentActiveFilenamePublic();
    setSelectedLanguages(newSelected, filename);
  };

  const getStatusEmoji = (status: LanguageInfo["status"], locale: string) => {
    // Google Translator에서 확장자 에러가 발생하는 언어인 경우 노란색 경고 표시
    if (translationProvider === "google-translator" && isGoogleTranslatorUnsupported(locale)) {
      return "⚠️";
    }
    if (status.pending > 0) return "🟡";
    if (status.percentage === 0) return "🔴";
    if (status.percentage >= 100) return "🟢";
    return "🟠";
  };

  const getStatusColor = (status: LanguageInfo["status"]) => {
    if (status.pending > 0) return "text-yellow-600";
    if (status.percentage === 0) return "text-red-600";
    if (status.percentage >= 100) return "text-green-600";
    return "text-orange-600";
  };

  if (!xcstrings) {
    return (
      <div className="text-sm text-gray-700 p-4">
        xcstrings 파일을 업로드하세요.
      </div>
    );
  }


  return (
    <div className="space-y-1">
      {languages.map((lang) => {
        return (
          <div
            key={lang.locale}
            className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
              selectedLocale === lang.locale
                ? "bg-blue-50 border border-blue-200"
                : "hover:bg-gray-50"
            }`}
            onClick={() => onLocaleSelect(lang.locale)}
          >
            <input
              type="checkbox"
              checked={selectedLocales.includes(lang.locale)}
              onChange={(e) => {
                e.stopPropagation();
                handleCheckboxChange(lang.locale, e.target.checked);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            
            <span className="flex-1 text-sm">
              <span className="mr-2">{getStatusEmoji(lang.status, lang.locale)}</span>
              <span className="font-medium text-gray-900">{lang.name}</span>
              <span className="ml-2 text-gray-600">({lang.locale})</span>
              {translationProvider === "google-translator" && isGoogleTranslatorUnsupported(lang.locale) && (
                <span className="ml-2 text-xs text-yellow-600 font-medium">(Google 번역 미지원)</span>
              )}
            </span>
            
            <span className={`text-xs font-medium ${getStatusColor(lang.status)}`}>
              {lang.status.translated}
              {lang.status.additional > 0 && (
                <>
                  +<span className="bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded-full font-semibold ml-0.5">
                    {lang.status.additional}
                  </span>
                </>
              )}
              /{lang.status.total} ({lang.status.percentage.toFixed(0)}%)
            </span>
          </div>
        );
      })}
      
      {languages.length === 0 && (
        <div className="text-sm text-gray-700 p-4 text-center">
          번역할 언어가 없습니다.
        </div>
      )}
    </div>
  );
}

