"use client";

import type { TranslationStatus } from "@/types/translation";

interface TranslationProgressProps {
  status: TranslationStatus;
  label?: string;
}

export default function TranslationProgress({
  status,
  label,
}: TranslationProgressProps) {
  const { translated, additional, total, percentage, pending } = status;

  const originalPercentage = total > 0 ? (translated / total) * 100 : 0;
  const additionalPercentage = total > 0 ? (additional / total) * 100 : 0;
  const pendingPercentage = total > 0 ? (pending / total) * 100 : 0;
  const remainingPercentage = 100 - originalPercentage - additionalPercentage - pendingPercentage;

  const getStatusColor = () => {
    if (percentage >= 100 && pending === 0) return "text-green-600";
    if (percentage > 0) return "text-orange-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className={`text-sm font-bold ${getStatusColor()}`}>
            {percentage.toFixed(1)}%
          </span>
        </div>
      )}
      
      <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
        {/* 원본 번역 (녹색) */}
        <div
          className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-300"
          style={{ width: `${originalPercentage}%` }}
        />
        
        {/* 추가 번역 (노란색) */}
        <div
          className="absolute top-0 h-full bg-yellow-400 transition-all duration-300"
          style={{
            left: `${originalPercentage}%`,
            width: `${additionalPercentage}%`,
          }}
        />
        
        {/* 대기 중인 번역 (투명) */}
        <div
          className="absolute top-0 h-full bg-transparent transition-all duration-300"
          style={{
            left: `${originalPercentage + additionalPercentage}%`,
            width: `${pendingPercentage}%`,
          }}
        />
        
        {/* 미번역 (투명) */}
        <div
          className="absolute top-0 h-full bg-transparent"
          style={{
            left: `${originalPercentage + additionalPercentage + pendingPercentage}%`,
            width: `${remainingPercentage}%`,
          }}
        />
      </div>
      
      <div className="flex justify-between text-xs text-gray-600">
        <span>
          원본: {translated} / 추가: {additional} / 대기: {pending} / 전체: {total}
        </span>
        <span className={getStatusColor()}>
          {translated + additional}/{additional}/{pending}/{total} (완료/추가/대기/전체)
        </span>
      </div>
    </div>
  );
}

