/**
 * AI 프롬프트 생성 시스템
 *
 * Gemini AI를 활용하여 입력 데이터를 분석하고
 * 이미지 생성 프롬프트를 자동으로 구성합니다.
 */

import { loadAllOptions } from './optionLoader.js';
import { generateAiImageComplete } from '../api/ai/aiApi.js';

// 캐싱된 옵션 데이터
let cachedOptions = null;

/**
 * 옵션 데이터 로드 (캐싱)
 * @returns {Promise<Object>} 옵션 데이터
 */
async function getOptions() {
  if (cachedOptions) {
    return cachedOptions;
  }
  cachedOptions = await loadAllOptions();
  return cachedOptions;
}

/**
 * AI 이미지 생성 요청 (전체 플로우)
 *
 * 1. 옵션 데이터 로드
 * 2. 프로필 사진 + 본문 + 참조 이미지를 분석하여 프롬프트 생성
 * 3. 생성된 프롬프트로 이미지 생성
 *
 * @param {Object} params
 * @param {string} params.content - 게시글 본문
 * @param {{data: string, mimeType: string}} params.avatarImage - 프로필 사진 Base64
 * @param {{data: string, mimeType: string}|null} params.referenceImage - 참조 이미지 Base64 (선택)
 * @param {Function} params.onProgress - 진행 상태 콜백 (선택)
 * @returns {Promise<{prompt: string, image: {data: string, mimeType: string}}>}
 */
export async function generateAiImage({
  content,
  avatarImage,
  referenceImage = null,
  onProgress = null,
}) {
  // 옵션 데이터 로드
  if (onProgress) {
    onProgress({ step: 'options', message: '옵션 데이터 로드 중...' });
  }

  const options = await getOptions();

  // AI API 호출
  const result = await generateAiImageComplete({
    profileImageBase64: avatarImage.data,
    postContent: content,
    referenceImageBase64: referenceImage?.data || null,
    options,
    onProgress,
  });

  return result;
}
