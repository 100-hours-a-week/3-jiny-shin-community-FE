import { validateEmail, validatePassword } from '../../../utils/validation.js';
import { showError, hideError } from '../../../utils/dom.js';
import { login } from '../../../api/auth/authApi.js';

/**
 * 로그인 에러 코드를 사용자 친화적 메시지로 변환
 * @param {string} errorCode - API에서 반환된 에러 메시지/코드
 * @returns {string} 사용자에게 표시할 메시지
 */
function getLoginErrorMessage(errorCode) {
  const errorMessages = {
    user_not_found: '이메일 또는 비밀번호가 올바르지 않습니다.',
    invalid_credentials: '이메일 또는 비밀번호가 올바르지 않습니다.',
    invalid_password: '이메일 또는 비밀번호가 올바르지 않습니다.',
    account_locked: '계정이 잠겼습니다. 잠시 후 다시 시도해주세요.',
    account_disabled: '비활성화된 계정입니다. 관리자에게 문의해주세요.',
    too_many_attempts: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.',
  };

  // 에러 코드가 정의된 메시지에 있으면 해당 메시지 반환
  if (errorCode && errorMessages[errorCode]) {
    return errorMessages[errorCode];
  }

  // 에러 코드가 영문 스네이크케이스 형태면 기본 메시지 반환
  if (errorCode && /^[a-z_]+$/.test(errorCode)) {
    return '이메일 또는 비밀번호가 올바르지 않습니다.';
  }

  // 그 외의 경우 에러 메시지 그대로 또는 기본 메시지
  return errorCode || '로그인에 실패했습니다. 다시 시도해주세요.';
}

// 로그인 폼 처리
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const submitButton = loginForm.querySelector('button[type="submit"]');

// 버튼 색상 변경
function changeButtonColor() {
  submitButton.style.backgroundColor = '#7F6AEE';
}

// 이메일 입력 필드 - blur 또는 Enter 키 입력 시 유효성 검사
emailInput.addEventListener('blur', () => {
  const email = emailInput.value.trim();
  const validation = validateEmail(email);

  if (!validation.valid) {
    showError(emailError, validation.message);
  } else {
    hideError(emailError);
  }
});

emailInput.addEventListener('keypress', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    passwordInput.focus(); // 다음 필드로 이동
  }
});

// 비밀번호 입력 필드
passwordInput.addEventListener('blur', () => {
  const password = passwordInput.value;
  const validation = validatePassword(password);

  if (!validation.valid) {
    showError(passwordError, validation.message);
  } else {
    hideError(passwordError);
  }
});

// 폼 제출 처리
loginForm.addEventListener('submit', async e => {
  e.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  // 유효성 검사
  const emailValidation = validateEmail(email);
  const passwordValidation = validatePassword(password);

  // 에러 표시
  if (!emailValidation.valid) {
    showError(emailError, emailValidation.message);
  } else {
    hideError(emailError);
  }

  if (!passwordValidation.valid) {
    showError(passwordError, passwordValidation.message);
  } else {
    hideError(passwordError);
  }

  // 유효성 검사 실패 시 중단
  if (!emailValidation.valid || !passwordValidation.valid) {
    return;
  }

  // 버튼 비활성화 (중복 클릭 방지)
  submitButton.disabled = true;

  try {
    await login({ email, password });
    changeButtonColor();
    window.location.href = '/feed';
  } catch (error) {
    // 인증 관련 에러 코드를 사용자 친화적 메시지로 변환
    const errorMessage = getLoginErrorMessage(error.message);
    showError(passwordError, errorMessage);
    submitButton.disabled = false;
  }
});
