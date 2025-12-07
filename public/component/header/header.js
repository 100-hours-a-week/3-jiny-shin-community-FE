/**
 * Header 컴포넌트 이벤트 핸들러
 */

/**
 * 헤더 이벤트 리스너 초기화
 */
export function initHeaderEvents() {
  // 뒤로가기 버튼
  const backBtn = document.querySelector('.header__back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      // 브라우저 히스토리 뒤로가기
      window.history.back();
    });
  }

  // 타이틀 (홈으로 이동)
  const title = document.querySelector('.header__title');
  if (title) {
    title.style.cursor = 'pointer';
    title.addEventListener('click', () => {
      window.location.href = '/feed';
    });
  }

  // 프로필 이미지 (프로필 페이지로 이동)
  const profileImg = document.querySelector('.header__profile');
  if (profileImg) {
    profileImg.style.cursor = 'pointer';
    profileImg.addEventListener('click', () => {
      window.location.href = '/profile';
    });
  }
}
