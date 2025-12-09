import {
  saveImageMetadata,
  uploadImageToS3,
} from '../../../services/image/imageApi.js';
import {
  changePassword,
  checkNicknameAvailability,
  deleteProfileImage,
  getCurrentUser,
  updateProfile,
  verifyPassword,
} from '../../../services/user/userApi.js';
import { openModal, showToast } from '../../../utils/layout.js';
import { renderPageLayout } from '../../../utils/layoutPage.js';
import { getImageUrl } from '../../../utils/format.js';
import { logger } from '../../../utils/logger.js';

const state = {
  currentUser: null,
  profileImageMetadata: null, // Lambda에서 받은 메타데이터
  removeImage: false,
  isSubmitting: false,
  nicknameChecked: false, // 닉네임 중복 체크 완료 여부
  nicknameAvailable: false, // 닉네임 사용 가능 여부
  currentPasswordVerified: false, // 현재 비밀번호 검증 완료 여부
};

function validateNickname(nickname) {
  return (
    typeof nickname === 'string' &&
    nickname.length >= 2 &&
    nickname.length <= 10
  );
}

/**
 * 비밀번호 유효성 검사 (회원가입과 동일)
 * - 8자 이상, 20자 이하
 * - 대문자, 소문자, 숫자, 특수문자 각각 최소 1개 포함
 */
function validatePassword(password) {
  if (typeof password !== 'string') return false;
  if (password.length < 8 || password.length > 20) return false;

  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[~!@#$%^&*()_+\-={}[\]|\\:;"'<>,.?/]/.test(password);

  return hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;
}

function showError(element, message) {
  element.textContent = message;
  element.classList.add('show');
}

function hideError(element) {
  element.textContent = '';
  element.classList.remove('show');
}

function setProfilePreview(url) {
  const profileImage = document.getElementById('profileImage');
  const profileBtn = document.getElementById('profileBtn');
  const profileRemoveBtn = document.getElementById('profileRemoveBtn');

  if (!profileImage) return;

  if (url) {
    profileImage.src = url;
    profileImage.classList.add('show');
    profileBtn.querySelector('span').textContent = '사진 변경';
    profileRemoveBtn.hidden = false;
  } else {
    profileImage.src = '';
    profileImage.classList.remove('show');
    profileBtn.querySelector('span').textContent = '사진 추가';
    profileRemoveBtn.hidden = true;
  }
}

function bindImageInput() {
  const profileInput = document.getElementById('profileInput');
  const profileBtn = document.getElementById('profileBtn');
  const profileRemoveBtn = document.getElementById('profileRemoveBtn');
  const profileError = document.getElementById('profileError');

  profileBtn.addEventListener('click', () => profileInput.click());

  profileInput.addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    // 파일 크기 체크 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      showError(profileError, '이미지 크기는 5MB 이하여야 합니다.');
      event.target.value = '';
      return;
    }

    // 이미지 타입 체크
    if (!file.type.startsWith('image/')) {
      showError(profileError, '이미지 파일만 업로드 가능합니다.');
      event.target.value = '';
      return;
    }

    hideError(profileError);
    state.removeImage = false;

    // 미리보기 표시 및 Lambda 업로드
    const reader = new FileReader();
    reader.onload = async e => {
      setProfilePreview(e.target.result);

      // Lambda로 이미지 업로드 (imageApi.js의 uploadImageToS3 사용)
      try {
        const result = await uploadImageToS3({ file, imageType: 'PROFILE' });
        state.profileImageMetadata = result;
        logger.debug(
          '[프로필 수정] Lambda 업로드 완료:',
          state.profileImageMetadata
        );
      } catch (error) {
        logger.error('[프로필 수정] Lambda 업로드 실패:', error);
        showError(profileError, '이미지 업로드에 실패했습니다.');
        state.profileImageMetadata = null;
      }
    };
    reader.readAsDataURL(file);
  });

  profileRemoveBtn.addEventListener('click', () => {
    state.profileImageMetadata = null;
    state.removeImage = true;
    profileInput.value = '';
    setProfilePreview(null);
    hideError(profileError);
  });
}

