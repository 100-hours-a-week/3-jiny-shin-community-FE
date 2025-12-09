import {
  validateEmail,
  validatePassword,
  validatePasswordConfirm,
  validateNickname,
} from '../../../utils/validation.js';
import { showError, hideError } from '../../../utils/dom.js';
import {
  checkEmailAvailability,
  checkNicknameAvailability,
  signUp,
  updateProfile,
} from '../../../services/user/userApi.js';
import { login } from '../../../services/auth/authApi.js';
import {
  saveImageMetadata,
  uploadImageToS3,
} from '../../../services/image/imageApi.js';
import { logger } from '../../../utils/logger.js';

// DOM 요소
const signupForm = document.getElementById('signupForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const passwordConfirmInput = document.getElementById('passwordConfirm');
const nicknameInput = document.getElementById('nickname');
const submitButton = signupForm.querySelector('button[type="submit"]');

const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const passwordConfirmError = document.getElementById('passwordConfirmError');
const nicknameError = document.getElementById('nicknameError');
const profileError = document.getElementById('profileError');

// 프로필 이미지 관련
const profileInput = document.getElementById('profileInput');
const profileBtn = document.getElementById('profileBtn');
const profileRemoveBtn = document.getElementById('profileRemoveBtn');
const profileImage = document.getElementById('profileImage');
const profilePreview = document.getElementById('profilePreview');

let profileImageMetadata = null; // Lambda에서 받은 이미지 메타데이터 저장

// 프로필 이미지 버튼 클릭
profileBtn.addEventListener('click', () => {
  profileInput.click();
});

// 프로필 이미지 제거 버튼 클릭
profileRemoveBtn.addEventListener('click', () => {
  profileImageMetadata = null;
  profileInput.value = '';
  profileImage.src = '';
  profileImage.classList.remove('show');
  profileBtn.querySelector('span').textContent = '사진 추가';
  profileRemoveBtn.hidden = true;
  hideError(profileError);
});

// 프로필 이미지 선택
profileInput.addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;

  // 파일 크기 체크 (5MB)
  if (file.size > 5 * 1024 * 1024) {
    showError(profileError, '이미지 크기는 5MB 이하여야 합니다.');
    return;
  }

  // 이미지 타입 체크
  if (!file.type.startsWith('image/')) {
    showError(profileError, '이미지 파일만 업로드 가능합니다.');
    return;
  }

  hideError(profileError);

  // 미리보기 표시
  const reader = new FileReader();
  reader.onload = async event => {
    profileImage.src = event.target.result;
    profileImage.classList.add('show');
    profileBtn.querySelector('span').textContent = '사진 변경';
    profileRemoveBtn.hidden = false;

    // 이미지 업로드 (imageApi.js의 uploadImageToS3 사용)
    try {
      const result = await uploadImageToS3({ file, imageType: 'PROFILE' });

      // Lambda 응답 메타데이터 저장
      profileImageMetadata = result;
      logger.debug('[회원가입] ① Lambda 업로드 완료:', profileImageMetadata);
    } catch (error) {
      logger.error('[회원가입] ① Lambda 업로드 실패:', error);
      showError(profileError, '이미지 업로드에 실패했습니다.');
      // 미리보기는 유지하되 메타데이터는 null
      profileImageMetadata = null;
    }
  };
  reader.readAsDataURL(file);
});

// 이메일 입력 필드 - blur 또는 Enter 키 입력 시 유효성 검사
emailInput.addEventListener('blur', async () => {
  const email = emailInput.value.trim();
  const validation = validateEmail(email);

  if (!validation.valid) {
    showError(emailError, validation.message);
  } else {
    hideError(emailError);

    if (email) {
      try {
        const availability = await checkEmailAvailability(email);
        if (!availability?.available) {
          showError(emailError, '이미 사용 중인 이메일입니다.');
        }
      } catch (error) {
        logger.error('이메일 중복 확인 실패:', error);
      }
    }
  }
});

emailInput.addEventListener('keypress', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    emailInput.blur();
  }
});

// 닉네임 입력 필드
nicknameInput.addEventListener('blur', async () => {
  const nickname = nicknameInput.value.trim();
  const validation = validateNickname(nickname);

  if (!validation.valid) {
    showError(nicknameError, validation.message);
  } else {
    hideError(nicknameError);

    if (nickname) {
      try {
        const availability = await checkNicknameAvailability(nickname);
        if (!availability?.available) {
          showError(nicknameError, '이미 사용 중인 닉네임입니다.');
        }
      } catch (error) {
        logger.error('닉네임 중복 확인 실패:', error);
      }
    }
  }
});

