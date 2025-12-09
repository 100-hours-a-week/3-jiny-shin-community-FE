/**
 * Header 컴포넌트 이벤트 핸들러
 */

/**
 * 스마트 뒤로가기 처리
 * - 같은 도메인에서 왔고 히스토리가 있으면: history.back()
 * - 외부에서 왔거나 히스토리가 없으면: 기본 경로(/feed)로 이동
 */
function handleSmartBack() {
  const referrer = document.referrer;
  const currentOrigin = window.location.origin;
  const currentPath = window.location.pathname;

  // 페이지별 기본 뒤로가기 경로 설정 (더 긴/구체적인 경로를 먼저 배치)
  const defaultBackRoutes = [
    { prefix: '/profile/edit', backUrl: '/profile' }, // 프로필 수정 → 프로필
    { prefix: '/profile', backUrl: '/feed' }, // 프로필 → 피드
    { prefix: '/post/', backUrl: '/feed' }, // 게시물 상세 → 피드
    { prefix: '/write', backUrl: '/feed' }, // 글 작성 → 피드
  ];

  // 현재 경로에 맞는 기본 뒤로가기 경로 찾기
  let defaultBackUrl = '/feed';
  for (const route of defaultBackRoutes) {
    if (currentPath.startsWith(route.prefix)) {
      defaultBackUrl = route.backUrl;
      break;
    }
  }

  // 같은 도메인에서 왔고, 히스토리가 2개 이상이면 뒤로가기
  // (히스토리 1개 = 현재 페이지만 있음)
  if (referrer && referrer.startsWith(currentOrigin) && window.history.length > 1) {
    window.history.back();
  } else {
    // 외부에서 왔거나 히스토리가 없으면 기본 경로로 이동
    window.location.href = defaultBackUrl;
  }
}

/**
 * 헤더 이벤트 리스너 초기화
 */
export function initHeaderEvents() {
  // 뒤로가기 버튼
  const backBtn = document.querySelector('.header__back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', handleSmartBack);
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
