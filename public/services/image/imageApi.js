import { del, get, post } from '../httpClient.js';
import { generateAiImageComplete } from '../ai/aiApi.js';
import { getImageUploadApi } from '../api-config.js';
import { logger } from '../../utils/logger.js';

// ============ AI 이미지 생성 횟수 제한 ============

const AI_DAILY_LIMIT = 5;

/**
 * 오늘 AI 이미지 생성 남은 횟수 조회
 * @returns {Promise<{remaining: number, limit: number, used: number}>}
 */
export async function getAiGenerationRemaining() {
  try {
    const response = await get('/ai-generations/remaining');
    return (
      response.data ?? {
        remaining: AI_DAILY_LIMIT,
        limit: AI_DAILY_LIMIT,
        used: 0,
      }
    );
  } catch (error) {
    // API 미구현 시 fallback (개발용)
    logger.warn('[AI 횟수] API 미구현, fallback 사용:', error.message);
    return { remaining: AI_DAILY_LIMIT, limit: AI_DAILY_LIMIT, used: 0 };
  }
}

/**
 * AI 이미지 생성 횟수 사용 가능 여부 체크
 * @returns {Promise<{canGenerate: boolean, remaining: number, message?: string}>}
 */
export async function checkAiGenerationLimit() {
  const { remaining, limit } = await getAiGenerationRemaining();

  if (remaining <= 0) {
    return {
      canGenerate: false,
      remaining: 0,
      message:
        '오늘 AI 이미지 생성 횟수를 모두 사용했어요. 내일 다시 시도해주세요.',
    };
  }

  return {
    canGenerate: true,
    remaining,
    limit,
  };
}

// Lambda 이미지 업로드 API URL은 환경변수에서 로드 (getImageUploadApi() 사용)

// ============ AI 이미지 생성 관련 함수 ============

/**
 * HTTP URL에서 이미지를 가져와 Base64로 변환
 * S3 URL은 CORS 문제로 서버 프록시를 경유
 * @param {string} imageUrl - 이미지 URL
 * @returns {Promise<{data: string, mimeType: string}>}
 */