async function loadInitialData() {
  try {
    state.currentUser = await getCurrentUser();
    if (!state.currentUser) {
      throw new Error('사용자 정보를 불러오지 못했습니다.');
    }

    document.getElementById('nickname').value =
      state.currentUser.nickname ?? '';
    const profileUrl =
      state.currentUser.profileImageUrl ||
      state.currentUser.profileImage ||
      getImageUrl(state.currentUser.profileImageUrls);
    setProfilePreview(profileUrl);

    // 현재 닉네임은 이미 사용 중이므로 체크 완료 상태로 설정
    state.nicknameChecked = true;
    state.nicknameAvailable = true;
  } catch (error) {
    if (error.status === 401) {
      openModal(
        '로그인 필요',
        '로그인이 필요한 서비스입니다. 로그인 페이지로 이동합니다.',
        () => {
          window.location.href = '/login';
        },
        {
          confirmText: '로그인하기',
          cancelText: '취소',
          onCancel: () => {
            window.location.href = '/feed';
          },
        }
      );
      return;
    }

    showToast(
      error.message || '사용자 정보를 불러오는 데 실패했습니다.',
      'error'
    );
    window.location.href = '/profile';
  }
}

/**
 * 현재 비밀번호 검증
 */
async function checkCurrentPassword(password) {
  const currentPasswordError = document.getElementById('currentPasswordError');

  if (!password) {
    state.currentPasswordVerified = false;
    hideError(currentPasswordError);
    return false;
  }

  try {
    const result = await verifyPassword(password);
    if (result?.valid) {
      state.currentPasswordVerified = true;
      hideError(currentPasswordError);
      return true;
    } else {
      state.currentPasswordVerified = false;
      showError(currentPasswordError, '현재 비밀번호가 일치하지 않습니다.');
      return false;
    }
  } catch (error) {
    logger.error('[비밀번호 검증] 실패:', error);
    state.currentPasswordVerified = false;
    showError(currentPasswordError, '현재 비밀번호가 일치하지 않습니다.');
    return false;
  }
}

/**
 * 닉네임 중복 체크
 */
