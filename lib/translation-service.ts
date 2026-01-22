/**
 * 다중 번역 API 통합 서비스
 */

import type { TranslationRequest, TranslationResponse } from "@/types/translation";
import {
  getTranslationLocale,
  protectPlaceholders,
  restorePlaceholders,
} from "./language-utils";

/**
 * Google Translator (무료, 비공식 Web API)
 */
async function translateWithGoogleTranslator(
  text: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<string> {
  try {
    // @iamtraction/google-translate 사용 (CommonJS 모듈)
    // Next.js 서버 사이드에서 require 사용
    const translate = require("@iamtraction/google-translate");
    
    const source = getTranslationLocale(sourceLanguage);
    const target = getTranslationLocale(targetLanguage);
    
    // 재시도 로직 (최대 3회)
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await translate(text, {
          from: source,
          to: target,
        });
        
        if (!result || !result.text) {
          throw new Error("번역 결과가 비어있습니다");
        }
        
        return result.text;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // 마지막 시도가 아니면 잠시 대기 후 재시도
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }
    
    // 모든 재시도 실패
    throw lastError || new Error("Google Translator 번역 실패");
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Google Translator 오류: ${error.message}`);
    }
    throw new Error("Google Translator 번역 실패");
  }
}

/**
 * Google Cloud Translate (공식 API)
 */
async function translateWithGoogleCloud(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
  apiKey?: string
): Promise<string> {
  if (!apiKey) {
    throw new Error("Google Cloud API 키가 필요합니다.");
  }
  
  const { Translate } = await import("@google-cloud/translate");
  const translate = new Translate({ key: apiKey });
  
  const source = getTranslationLocale(sourceLanguage);
  const target = getTranslationLocale(targetLanguage);
  
  const [translation] = await translate.translate(text, {
    from: source,
    to: target,
  });
  
  return translation;
}

/**
 * DeepL 번역
 */
async function translateWithDeepL(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
  apiKey?: string
): Promise<string> {
  if (!apiKey) {
    throw new Error("DeepL API 키가 필요합니다.");
  }
  
  const deepl = await import("deepl-node");
  const translator = new deepl.Translator(apiKey);
  
  const source = getTranslationLocale(sourceLanguage);
  const target = getTranslationLocale(targetLanguage);
  
  const result = await translator.translateText(text, source, target);
  
  return result.text;
}

/**
 * 음가 결과 후처리 (괄호 제거, 원문과 동일 여부 확인)
 */
function postProcessPhoneticResult(result: string, originalText: string, sourceLanguage: string, targetLanguage: string): string {
  // 괄호 제거
  let processed = result.replace(/[()]/g, "").trim();
  
  // 타겟 언어와 원문이 다른 경우에만 원문과 동일 여부 확인
  if (sourceLanguage !== targetLanguage) {
    // 원문과 동일하면 경고 (플레이스홀더 제외하고 비교)
    const originalWithoutPlaceholders = originalText.replace(/%\d*\$?[@\w]+/g, "").replace(/[()]/g, "").trim();
    const processedWithoutPlaceholders = processed.replace(/%\d*\$?[@\w]+/g, "").trim();
    
    if (originalWithoutPlaceholders && processedWithoutPlaceholders === originalWithoutPlaceholders) {
      console.warn(`[음가 변환] 원문과 동일한 결과 반환됨: "${originalText}" → "${processed}"`);
    }
  }
  
  return processed;
}

/**
 * OpenAI GPT 번역
 */
async function translateWithOpenAI(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
  apiKey?: string,
  comment?: string
): Promise<string> {
  if (!apiKey) {
    throw new Error("OpenAI API 키가 필요합니다.");
  }
  
  // OpenAI SDK import (Next.js API route에서 동적 import 사용)
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey });
  
  const isPhoneticMode = comment && comment.includes("[PHONETIC]");
  const prompt = buildAITranslationPrompt(text, sourceLanguage, targetLanguage, comment);
  
  // system message 설정 (음가 생성 모드와 일반 번역 모드 구분)
  const systemMessage = isPhoneticMode
    ? "You are a phonetic transcription specialist. Output ONLY the phonetic notation with no explanations, no introductory phrases, and no additional text. Never write 'the pronunciation is' or similar phrases. Just the notation itself."
    : "You are a professional translator specializing in iOS app localization.";
  
  // gpt-5.1 또는 gpt-3.5-turbo 사용 (gpt-4는 일부 계정에서 접근 불가)
  try {
    // 먼저 gpt-5.1 시도, 실패하면 gpt-3.5-turbo 사용
    const completion = await client.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        {
          role: "system",
          content: systemMessage,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
    });
    
    const result = completion.choices[0]?.message?.content || text;
    return isPhoneticMode ? postProcessPhoneticResult(result, text, sourceLanguage, targetLanguage) : result;
  } catch (error: any) {
    // gpt-4-turbo가 실패하면 gpt-3.5-turbo로 재시도
    if (error?.status === 404 || error?.message?.includes("does not exist")) {
      console.warn("gpt-4-turbo 모델을 사용할 수 없어 gpt-3.5-turbo로 재시도합니다.");
      const completion = await client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: systemMessage,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
      });
      
      const result = completion.choices[0]?.message?.content || text;
      return isPhoneticMode ? postProcessPhoneticResult(result, text, sourceLanguage, targetLanguage) : result;
    }
    throw error;
  }
}

/**
 * Claude 번역
 */
async function translateWithClaude(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
  apiKey?: string,
  comment?: string
): Promise<string> {
  if (!apiKey) {
    throw new Error("Claude API 키가 필요합니다.");
  }
  
  const Anthropic = await import("@anthropic-ai/sdk");
  const anthropic = new Anthropic.Anthropic({ apiKey });
  
  const isPhoneticMode = comment && comment.includes("[PHONETIC]");
  const prompt = buildAITranslationPrompt(text, sourceLanguage, targetLanguage, comment);
  
  // Claude는 system message를 별도로 지원하므로 프롬프트에 포함
  const fullPrompt = isPhoneticMode
    ? "You are a phonetic transcription specialist. Your task is to provide phonetic pronunciation of text, NOT translation.\n\n" + prompt
    : prompt;
  
  const message = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: fullPrompt,
      },
    ],
  });
  
  const content = message.content[0];
  if (content.type === "text") {
    const result = content.text;
    return isPhoneticMode ? postProcessPhoneticResult(result, text, sourceLanguage, targetLanguage) : result;
  }
  
  return text;
}

/**
 * 언어별 음가 변환 추가 규칙 (해당 언어 타겟일 때만 적용)
 */
function getPhoneticRulesForLanguage(targetLanguage: string): string {
  switch (targetLanguage) {
    // 동아시아
    case "ja":
      return "- Use Hiragana (ひらがな) and/or Katakana (カタカナ) only.";
    case "ko":
      return "- Use Revised Romanization of Korean (국어의 로마자 표기법) only.";
    case "zh-Hans":
      return "- Use Hanyu Pinyin (汉语拼音, pinyin) only.";
    case "zh-Hant":
      return "- Use Zhuyin (注音符号, Bopomofo) only.";
    case "zh-HK":
      return "- Use Yale romanization for Cantonese only.";

    // 중동·아프리카
    case "ar":
      return "- Use romanization/transliteration (Latin script) only.";
    case "iw":
      return "- Use Hebrew romanization (Latin script) only.";

    // 인도·남아시아
    case "hi":
    case "bn":
    case "ta":
    case "te":
    case "kn":
    case "ml":
    case "mr":
    case "pa":
    case "ur":
    case "ne":
    case "si":
      return "- Use ISO 15919 or standard Latin transliteration only.";

    // 동남아시아
    case "th":
      return "- Use RTGS (Royal Thai General System of Transcription) only.";
    case "vi":
      return "- Use Vietnamese orthography (Quốc ngữ) only.";
    case "km":
      return "- Use Khmer romanization (UNGEGN or ALA-LC) only.";
    case "lo":
      return "- Use Lao romanization only.";
    case "my":
      return "- Use Burmese romanization (MLCTS) only.";
    case "id":
      return "- Use Indonesian orthography (Latin) only.";
    case "ms":
      return "- Use Malay orthography (Latin) only.";
    case "fil":
      return "- Use Filipino orthography (Latin) only.";

    // 유럽 (비라틴 문자)
    case "el":
      return "- Use Greek romanization (ISO 843 or UN) only.";
    case "uk":
    case "be":
    case "bg":
    case "kk":
      return "- Use Cyrillic-to-Latin romanization (ISO 9 style) only.";
    case "ka":
      return "- Use Georgian romanization (ISO 9984 or national) only.";
    case "hy":
      return "- Use Armenian romanization (ISO 9985 or traditional) only.";

    default:
      return "";
  }
}

/**
 * AI 번역 프롬프트 생성 (레퍼런스 코드 기반)
 */
function buildAITranslationPrompt(text: string, sourceLanguage: string, targetLanguage: string, comment?: string): string {
  const languageNames: Record<string, string> = {
    "en-GB": "English (UK)",
    "en-AU": "English (AU)",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese (Portugal)",
    "pt-BR": "Portuguese (Brazil)",
    "es": "Spanish (Spain)",
    "es-US": "Spanish (US)",
    "ja": "Japanese",
    "ko": "Korean",
    "zh-Hans": "Chinese (Simplified)",
    "zh-Hant": "Chinese (Traditional)",
    "zh-HK": "Chinese (Hong Kong)",
    "ar": "Arabic",
    // ... 더 많은 언어 추가 가능
  };
  
  const langName = languageNames[targetLanguage] || targetLanguage;
  const sourceLangName = languageNames[sourceLanguage] || sourceLanguage;
  
  // comment에 [PHONETIC]이 포함되어 있으면 음가 생성 모드
  const isPhoneticMode = comment && comment.includes("[PHONETIC]");
  
  // 텍스트에서 플레이스홀더 찾기
  const placeholderPattern = /%\d*\$?[@\w]+/g;
  const placeholders = text.match(placeholderPattern) || [];
  
  let prompt: string;
  
  if (isPhoneticMode) {
    const textWithoutParentheses = text.replace(/[()]/g, "").replace(/\n/g, " ");
    const langSpecificRules = getPhoneticRulesForLanguage(targetLanguage).trim();
    
    prompt = `CRITICAL RULES:
  1. Output ONLY the phonetic notation/pronunciation itself
  2. NO explanations, NO descriptions, NO additional text
  3. NO phrases like "the pronunciation is...", "it sounds like...", etc.
  4. NO parentheses, NO quotation marks around the output
  5. Use ${langName} (${targetLanguage}) script/notation only
  ${langSpecificRules ? `6. ${langSpecificRules}` : ''}
  
  Text: ${textWithoutParentheses}
  
  Output (phonetic notation only):`;
  } else {
    // 일반 번역 모드
    prompt = `Translate the following English text to ${langName} (${targetLanguage}).

CRITICAL TRANSLATION RULES:
1. DO NOT translate placeholders - Keep them EXACTLY as they appear in the original
2. Placeholders in this text: ${placeholders.length > 0 ? placeholders.join(", ") : "none"}
3. Examples of placeholders you MUST preserve: %lld, %@, %1$lld, %1$@, %2$s, %d, etc.
4. DO NOT replace placeholders with translated text like "__PLACEHOLDER_0__" or "__placeholder_0__"
5. Preserve line breaks (\\n) exactly as in the original text
6. Use the sequence: \`xcodebuild -exportLocalizations\` → machine translation → \`xcodebuild -importLocalizations\`
7. Maintain the exact format and structure of placeholders`;

    // comment가 있으면 컨텍스트로 추가
    if (comment && comment.trim()) {
      prompt += `\n\nContext/Note: ${comment}`;
    }

    prompt += `\n\nText to translate:\n\n${text}\n\nProvide only the translation without any additional text or labels.`;
  }

  return prompt;
}