export async function fetchImageAsBase64(imageUrl) {
  // S3 URL인 경우 프록시 경유 (CORS 우회)
  let fetchUrl = imageUrl;
  if (imageUrl.includes('s3.ap-northeast-2.amazonaws.com')) {
    fetchUrl = `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
  }

  const response = await fetch(fetchUrl);
  if (!response.ok) {
    throw new Error('이미지를 가져오는데 실패했습니다.');
  }

  const blob = await response.blob();
  const mimeType = blob.type || 'image/jpeg';

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1];
      resolve({ data: base64, mimeType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * File 객체를 Base64로 변환
 * @param {File} file - 파일 객체
 * @returns {Promise<{data: string, mimeType: string}>}
 */
export async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1];
      resolve({ data: base64, mimeType: file.type || 'image/jpeg' });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Base64 이미지를 S3에 업로드
 * @param {{data: string, mimeType: string}} imageData - Base64 이미지 데이터
 * @param {string} imageType - 이미지 타입 (PROFILE, POST)
 * @returns {Promise<Object>} Lambda 응답
 */
export async function uploadBase64ToS3(imageData, imageType = 'POST') {
  const mimeToExt = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };

  const extension = mimeToExt[imageData.mimeType] || 'png';
  const imageUploadApi = await getImageUploadApi();

  const response = await fetch(imageUploadApi, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file: imageData.data,
      extension,
      imageType,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'AI 이미지 업로드에 실패했습니다.');
  }

  return response.json();
}

/**
 * AI 이미지 생성 전체 플로우 (Express 프록시 경유)
 * @param {Object} params
 * @param {string} params.content - 일기 본문
 * @param {{data: string, mimeType: string}} params.avatarImage - 프로필 이미지
 * @param {{data: string, mimeType: string}|null} params.referenceImage - 참조 이미지
 * @param {Function} params.onProgress - 진행 상태 콜백 (선택)
 * @returns {Promise<{imageId: number, imageUrl: string, prompt: string}>}
 */
export async function generateAndUploadAiImage({
  content,
  avatarImage,
  referenceImage = null,
  onProgress = null,
}) {
  // 1. AI 프록시를 통해 프롬프트 생성 + 이미지 생성
  if (onProgress) {
    onProgress({ step: 'ai', message: 'AI가 이미지를 생성 중입니다...' });
  }

  const { prompt, image: generatedImage } = await generateAiImageComplete({
    profileImageBase64: avatarImage.data,
    profileImageMimeType: avatarImage.mimeType,
    postContent: content,
    referenceImageBase64: referenceImage?.data || null,
    referenceImageMimeType: referenceImage?.mimeType || null,
    options: null, // 옵션 없이 기본 프롬프트 사용
    onProgress,
  });

  logger.debug('[AI 이미지] 생성된 프롬프트:', prompt);
  logger.debug('[AI 이미지] 이미지 생성 완료');

  // 2. S3 업로드
  if (onProgress) {
    onProgress({ step: 'upload', message: '이미지 업로드 중...' });
  }

  const s3Result = await uploadBase64ToS3(generatedImage, 'POST');
  logger.debug('[AI 이미지] S3 업로드 완료:', s3Result);

  // 3. 메타데이터 저장 (AI 생성 이미지로 표시)
  const metadata = await saveImageMetadata(s3Result, { aiGenerated: true });
  logger.debug('[AI 이미지] 메타데이터 저장 완료:', metadata);

  return {
    ...metadata,
    prompt,
    // 미리보기용 base64 데이터 (imageUrl이 없을 경우 사용)
    imageData: generatedImage.data,
    imageMimeType: generatedImage.mimeType,
  };
}

const VALID_TYPES = new Set(['PROFILE', 'POST']);

/**
 * Lambda를 통해 S3에 이미지 업로드
 * @param {Object} params
 * @param {File} params.file - 업로드할 파일
 * @param {string} params.imageType - 이미지 타입 (PROFILE, POST_ORIGINAL, POST_THUMBNAIL)
 * @returns {Promise<{storedFilename: string, s3Path: string, originalExtension: string, imageType: string}>}
 */
export async function uploadImageToS3({ file, imageType }) {
  if (!file) {
    throw new Error('업로드할 파일을 선택해주세요.');
  }

  if (!imageType || !VALID_TYPES.has(imageType)) {
    throw new Error('유효한 이미지 타입을 선택해주세요.');
  }

  // 파일을 base64로 변환
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result.split(',')[1]; // data:image/...;base64, 제거
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const extension = file.name.split('.').pop().toLowerCase();
  const imageUploadApi = await getImageUploadApi();

  const response = await fetch(imageUploadApi, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      file: base64,
      extension,
      imageType,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || '이미지 업로드에 실패했습니다.');
  }

  return response.json();
}

/**
 * WAS에 이미지 메타데이터 저장 (세션 인증 필요)
 * @param {Object} metadata - Lambda에서 받은 메타데이터
 * @param {string} metadata.storedFilename
 * @param {string} metadata.s3Path
 * @param {string} metadata.originalExtension
 * @param {string} metadata.imageType
 * @param {Object} options - 추가 옵션
 * @param {boolean} options.aiGenerated - AI 생성 이미지 여부
 * @returns {Promise<{imageId: number, imageUrl: string}>}
 */
export async function saveImageMetadata(metadata, options = {}) {
  if (!metadata || !metadata.storedFilename) {
    throw new Error('이미지 메타데이터가 필요합니다.');
  }

  const body = { ...metadata };
  if (options.aiGenerated) {
    body.aiGenerated = true;
  }

  const response = await post('/images/metadata', { body });

  return response.data ?? null;
}

/**
 * 이미지 업로드 전체 플로우 (Lambda + WAS 메타데이터 저장)
 * @param {Object} params
 * @param {File} params.file - 업로드할 파일
 * @param {string} params.imageType - 이미지 타입
 * @returns {Promise<{imageId: number, imageUrl: string}>}
 */
export async function uploadImageComplete({ file, imageType }) {
  // 1. Lambda를 통해 S3에 업로드
  const s3Result = await uploadImageToS3({ file, imageType });

  // 2. WAS에 메타데이터 저장
  const metadata = await saveImageMetadata(s3Result);

  return metadata;
}

export async function getImage(imageId) {
  if (imageId === undefined || imageId === null || imageId === '') {
    throw new Error('이미지 ID가 필요합니다.');
  }

  const response = await get(`/images/${imageId}`);
  return response.data ?? null;
}

export async function deleteImage(imageId) {
  if (imageId === undefined || imageId === null || imageId === '') {
    throw new Error('이미지 ID가 필요합니다.');
  }

  const response = await del(`/images/${imageId}`, { parseJson: true });
  return response.data ?? null;
}
