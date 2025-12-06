/**
 * 조회수, 좋아요수, 댓글수를 포맷팅하는 유틸리티 함수
 * @param {number} count - 포맷팅할 숫자
 * @returns {string} 포맷팅된 문자열
 * @example
 * formatCount(999) => '999'
 * formatCount(1000) => '1k'
 * formatCount(10000) => '10k'
 * formatCount(100000) => '100k'
 */
export function formatCount(count) {
  if (count === null || count === undefined) {
    return '0';
  }

  const num = Number(count);

  if (isNaN(num)) {
    return '0';
  }

  if (num >= 100000) {
    return Math.floor(num / 1000) + 'k';
  } else if (num >= 10000) {
    return Math.floor(num / 1000) + 'k';
  } else if (num >= 1000) {
    return Math.floor(num / 1000) + 'k';
  }

  return num.toString();
}

/**
 * 날짜를 포맷팅하는 유틸리티 함수
 * @param {string|Date} date - 포맷팅할 날짜
 * @param {boolean} includeTime - 시간 포함 여부 (기본값: false)
 * @returns {string} 포맷팅된 날짜 문자열
 * @example
 * formatDate('2024-01-15T10:30:00') => '2024-01-15'
 * formatDate('2024-01-15T10:30:00', true) => '2024-01-15 10:30:00'
 */
export function formatDate(date, includeTime = false) {
  if (!date) {
    return '';
  }

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return '';
  }

  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');

  if (!includeTime) {
    return `${year}-${month}-${day}`;
  }

  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const seconds = String(dateObj.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 상대 시간을 포맷팅하는 유틸리티 함수 (방금 전, 1분 전, 1시간 전 등)
 * @param {string|Date} date - 포맷팅할 날짜
 * @returns {string} 상대 시간 문자열
 * @example
 * formatRelativeTime(new Date()) => '방금 전'
 * formatRelativeTime(Date.now() - 60000) => '1분 전'
 */
export function formatRelativeTime(date) {
  if (!date) {
    return '';
  }

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return '';
  }

  const now = new Date();
  const diff = Math.floor((now - dateObj) / 1000); // 초 단위 차이

  if (diff < 60) {
    return '방금 전';
  } else if (diff < 3600) {
    const minutes = Math.floor(diff / 60);
    return `${minutes}분 전`;
  } else if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    return `${hours}시간 전`;
  } else if (diff < 604800) {
    const days = Math.floor(diff / 86400);
    return `${days}일 전`;
  } else {
    return formatDate(dateObj);
  }
}

/**
 * HTML 특수 문자를 이스케이프하는 함수 (XSS 방지)
 * @param {string} text - 이스케이프할 텍스트
 * @returns {string} 이스케이프된 텍스트
 */
export function escapeHtml(text) {
  if (!text) {
    return '';
  }

  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };

  return String(text).replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * 텍스트를 지정된 길이로 자르고 말줄임표를 추가하는 함수
 * @param {string} text - 자를 텍스트
 * @param {number} maxLength - 최대 길이
 * @returns {string} 잘린 텍스트
 */
export function truncateText(text, maxLength) {
  if (!text) {
    return '';
  }

  if (text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength) + '...';
}
