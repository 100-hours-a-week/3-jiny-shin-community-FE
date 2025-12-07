/**
 * Bottom Navigation Component
 * 현재 페이지에 따라 active 상태 설정
 * 인증이 필요한 페이지 접근 시 로그인 상태 확인
 */

import { getCurrentUser } from '../../../services/user/userApi.js';
import { openModal } from '../../../utils/layout.js';

// 인증이 필요한 네비게이션 타입
const AUTH_REQUIRED_NAV = ['write', 'profile'];

/**
 * Bottom Navigation 이벤트 초기화
 */
export function initBottomNavEvents() {
  const bottomNav = document.querySelector('.bottom-nav');
  if (!bottomNav) return;

  // 현재 경로에 따라 active 상태 설정
  const currentPath = window.location.pathname;
  const navItems = bottomNav.querySelectorAll('.bottom-nav__item');

  navItems.forEach(item => {
    const navType = item.dataset.nav;
    const isActive = checkIsActive(currentPath, navType);

    if (isActive) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }

    // 인증이 필요한 네비게이션에 클릭 핸들러 추가
    if (AUTH_REQUIRED_NAV.includes(navType)) {
      item.addEventListener('click', handleAuthRequiredNavClick);
    }
  });

  // Lucide 아이콘 렌더링
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

/**
 * 인증이 필요한 네비게이션 클릭 핸들러
 * @param {Event} event - 클릭 이벤트
 */
async function handleAuthRequiredNavClick(event) {
  const targetHref = event.currentTarget.getAttribute('href');

  // 기본 네비게이션 동작 막기
  event.preventDefault();

  try {
    // 로그인 상태 확인
    await getCurrentUser();
    // 로그인 되어있으면 해당 페이지로 이동
    window.location.href = targetHref;
  } catch {
    // 비로그인 상태면 모달 표시
    openModal(
      '로그인 필요',
      '로그인이 필요한 서비스입니다. 로그인 페이지로 이동합니다.',
      () => {
        window.location.href = '/login';
      },
      {
        confirmText: '로그인하기',
        cancelText: '취소',
      }
    );
  }
}

/**
 * 현재 경로가 해당 네비게이션 항목과 일치하는지 확인
 * @param {string} currentPath - 현재 URL 경로
 * @param {string} navType - 네비게이션 타입 (home, write, profile)
 * @returns {boolean}
 */
function checkIsActive(currentPath, navType) {
  const pathMap = {
    home: ['/feed', '/home', '/'],
    write: ['/write'],
    profile: ['/profile', '/profile/edit'],
  };

  const paths = pathMap[navType] || [];

  // 정확한 매칭 또는 경로 시작 확인
  return paths.some(path => {
    if (path === '/') {
      return currentPath === path;
    }
    return currentPath === path || currentPath.startsWith(path.replace('.html', ''));
  });
}
