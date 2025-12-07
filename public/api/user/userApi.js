import { del, get, patch, post } from '../httpClient.js';

/**
 * 회원가입
 * API: POST /api/users
 */
export async function signUp({ email, nickname, password, profileImageId }) {
  if (!email || typeof email !== 'string') {
    throw new Error('이메일을 입력해주세요.');
  }

  if (!nickname || typeof nickname !== 'string') {
    throw new Error('닉네임을 입력해주세요.');
  }

  if (!password || typeof password !== 'string') {
    throw new Error('비밀번호를 입력해주세요.');
  }

  const body = { email, nickname, password };

  if (profileImageId !== undefined && profileImageId !== null) {
    body.profileImageId = profileImageId;
  }

  const response = await post('/users', {
    body,
    withCredentials: true, // 세션 쿠키 받기 위해 true
  });

  return response.data ?? null;
}

/**
 * 내 정보 조회
 */
export async function getCurrentUser() {
  const response = await get('/users/me');
  return response.data ?? null;
}

/**
 * 프로필 수정 (닉네임/프로필 이미지)
 */
export async function updateProfile({ nickname, profileImageId }) {
  const payload = {};

  if (nickname !== undefined) {
    if (!nickname || typeof nickname !== 'string') {
      throw new Error('닉네임을 올바르게 입력해주세요.');
    }
    payload.nickname = nickname;
  }

  if (profileImageId !== undefined) {
    payload.profileImageId = profileImageId;
  }

  if (Object.keys(payload).length === 0) {
    throw new Error('수정할 항목을 최소 1개 이상 입력해주세요.');
  }

  const response = await patch('/users/me', { body: payload });
  return response.data ?? null;
}

/**
 * 비밀번호 변경
 */
export async function changePassword({ currentPassword, newPassword }) {
  if (!currentPassword || typeof currentPassword !== 'string') {
    throw new Error('현재 비밀번호를 입력해주세요.');
  }

  if (!newPassword || typeof newPassword !== 'string') {
    throw new Error('새 비밀번호를 입력해주세요.');
  }

  const response = await patch('/users/me/password', {
    body: {
      currentPassword,
      newPassword,
    },
  });

  return response.data ?? null;
}

/**
 * 이메일 사용 가능 여부 확인
 */
export async function checkEmailAvailability(email) {
  if (!email || typeof email !== 'string') {
    throw new Error('이메일을 입력해주세요.');
  }

  const response = await get('/users/check-email', {
    query: { email },
    withCredentials: false,
  });

  return response.data ?? null;
}

/**
 * 닉네임 사용 가능 여부 확인
 */
export async function checkNicknameAvailability(nickname) {
  if (!nickname || typeof nickname !== 'string') {
    throw new Error('닉네임을 입력해주세요.');
  }

  const response = await get('/users/check-nickname', {
    query: { nickname },
    withCredentials: false,
  });

  return response.data ?? null;
}

/**
 * 회원 탈퇴
 */
export async function deleteCurrentUser() {
  const response = await del('/users/me', { parseJson: true });
  return response.data ?? null;
}

/**
 * 프로필 이미지 삭제
 */
export async function deleteProfileImage() {
  const response = await del('/users/me/profile-image', { parseJson: true });
  return response.data ?? null;
}

/**
 * 현재 비밀번호 확인
 */
export async function verifyPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('비밀번호를 입력해주세요.');
  }

  const response = await post('/users/me/verify-password', {
    body: { password },
  });

  return response.data ?? { valid: false };
}
