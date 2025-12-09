/**
 * AI API 클라이언트 모듈
 *
 * Express 프록시를 통해 Gemini API를 호출합니다.
 * API 키는 서버에서만 사용되어 클라이언트에 노출되지 않습니다.
 */

import { logger } from '../../utils/logger.js';

/**
 * AI 프롬프트 생성 요청 (Express 프록시 경유)
 * @param {Object} params
 * @param {string} params.profileImageBase64 - 프로필 사진 Base64
 * @param {string} params.profileImageMimeType - 프로필 사진 MIME 타입
 * @param {string} params.postContent - 게시글 본문
 * @param {string|null} params.referenceImageBase64 - 참조 이미지 Base64 (선택)
 * @param {string|null} params.referenceImageMimeType - 참조 이미지 MIME 타입 (선택)
 * @param {Object} params.options - 옵션 데이터 (style, location 등)
 * @returns {Promise<Object>} - AI가 생성한 프롬프트 및 속성
 */
export async function generatePrompt({
  profileImageBase64,
  profileImageMimeType = 'image/jpeg',
  postContent,
  referenceImageBase64 = null,
  referenceImageMimeType = null,
  options = null,
}) {
  const response = await fetch('/api/ai/generate-prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profileImageBase64,
      profileImageMimeType,
      postContent,
      referenceImageBase64,
      referenceImageMimeType,
      options,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `프롬프트 생성 실패: ${response.status}`
    );
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || '프롬프트 생성에 실패했습니다.');
  }

  return {
    prompt: data.prompt,
    rawResponse: data.rawResponse,
  };
}

/**
 * AI 이미지 생성 요청 (Express 프록시 경유)
 * @param {Object} params
 * @param {string} params.prompt - AI가 생성한 이미지 프롬프트
 * @param {string} params.profileImageBase64 - 프로필 사진 Base64
 * @param {string} params.profileImageMimeType - 프로필 사진 MIME 타입
 * @param {string|null} params.referenceImageBase64 - 참조 이미지 Base64 (선택)
 * @param {string|null} params.referenceImageMimeType - 참조 이미지 MIME 타입 (선택)
 * @returns {Promise<{data: string, mimeType: string}>} - 생성된 이미지 Base64
 */
export async function generateImage({
  prompt,
  profileImageBase64,
  profileImageMimeType = 'image/jpeg',
  referenceImageBase64 = null,
  referenceImageMimeType = null,
}) {
  const response = await fetch('/api/ai/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      profileImageBase64,
      profileImageMimeType,
      referenceImageBase64,
      referenceImageMimeType,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `이미지 생성 실패: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success || !data.image) {
    throw new Error(data.error || '이미지 생성에 실패했습니다.');
  }

  return data.image;
}

/**
 * AI 이미지 생성 전체 플로우 (프롬프트 생성 + 이미지 생성)
 * @param {Object} params
 * @param {string} params.profileImageBase64 - 프로필 사진 Base64
 * @param {string} params.profileImageMimeType - 프로필 사진 MIME 타입
 * @param {string} params.postContent - 게시글 본문
 * @param {string|null} params.referenceImageBase64 - 참조 이미지 Base64 (선택)
 * @param {string|null} params.referenceImageMimeType - 참조 이미지 MIME 타입 (선택)
 * @param {Object} params.options - 옵션 데이터 (선택)
 * @param {Function} params.onProgress - 진행 상태 콜백 (선택)
 * @returns {Promise<{prompt: string, image: {data: string, mimeType: string}}>}
 */
export async function generateAiImageComplete({
  profileImageBase64,
  profileImageMimeType = 'image/jpeg',
  postContent,
  referenceImageBase64 = null,
  referenceImageMimeType = null,
  options = null,
  onProgress = null,
}) {
  // 1단계: 프롬프트 생성
  if (onProgress) {
    onProgress({ step: 'prompt', message: '프롬프트 생성 중...' });
  }

  const { prompt } = await generatePrompt({
    profileImageBase64,
    profileImageMimeType,
    postContent,
    referenceImageBase64,
    referenceImageMimeType,
    options,
  });

  logger.debug('[AI API] 생성된 프롬프트:', prompt);

  // 2단계: 이미지 생성
  if (onProgress) {
    onProgress({ step: 'image', message: '이미지 생성 중...' });
  }

  const image = await generateImage({
    prompt,
    profileImageBase64,
    profileImageMimeType,
    referenceImageBase64,
    referenceImageMimeType,
  });

  logger.debug('[AI API] 이미지 생성 완료');

  return { prompt, image };
}
