/**
 * Avatar Component
 * 닉네임 첫 글자를 표시하는 아바타 생성 함수
 */

/**
 * 아바타 엘리먼트 생성
 * @param {Object} options - 아바타 옵션
 * @param {string} options.nickname - 사용자 닉네임 (첫 글자 추출용)
 * @param {string} [options.imageUrl] - 프로필 이미지 URL (있으면 이미지 표시)
 * @param {string} [options.size='md'] - 아바타 크기 (sm, md, lg, xl)
 * @param {string} [options.alt] - 이미지 alt 텍스트
 * @returns {HTMLElement} 아바타 DOM 엘리먼트
 */
export function createAvatar(options) {
  const { nickname = '', imageUrl = null, size = 'md', alt = '' } = options;

  const avatar = document.createElement('div');
  avatar.className = `avatar avatar--${size}`;
  avatar.setAttribute('role', 'img');
  avatar.setAttribute('aria-label', alt || `${nickname}의 프로필`);

  if (imageUrl) {
    // 프로필 이미지가 있는 경우
    const img = document.createElement('img');
    img.className = 'avatar__image';
    img.src = imageUrl;
    img.alt = alt || `${nickname}의 프로필 이미지`;
    img.loading = 'lazy';

    // 이미지 로드 실패 시 이니셜로 fallback
    img.onerror = () => {
      avatar.removeChild(img);
      avatar.textContent = getInitial(nickname);
    };

    avatar.appendChild(img);
  } else {
    // 프로필 이미지가 없는 경우 이니셜 표시
    avatar.textContent = getInitial(nickname);
  }

  return avatar;
}

/**
 * 닉네임에서 첫 글자(이니셜) 추출
 * @param {string} nickname - 닉네임
 * @returns {string} 첫 글자 (대문자)
 */
export function getInitial(nickname) {
  if (!nickname || typeof nickname !== 'string') {
    return '?';
  }

  // 공백 제거 후 첫 글자 추출
  const trimmed = nickname.trim();
  if (!trimmed) {
    return '?';
  }

  // 첫 글자 반환 (한글, 영어 모두 지원)
  return trimmed.charAt(0).toUpperCase();
}

/**
 * 기존 프로필 이미지 엘리먼트를 아바타로 교체
 * @param {HTMLElement} element - 교체할 엘리먼트
 * @param {Object} options - 아바타 옵션
 */
export function replaceWithAvatar(element, options) {
  const avatar = createAvatar(options);
  element.parentNode.replaceChild(avatar, element);
  return avatar;
}