async function checkNickname(nickname) {
  const nicknameError = document.getElementById('nicknameError');

  // 현재 닉네임과 같으면 체크 불필요
  if (state.currentUser && state.currentUser.nickname === nickname) {
    state.nicknameChecked = true;
    state.nicknameAvailable = true;
    hideError(nicknameError);
    return true;
  }

  // 형식 검증
  if (!validateNickname(nickname)) {
    state.nicknameChecked = false;
    state.nicknameAvailable = false;
    showError(nicknameError, '닉네임은 2자 이상 10자 이하로 입력해주세요.');
    return false;
  }

  try {
    const result = await checkNicknameAvailability(nickname);
    if (result?.available) {
      state.nicknameChecked = true;
      state.nicknameAvailable = true;
      hideError(nicknameError);
      return true;
    } else {
      state.nicknameChecked = true;
      state.nicknameAvailable = false;
      showError(nicknameError, '이미 사용 중인 닉네임입니다.');
      return false;
    }
  } catch (error) {
    logger.error('[닉네임 체크] 실패:', error);
    state.nicknameChecked = false;
    state.nicknameAvailable = false;
    showError(nicknameError, '닉네임 확인에 실패했습니다.');
    return false;
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  if (state.isSubmitting) return;

  const nicknameInput = document.getElementById('nickname');
  const currentPasswordInput = document.getElementById('currentPassword');
  const newPasswordInput = document.getElementById('newPassword');
  const newPasswordConfirmInput = document.getElementById('newPasswordConfirm');

  const nicknameError = document.getElementById('nicknameError');
  const currentPasswordError = document.getElementById('currentPasswordError');
  const newPasswordError = document.getElementById('newPasswordError');
  const newPasswordConfirmError = document.getElementById(
    'newPasswordConfirmError'
  );

  hideError(nicknameError);
  hideError(currentPasswordError);
  hideError(newPasswordError);
  hideError(newPasswordConfirmError);

  const nickname = nicknameInput.value.trim();
  const currentPassword = currentPasswordInput.value;
  const newPassword = newPasswordInput.value;
  const newPasswordConfirm = newPasswordConfirmInput.value;

  let isValid = true;

  // 닉네임 형식 검증
  if (!validateNickname(nickname)) {
    showError(nicknameError, '닉네임은 2자 이상 10자 이하로 입력해주세요.');
    isValid = false;
  }

  // 닉네임이 변경되었고 중복 체크가 안 되었으면 체크
  const nicknameChanged =
    state.currentUser && state.currentUser.nickname !== nickname;
  if (nicknameChanged && !state.nicknameAvailable) {
    const available = await checkNickname(nickname);
    if (!available) {
      isValid = false;
    }
  }

  const wantsPasswordChange =
    currentPassword.length > 0 ||
    newPassword.length > 0 ||
    newPasswordConfirm.length > 0;

  if (wantsPasswordChange) {
    if (!currentPassword) {
      showError(currentPasswordError, '현재 비밀번호를 입력해주세요.');
      isValid = false;
    } else if (!state.currentPasswordVerified) {
      // 현재 비밀번호가 검증되지 않았으면 검증 수행
      const verified = await checkCurrentPassword(currentPassword);
      if (!verified) {
        isValid = false;
      }
    }

    if (!validatePassword(newPassword)) {
      showError(
        newPasswordError,
        '비밀번호는 8자 이상, 20자 이하이며, 대문자, 소문자, 숫자, 특수문자를 각각 최소 1개 포함해야 합니다.'
      );
      isValid = false;
    } else if (currentPassword && newPassword === currentPassword) {
      showError(
        newPasswordError,
        '현재 비밀번호와 다른 비밀번호를 입력해주세요.'
      );
      isValid = false;
    }

    if (newPassword !== newPasswordConfirm) {
      showError(newPasswordConfirmError, '새 비밀번호가 일치하지 않습니다.');
      isValid = false;
    }
  }

  if (!isValid) {
    return;
  }

  const saveBtn = document.getElementById('saveBtn');

  try {
    state.isSubmitting = true;
    saveBtn.disabled = true;
    saveBtn.textContent = '저장 중...';

    const profilePayload = {};

    // 닉네임 변경
    if (nicknameChanged) {
      profilePayload.nickname = nickname;
    }

    // 프로필 이미지 처리
    if (state.profileImageMetadata) {
      // 새 이미지 업로드
      try {
        logger.debug(
          '[프로필 수정] 메타데이터 저장 요청:',
          state.profileImageMetadata
        );
        const imageResult = await saveImageMetadata(state.profileImageMetadata);
        logger.debug('[프로필 수정] 메타데이터 저장 응답:', imageResult);

        if (imageResult?.imageId !== undefined) {
          profilePayload.profileImageId = imageResult.imageId;
        }
      } catch (imageError) {
        logger.error('[프로필 수정] 메타데이터 저장 실패:', imageError);
        showToast('이미지 저장에 실패했습니다.', 'error');
        throw imageError;
      }
    } else if (state.removeImage) {
      // 이미지 삭제 API 호출
      try {
        logger.debug('[프로필 수정] 프로필 이미지 삭제 요청');
        await deleteProfileImage();
        logger.debug('[프로필 수정] 프로필 이미지 삭제 완료');
      } catch (deleteError) {
        logger.error('[프로필 수정] 프로필 이미지 삭제 실패:', deleteError);
        // 이미 이미지가 없는 경우 무시
      }
    }

    // 닉네임 또는 이미지 변경이 있으면 프로필 업데이트
    if (Object.keys(profilePayload).length > 0) {
      await updateProfile(profilePayload);
    }

    // 비밀번호 변경 (이미 현재 비밀번호 검증 완료됨)
    if (wantsPasswordChange) {
      await changePassword({
        currentPassword,
        newPassword,
      });
    }

    // 저장 성공 시 바로 페이지 이동 (Toast는 페이지 전환으로 보이지 않으므로 생략)
    window.location.href = '/profile';
  } catch (error) {
    if (error.errors) {
      if (error.errors.nickname) {
        showError(nicknameError, error.errors.nickname);
      }
      if (error.errors.currentPassword) {
        showError(currentPasswordError, error.errors.currentPassword);
      }
      if (error.errors.newPassword) {
        showError(newPasswordError, error.errors.newPassword);
      }
    }
    // 에러는 각 필드 아래에 표시되므로 Toast 생략
  } finally {
    state.isSubmitting = false;
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '저장';
    }
  }
}