/**
 * 번역 실행 (플레이스홀더 보존 처리 포함)
 */
export async function translateText(
  request: TranslationRequest
): Promise<TranslationResponse> {
  const { text, sourceLanguage, targetLanguage, provider, apiKey, comment, options } = request;
  
  if (!text || !text.trim()) {
    return {
      translatedText: "",
      provider,
      sourceLanguage,
      targetLanguage,
    };
  }
  
  // 플레이스홀더 보존 처리
  const preservePlaceholders = options?.preservePlaceholders !== false;
  const preserveLineBreaks = options?.preserveLineBreaks !== false;
  
  const { protected: protectedText, placeholders } = preservePlaceholders
    ? protectPlaceholders(text)
    : { protected: text, placeholders: [] };
  
  // 줄바꿈 보존을 위한 처리 (줄바꿈을 임시 마커로 변환)
  const lineBreakMarker = "__LINE_BREAK__";
  const textWithMarkers = preserveLineBreaks
    ? protectedText.replace(/\n/g, lineBreakMarker)
    : protectedText;
  
  let translated: string;
  
  try {
    switch (provider) {
      case "google-translator":
        translated = await translateWithGoogleTranslator(
          textWithMarkers,
          sourceLanguage,
          targetLanguage
        );
        break;
      case "google-cloud":
        translated = await translateWithGoogleCloud(
          textWithMarkers,
          sourceLanguage,
          targetLanguage,
          apiKey
        );
        break;
      case "deepl":
        translated = await translateWithDeepL(
          textWithMarkers,
          sourceLanguage,
          targetLanguage,
          apiKey
        );
        break;
      case "openai":
        translated = await translateWithOpenAI(
          textWithMarkers,
          sourceLanguage,
          targetLanguage,
          apiKey,
          comment
        );
        break;
      case "claude":
        translated = await translateWithClaude(
          textWithMarkers,
          sourceLanguage,
          targetLanguage,
          apiKey,
          comment
        );
        break;
      default:
        throw new Error(`지원하지 않는 번역 제공자: ${provider}`);
    }
    
    // 줄바꿈 복원
    let finalTranslated = preserveLineBreaks
      ? translated.replace(new RegExp(lineBreakMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "g"), "\n")
      : translated;
    
    // 앞뒤 공백 제거
    finalTranslated = finalTranslated.trim();
    
    // "번역 (모든 플레이스홀더를 표시된 그대로 유지):" 텍스트 제거
    finalTranslated = finalTranslated.replace(/^번역\s*\(모든\s*플레이스홀더를\s*표시된\s*그대로\s*유지\)\s*:\s*/i, "").trim();
    
    // 플레이스홀더 복원
    if (preservePlaceholders && placeholders.length > 0) {
      finalTranslated = restorePlaceholders(finalTranslated, placeholders);
      
      // 복원 후 검증: 원본 플레이스홀더가 모두 복원되었는지 확인
      const missingPlaceholders = placeholders.filter(ph => !finalTranslated.includes(ph));
      if (missingPlaceholders.length > 0) {
        console.warn("일부 플레이스홀더가 복원되지 않았습니다:", missingPlaceholders);
        // 복원 실패한 경우 원본 텍스트의 플레이스홀더를 직접 찾아서 복원 시도
        missingPlaceholders.forEach((ph, idx) => {
          const marker = `__PH${placeholders.indexOf(ph)}__`;
          if (finalTranslated.includes(marker)) {
            finalTranslated = finalTranslated.replace(marker, ph);
          } else {
            // 마커가 번역된 경우를 대비해 원본 텍스트에서 직접 추출
            const originalPh = text.match(new RegExp(ph.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))?.[0];
            if (originalPh) {
              // 번역된 마커 패턴 찾기 (예: "__자리 표시자_0__", "__PLACEHOLDER_0__" 등)
              const translatedMarkerPatterns = [
                new RegExp(`__[^_]*표시자[^_]*${idx}[^_]*__`, 'gi'),
                new RegExp(`__PLACEHOLDER[^_]*${idx}[^_]*__`, 'gi'),
                new RegExp(`__PH[^_]*${idx}[^_]*__`, 'gi'),
              ];
              
              translatedMarkerPatterns.forEach(pattern => {
                if (pattern.test(finalTranslated)) {
                  finalTranslated = finalTranslated.replace(pattern, ph);
                }
              });
            }
          }
        });
      }
    }
    
    return {
      translatedText: finalTranslated,
      provider,
      sourceLanguage,
      targetLanguage,
    };
  } catch (error) {
    console.error(`번역 실패 (${provider}):`, error);
    const errorMessage = error instanceof Error 
      ? error.message 
      : `번역 실패: ${String(error)}`;
    throw new Error(`${provider} 번역 오류: ${errorMessage}`);
  }
}

