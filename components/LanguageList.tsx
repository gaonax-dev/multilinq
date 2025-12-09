"use client";

import { useState, useEffect } from "react";
import { TARGET_LANGUAGES } from "@/lib/language-utils";
import { getCurrentWork, getSelectedLanguages, setSelectedLanguages } from "@/lib/storage";
import { calculateTranslationStatus } from "@/lib/merge-utils";
import type { XCStrings } from "@/types/xcstrings";
import type { LanguageInfo } from "@/types/translation";

interface LanguageListProps {
  xcstrings: XCStrings | null;
  selectedLocale: string | null;
  onLocaleSelect: (locale: string) => void;
}

export default function LanguageList({
  xcstrings,
  selectedLocale,
  onLocaleSelect,
}: LanguageListProps) {
  const [languages, setLanguages] = useState<LanguageInfo[]>([]);
  const [selectedLocales, setSelectedLocalesState] = useState<string[]>([]);

  useEffect(() => {
    if (!xcstrings) {
      setLanguages([]);
      return;
    }

    const work = getCurrentWork();
    const sourceKeys = Object.keys(xcstrings.strings).filter((k) => k !== "");
    const savedSelected = getSelectedLanguages();
    setSelectedLocalesState(savedSelected);

    const langInfos: LanguageInfo[] = [];

    // xcstrings에 있는 언어들
    const localesInFile = new Set<string>();
    Object.values(xcstrings.strings).forEach((entry) => {
      if (entry.localizations) {
        Object.keys(entry.localizations).forEach((locale) => {
          if (locale !== xcstrings.sourceLanguage) {
            localesInFile.add(locale);
          }
        });
      }
    });

    // 작업 데이터에 있는 언어들
    Object.keys(work).forEach((locale) => {
      if (locale !== xcstrings.sourceLanguage) {
        localesInFile.add(locale);
      }
    });

    localesInFile.forEach((locale) => {
      const translation = work[locale];
      if (translation) {
        const status = calculateTranslationStatus(translation, sourceKeys);
        const langOption = TARGET_LANGUAGES.find((l) => l.locale === locale);
        
        langInfos.push({
          name: langOption?.name || locale,
          locale,
          status,
          isSelected: savedSelected.includes(locale),
        });
      } else {
        // 번역 데이터가 없는 언어도 표시
        const langOption = TARGET_LANGUAGES.find((l) => l.locale === locale);
        langInfos.push({
          name: langOption?.name || locale,
          locale,
          status: {
            translated: 0,
            additional: 0,
            total: sourceKeys.length,
            percentage: 0,
            pending: 0,
          },
          isSelected: savedSelected.includes(locale),
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
  }, [xcstrings]);

  const handleCheckboxChange = (locale: string, checked: boolean) => {
    const newSelected = checked
      ? [...selectedLocales, locale]
      : selectedLocales.filter((l) => l !== locale);
    
    setSelectedLocalesState(newSelected);
    setSelectedLanguages(newSelected);
  };

  const getStatusEmoji = (status: LanguageInfo["status"]) => {
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
      {languages.map((lang) => (
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
            checked={lang.isSelected}
            onChange={(e) => {
              e.stopPropagation();
              handleCheckboxChange(lang.locale, e.target.checked);
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          
          <span className="flex-1 text-sm">
            <span className="mr-2">{getStatusEmoji(lang.status)}</span>
            <span className="font-medium text-gray-900">{lang.name}</span>
            <span className="text-gray-600 ml-2">({lang.locale})</span>
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
      ))}
      
      {languages.length === 0 && (
        <div className="text-sm text-gray-700 p-4 text-center">
          번역할 언어가 없습니다.
        </div>
      )}
    </div>
  );
}

