/**
 * 폼 입력 값 검증 유틸리티
 */

// 이메일 최대 길이 (RFC 5321 표준)
export const EMAIL_MAX_LENGTH = 254;

/**
 * 이메일 유효성 검사
 * @param {string} email - 검증할 이메일
 * @returns {{valid: boolean, message?: string}} 검증 결과
 */
export function validateEmail(email) {
  // 빈 값 체크
  if (!email) {
    return {
      valid: false,
      message: '이메일을 입력해주세요.',
    };
  }

  // 길이 체크
  if (email.length > EMAIL_MAX_LENGTH) {
    return {
      valid: false,
      message: `이메일은 ${EMAIL_MAX_LENGTH}자 이하여야 합니다.`,
    };
  }

  // 이메일 형식 체크 (정규식)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      valid: false,
      message: '올바른 이메일 형식이 아닙니다.',
    };
  }

  return { valid: true };
}

/**
 * 비밀번호 유효성 검사
 * 조건: 8-20자, 대문자/소문자/숫자/특수문자 각 1개 이상
 * @param {string} password - 검증할 비밀번호
 * @returns {{valid: boolean, message?: string}} 검증 결과
 */
export function validatePassword(password) {
  // 빈 값 체크
  if (!password) {
    return {
      valid: false,
      message: '비밀번호를 입력해주세요.',
    };
  }

  // 길이 체크
  if (password.length < 8 || password.length > 20) {
    return {
      valid: false,
      message:
        '비밀번호는 8자 이상, 20자 이하이며, 대문자, 소문자, 숫자, 특수문자를 각각 최소 1개 포함해야 합니다.',
    };
  }

  // 문자 종류 체크
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
    return {
      valid: false,
      message:
        '비밀번호는 8자 이상, 20자 이하이며, 대문자, 소문자, 숫자, 특수문자를 각각 최소 1개 포함해야 합니다.',
    };
  }

  return { valid: true };
}

/**
 * 비밀번호 확인 검증
 * @param {string} password - 원본 비밀번호
 * @param {string} passwordConfirm - 확인용 비밀번호
 * @returns {{valid: boolean, message?: string}} 검증 결과
 */
export function validatePasswordConfirm(password, passwordConfirm) {
  if (!passwordConfirm) {
    return {
      valid: false,
      message: '비밀번호 확인을 입력해주세요.',
    };
  }

  if (password !== passwordConfirm) {
    return {
      valid: false,
      message: '비밀번호가 일치하지 않습니다.',
    };
  }

  return { valid: true };
}

/**
 * 닉네임 유효성 검사
 * 조건: 2-20자
 * @param {string} nickname - 검증할 닉네임
 * @returns {{valid: boolean, message?: string}} 검증 결과
 */
export function validateNickname(nickname) {
  if (!nickname) {
    return {
      valid: false,
      message: '닉네임을 입력해주세요.',
    };
  }

  if (nickname.length < 2 || nickname.length > 20) {
    return {
      valid: false,
      message: '닉네임은 2자 이상 20자 이하여야 합니다.',
    };
  }

  return { valid: true };
}
