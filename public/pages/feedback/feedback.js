import { renderPageLayout } from '../../../utils/layoutPage.js';
import { showToast } from '../../../utils/layout.js';
import { submitFeedback } from '../../../services/feedback/feedbackApi.js';
import { getAppVersion } from '../../../services/api-config.js';
import { logger } from '../../../utils/logger.js';

// 상수
const MAX_LENGTH = 2000;

// DOM 요소
let feedbackForm;
let feedbackContent;
let submitBtn;
let charCounter;
let currentLengthSpan;

/* global navigator */

/**
 * 플랫폼 감지
 */
function detectPlatform() {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;

  if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
    return 'iOS';
  }

  if (/android/i.test(userAgent)) {
    return 'Android';
  }

  if (/Macintosh|MacIntel|MacPPC|Mac68K/.test(userAgent)) {
    return 'macOS';
  }

  if (/Win32|Win64|Windows|WinCE/.test(userAgent)) {
    return 'Windows';
  }

  if (/Linux/.test(userAgent)) {
    return 'Linux';
  }

  return 'Unknown';
}

/**
 * 입력값 유효성 검사
 */
function validateContent(content) {
  const trimmed = content.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_LENGTH;
}

/**
 * 버튼 상태 업데이트
 */
function updateSubmitButton() {
  const content = feedbackContent.value;
  const isValid = validateContent(content);
  submitBtn.disabled = !isValid;
}

/**
 * 글자 수 카운터 업데이트
 */
function updateCharCounter() {
  const length = feedbackContent.value.length;
  currentLengthSpan.textContent = length;

  // 제한에 가까워지면 경고 색상 표시
  if (length >= MAX_LENGTH * 0.9) {
    charCounter.classList.add('limit-warning');
  } else {
    charCounter.classList.remove('limit-warning');
  }
}

/**
 * 로딩 상태 설정
 */
function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  feedbackContent.disabled = isLoading;

  const submitText = submitBtn.querySelector('.submit-text');
  const submitLoading = submitBtn.querySelector('.submit-loading');

  if (isLoading) {
    submitText.hidden = true;
    submitLoading.hidden = false;
  } else {
    submitText.hidden = false;
    submitLoading.hidden = true;
  }
}

/**
 * 폼 초기화
 */
function resetForm() {
  feedbackContent.value = '';
  updateCharCounter();
  updateSubmitButton();
}

/**
 * 피드백 제출 처리
 */
async function handleSubmit(e) {
  e.preventDefault();

  const content = feedbackContent.value.trim();

  if (!validateContent(content)) {
    showToast('내용을 입력해주세요.', 'error');
    return;
  }

  setLoading(true);

  try {
    const feedbackData = {
      content,
      appVersion: await getAppVersion(),
      platform: detectPlatform(),
      createdAt: new Date().toISOString(),
    };

    await submitFeedback(feedbackData);

    showToast('의견이 전송되었습니다. 감사합니다!', 'success');
    resetForm();
  } catch (error) {
    logger.error('피드백 전송 실패:', error);
    showToast(
      error.message || '전송에 실패했습니다. 잠시 후 다시 시도해주세요.',
      'error'
    );
    // 에러 시 버튼 상태 복원
    updateSubmitButton();
  } finally {
    setLoading(false);
  }
}

/**
 * 이벤트 리스너 초기화
 */
function initEventListeners() {
  // 텍스트 입력 이벤트
  feedbackContent.addEventListener('input', () => {
    updateCharCounter();
    updateSubmitButton();
  });

  // 폼 제출
  feedbackForm.addEventListener('submit', handleSubmit);
}

/**
 * DOM 요소 초기화
 */
function initElements() {
  feedbackForm = document.getElementById('feedbackForm');
  feedbackContent = document.getElementById('feedbackContent');
  submitBtn = document.getElementById('submitBtn');
  charCounter = document.querySelector('.feedback-form__counter');
  currentLengthSpan = document.getElementById('currentLength');
}

/**
 * 페이지 초기화
 */
document.addEventListener('DOMContentLoaded', async () => {
  await renderPageLayout('layout-template');

  initElements();
  initEventListeners();

  // 초기 상태 설정
  updateCharCounter();
  updateSubmitButton();

  // Lucide 아이콘 렌더링
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // 텍스트 영역에 포커스
  feedbackContent.focus();
});