nicknameInput.addEventListener('keypress', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    nicknameInput.blur();
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

passwordInput.addEventListener('keypress', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    passwordInput.blur();
  }
});

// 비밀번호 확인 입력 필드
passwordConfirmInput.addEventListener('blur', () => {
  const password = passwordInput.value;
  const passwordConfirm = passwordConfirmInput.value;
  const validation = validatePasswordConfirm(password, passwordConfirm);

  if (!validation.valid) {
    showError(passwordConfirmError, validation.message);
  } else {
    hideError(passwordConfirmError);
  }
});

passwordConfirmInput.addEventListener('keypress', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    passwordConfirmInput.blur();
  }
});

// 폼 제출 처리
signupForm.addEventListener('submit', async e => {
  e.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const passwordConfirm = passwordConfirmInput.value;
  const nickname = nicknameInput.value.trim();

  // 유효성 검사
  const emailValidation = validateEmail(email);
  const passwordValidation = validatePassword(password);
  const passwordConfirmValidation = validatePasswordConfirm(
    password,
    passwordConfirm
  );
  const nicknameValidation = validateNickname(nickname);

  // 에러 표시
  if (!emailValidation.valid) {
    showError(emailError, emailValidation.message);
  } else {
    hideError(emailError);
  }

  if (!nicknameValidation.valid) {
    showError(nicknameError, nicknameValidation.message);
  } else {
    hideError(nicknameError);
  }

  if (!passwordValidation.valid) {
    showError(passwordError, passwordValidation.message);
  } else {
    hideError(passwordError);
  }

  if (!passwordConfirmValidation.valid) {
    showError(passwordConfirmError, passwordConfirmValidation.message);
  } else {
    hideError(passwordConfirmError);
  }

  // 유효성 검사 실패 시 중단
  if (
    !emailValidation.valid ||
    !passwordValidation.valid ||
    !passwordConfirmValidation.valid ||
    !nicknameValidation.valid
  ) {
    return;
  }

  // 버튼 비활성화 (중복 클릭 방지)
  submitButton.disabled = true;
  submitButton.textContent = '가입 중...';

  try {
    // 이전 사용자의 임시저장 데이터 정리
    localStorage.removeItem('anoo_post_draft');

    logger.debug('[회원가입] 폼 제출 시작');
    logger.debug('[회원가입] profileImageMetadata:', profileImageMetadata);

    // 1. 회원가입
    logger.debug('[회원가입] ① 회원가입 요청:', { email, nickname });
    await signUp({ email, password, nickname });
    logger.debug('[회원가입] ① 회원가입 완료');

    // 2. 로그인하여 세션 생성
    logger.debug('[회원가입] ② 로그인 요청');
    await login({ email, password });
    logger.debug('[회원가입] ② 로그인 완료');

    // 3. 프로필 이미지가 있으면 메타데이터 저장 후 프로필 업데이트
    if (profileImageMetadata) {
      try {
        logger.debug(
          '[회원가입] ③ 메타데이터 저장 요청:',
          profileImageMetadata
        );
        const imageResult = await saveImageMetadata(profileImageMetadata);
        logger.debug('[회원가입] ③ 메타데이터 저장 응답:', imageResult);

        if (imageResult?.imageId) {
          logger.debug('[회원가입] ④ 프로필 업데이트 요청:', {
            profileImageId: imageResult.imageId,
          });
          await updateProfile({ profileImageId: imageResult.imageId });
          logger.debug('[회원가입] ④ 프로필 업데이트 완료');
        }
      } catch (imageError) {
        logger.error('[회원가입] 프로필 이미지 저장 실패:', imageError);
        // 이미지 저장 실패해도 회원가입은 완료된 상태
      }
    }

    // 피드로 이동
    window.location.href = '/feed';
  } catch (error) {
    // 백엔드 에러 코드에 따라 적절한 필드에 메시지 표시
    const errorCode = error.code || error.message || '';

    switch (errorCode) {
      case 'email_already_exists':
        showError(emailError, '이미 존재하는 이메일입니다.');
        break;
      case 'nickname_already_exists':
        showError(nicknameError, '이미 사용 중인 닉네임입니다.');
        break;
      case 'invalid_request':
        showError(emailError, '입력 정보를 확인해주세요.');
        break;
      default:
        showError(
          emailError,
          error.message || '회원가입에 실패했습니다. 다시 시도해주세요.'
        );
    }

    // 버튼 다시 활성화
    submitButton.disabled = false;
    submitButton.textContent = '회원가입';
  }
});
