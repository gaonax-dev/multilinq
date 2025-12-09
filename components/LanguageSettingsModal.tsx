"use client";

import { useState, useEffect } from "react";
import { getOpenAISupportedLanguages, setOpenAISupportedLanguages, getClaudeSupportedLanguages, setClaudeSupportedLanguages } from "@/lib/storage";
import { TARGET_LANGUAGES } from "@/lib/language-utils";
import type { TranslationProvider } from "@/types/translation";

interface LanguageSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider: TranslationProvider;
}

export default function LanguageSettingsModal({
  isOpen,
  onClose,
  provider,
}: LanguageSettingsModalProps) {
  const [supportedLanguages, setSupportedLanguages] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (provider === "openai") {
        const saved = getOpenAISupportedLanguages();
        setSupportedLanguages(saved);
      } else if (provider === "claude") {
        const saved = getClaudeSupportedLanguages();
        setSupportedLanguages(saved);
      }
    }
  }, [isOpen, provider]);

  const handleToggleLanguage = (locale: string) => {
    if (supportedLanguages.includes(locale)) {
      setSupportedLanguages(supportedLanguages.filter((l) => l !== locale));
    } else {
      setSupportedLanguages([...supportedLanguages, locale]);
    }
  };

  const handleSave = () => {
    if (provider === "openai") {
      setOpenAISupportedLanguages(supportedLanguages);
    } else if (provider === "claude") {
      setClaudeSupportedLanguages(supportedLanguages);
    }
    onClose();
  };

  const handleReset = () => {
    // 기본값으로 초기화
    const defaultSupported = [
      "ko",
      "en",
      "en-US",
      "en-GB",
      "ja",
      "zh-Hans",
      "zh-Hant",
      "zh-CN",
      "zh-TW",
      "zh-HK",
      "fr",
      "de",
      "es",
      "es-ES",
      "es-419",
      "es-US",
      "it",
      "pt-PT",
      "pt-BR",
      "ru",
      "nl",
      "sv",
      "da",
      "fi",
      "nb",
      "pl",
      "cs",
      "hu",
      "el",
      "ro",
      "uk",
      "tr",
      "ar",
      "he",
      "hi",
      "bn",
      "ta",
      "te",
      "kn",
      "ml",
      "mr",
      "ur",
      "id",
      "ms",
      "th",
      "vi",
      "fil",
      "tl",
    ];
    setSupportedLanguages(defaultSupported);
  };

  if (!isOpen) return null;

  const filteredLanguages = TARGET_LANGUAGES.filter((lang) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      lang.name.toLowerCase().includes(query) ||
      lang.locale.toLowerCase().includes(query)
    );
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              {provider === "openai" ? "OpenAI" : "Claude"} 지원 언어 설정
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {provider === "openai" ? "OpenAI" : "Claude"}를 선택했을 때 지원되는 언어를 설정합니다. 지원되지 않는 언어는 회색과 취소선으로 표시됩니다.
          </p>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          <div className="mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="언어 검색..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="space-y-2">
            {filteredLanguages.map((lang) => {
              const isSupported = supportedLanguages.includes(lang.locale);
              return (
                <div
                  key={lang.locale}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    isSupported
                      ? "bg-green-50 border-green-200"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSupported}
                    onChange={() => handleToggleLanguage(lang.locale)}
                    className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{lang.name}</div>
                    <div className="text-xs text-gray-600">{lang.locale}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            기본값으로 초기화
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

