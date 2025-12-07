import { post } from '../httpClient.js';

/**
 * 세션 기반 로그인.
 * 성공 시 서버가 JSESSIONID 쿠키를 내려준다.
 */
export async function login({ email, password }) {
  if (!email || typeof email !== 'string') {
    throw new Error('이메일을 입력해주세요.');
  }

  if (!password || typeof password !== 'string') {
    throw new Error('비밀번호를 입력해주세요.');
  }

  const response = await post('/auth/login', {
    body: { email, password },
  });

  return response.data ?? null;
}

/**
 * 세션 로그아웃. 서버 세션과 쿠키를 종료한다.
 */
export async function logout() {
  const response = await post('/auth/logout');
  return response.data ?? null;
}
