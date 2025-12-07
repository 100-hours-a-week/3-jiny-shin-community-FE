/**
 * 환경별 로그 레벨 조절이 가능한 로거 유틸리티
 *
 * 사용법:
 *   import { logger } from '/utils/logger.js';
 *   logger.debug('[모듈명] 디버그 메시지', data);
 *   logger.info('[모듈명] 정보 메시지');
 *   logger.warn('[모듈명] 경고 메시지');
 *   logger.error('[모듈명] 에러 메시지', error);
 *
 * 로그 레벨:
 *   - 개발 환경 (localhost): DEBUG 이상 모두 표시
 *   - 프로덕션: WARN, ERROR만 표시
 */

const LOG_LEVEL = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4,
};

/**
 * 프로덕션 환경 여부 판단
 * localhost, 127.0.0.1이 아니면 프로덕션으로 간주
 */
function isProduction() {
  if (typeof window === 'undefined') return true;
  const hostname = window.location?.hostname || '';
  return !['localhost', '127.0.0.1', ''].includes(hostname);
}

const currentLevel = isProduction() ? LOG_LEVEL.WARN : LOG_LEVEL.DEBUG;

export const logger = {
  /**
   * 디버그 로그 - 개발 중 상세 플로우 추적용
   * 프로덕션에서는 표시되지 않음
   */
  debug: (...args) => {
    if (currentLevel <= LOG_LEVEL.DEBUG) {
      console.log(...args);
    }
  },

  /**
   * 정보 로그 - 주요 이벤트 기록용
   * 프로덕션에서는 표시되지 않음
   */
  info: (...args) => {
    if (currentLevel <= LOG_LEVEL.INFO) {
      console.log(...args);
    }
  },

  /**
   * 경고 로그 - 잠재적 문제 알림용
   * 프로덕션에서도 표시됨
   */
  warn: (...args) => {
    if (currentLevel <= LOG_LEVEL.WARN) {
      console.warn(...args);
    }
  },

  /**
   * 에러 로그 - 오류 발생 시
   * 프로덕션에서도 표시됨
   */
  error: (...args) => {
    if (currentLevel <= LOG_LEVEL.ERROR) {
      console.error(...args);
    }
  },
};