function initEventListeners() {
  const nicknameInput = document.getElementById('nickname');
  const currentPasswordInput = document.getElementById('currentPassword');
  const form = document.getElementById('editForm');

  // 취소 버튼
  document
    .getElementById('cancelBtn')
    .addEventListener('click', () => history.back());

  // 폼 제출
  form.addEventListener('submit', handleSubmit);

  // 모든 input 필드에서 Enter 키로 폼 제출 방지
  form.addEventListener('keydown', e => {
    // Enter 키이고, textarea가 아니고, 한글 조합 중이 아닐 때
    if (
      e.key === 'Enter' &&
      e.target.tagName !== 'TEXTAREA' &&
      !e.isComposing
    ) {
      e.preventDefault();
    }
  });

  // 닉네임 입력 시 중복 체크 상태 리셋
  nicknameInput.addEventListener('input', () => {
    state.nicknameChecked = false;
    state.nicknameAvailable = false;
    hideError(document.getElementById('nicknameError'));
  });

  // 닉네임 blur 시 중복 체크
  nicknameInput.addEventListener('blur', async () => {
    const nickname = nicknameInput.value.trim();
    if (nickname && validateNickname(nickname)) {
      await checkNickname(nickname);
    }
  });

  // 현재 비밀번호 입력 시 검증 상태 리셋
  currentPasswordInput.addEventListener('input', () => {
    state.currentPasswordVerified = false;
    hideError(document.getElementById('currentPasswordError'));
  });

  // 현재 비밀번호 blur 시 검증
  currentPasswordInput.addEventListener('blur', async () => {
    const password = currentPasswordInput.value;
    if (password) {
      await checkCurrentPassword(password);
    }
  });

  // 새 비밀번호 확인 실시간 검증
  const newPasswordInput = document.getElementById('newPassword');
  const newPasswordConfirmInput = document.getElementById('newPasswordConfirm');
  const newPasswordConfirmError = document.getElementById(
    'newPasswordConfirmError'
  );
  const newPasswordError = document.getElementById('newPasswordError');
  const newPasswordValidIcon = document.getElementById('newPasswordValidIcon');
  const passwordMatchIcon = document.getElementById('passwordMatchIcon');

  function validatePasswordFields() {
    const currentPw = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmPassword = newPasswordConfirmInput.value;

    // 새 비밀번호 조건 검증
    const isNewPasswordValid = validatePassword(newPassword);
    const isSameAsCurrent =
      newPassword && currentPw && newPassword === currentPw;

    if (isSameAsCurrent) {
      showError(
        newPasswordError,
        '현재 비밀번호와 다른 비밀번호를 입력해주세요.'
      );
      newPasswordValidIcon.hidden = true;
    } else if (newPassword && !isNewPasswordValid) {
      // 입력은 있지만 조건 불충족 - 에러는 blur 시에만 표시
      newPasswordValidIcon.hidden = true;
    } else if (isNewPasswordValid) {
      hideError(newPasswordError);
      newPasswordValidIcon.hidden = false;
    } else {
      hideError(newPasswordError);
      newPasswordValidIcon.hidden = true;
    }

    // 새 비밀번호 확인 검증
    if (confirmPassword) {
      if (newPassword !== confirmPassword) {
        showError(newPasswordConfirmError, '새 비밀번호가 일치하지 않습니다.');
        passwordMatchIcon.hidden = true;
      } else {
        hideError(newPasswordConfirmError);
        passwordMatchIcon.hidden = false;
      }
    } else {
      hideError(newPasswordConfirmError);
      passwordMatchIcon.hidden = true;
    }
  }

  newPasswordConfirmInput.addEventListener('input', validatePasswordFields);
  newPasswordInput.addEventListener('input', validatePasswordFields);
  currentPasswordInput.addEventListener('input', validatePasswordFields);

  bindImageInput();
}

document.addEventListener('DOMContentLoaded', async () => {
  await renderPageLayout('layout-template');
  await loadInitialData();
  initEventListeners();
});
