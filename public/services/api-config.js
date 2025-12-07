// API 기본 설정 (서버 환경변수에서 로드)

import { logger } from '../utils/logger.js';

// 설정 캐시
let configCache = null;
let configPromise = null;

/**
 * 서버에서 설정을 가져옵니다 (캐싱 적용)
 * @returns {Promise<{API_BASE_URL: string, IMAGE_UPLOAD_API: string}>}
 */
async function fetchConfig() {
  if (configCache) {
    return configCache;
  }

  if (configPromise) {
    return configPromise;
  }

  configPromise = fetch('/config')
    .then(res => res.json())
    .then(config => {
      configCache = config;
      return config;
    })
    .catch(err => {
      logger.warn('[API Config] 서버 설정 로드 실패, 기본값 사용:', err.message);
      // live-server 개발 환경 등에서 /config가 없을 때 fallback
      configCache = {
        API_BASE_URL: '/api/',
        IMAGE_UPLOAD_API: '',
      };
      return configCache;
    });

  return configPromise;
}

/**
 * 설정 초기화 (앱 시작 시 호출 권장)
 * @returns {Promise<void>}
 */
export async function initConfig() {
  await fetchConfig();
}

/**
 * API Base URL 반환
 * @returns {Promise<string>}
 */
export async function getApiBaseUrl() {
  const config = await fetchConfig();
  return config.API_BASE_URL;
}

/**
 * 이미지 업로드 API URL 반환
 * @returns {Promise<string>}
 */
export async function getImageUploadApi() {
  const config = await fetchConfig();
  return config.IMAGE_UPLOAD_API;
}

// 동기적 접근을 위한 기본 설정 (초기화 전 사용 시)
const API_CONFIG = {
  get BASE_URL() {
    // 캐시된 값이 있으면 반환, 없으면 기본값 (상대 경로)
    return configCache?.API_BASE_URL || '/api/';
  },
  TIMEOUT: 10000,
  DEFAULT_HEADERS: {
    Accept: 'application/json',
  },
};

// Gemini AI API 설정 (더 이상 클라이언트에서 직접 사용하지 않음)
// AI API 호출은 Express 프록시(/api/ai/*)를 통해 진행됩니다.
// API 키는 서버의 환경변수(GEMINI_API_KEY)에서 관리됩니다.

export default API_CONFIG;
