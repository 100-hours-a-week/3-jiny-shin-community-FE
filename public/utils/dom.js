/**
 * DOM 조작 유틸리티
 */

/**
 * 에러 메시지 표시
 * @param {HTMLElement} element - 에러 메시지를 표시할 요소
 * @param {string} message - 표시할 에러 메시지
 */
export function showError(element, message) {
  element.textContent = message;
  element.classList.add('show');
}

/**
 * 에러 메시지 숨기기
 * @param {HTMLElement} element - 에러 메시지를 숨길 요소
 */
export function hideError(element) {
  element.textContent = '';
  element.classList.remove('show');
}
