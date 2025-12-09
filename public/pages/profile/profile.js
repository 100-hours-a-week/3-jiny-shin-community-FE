import { logout } from '../../../services/auth/authApi.js';
import {
  deleteCurrentUser,
  getCurrentUser,
} from '../../../services/user/userApi.js';
import { getMyPosts } from '../../../services/post/postApi.js';
import { openModal, showToast } from '../../../utils/layout.js';
import { renderPageLayout } from '../../../utils/layoutPage.js';
import { createAvatar } from '../../../component/avatar/avatar.js';
import { createPostCard } from '../../../component/post-card/post-card.js';
import { getImageUrl } from '../../../utils/format.js';
import { logger } from '../../../utils/logger.js';

let currentUser = null;

// 내 게시글 페이징 상태
const MY_POSTS_PAGE_SIZE = 20;
let myPostsNextCursor = null;
let myPostsHasNext = true;
let myPostsIsLoading = false;
let myPostsIsInitialLoad = true;

// ============ 프로필 로드 ============

async function loadProfile() {
  try {
    currentUser = await getCurrentUser();

    if (!currentUser) {
      throw new Error('사용자 정보를 불러오지 못했습니다.');
    }

    // 사용자 정보 표시
    document.getElementById('userEmail').textContent = currentUser.email ?? '';
    document.getElementById('userNickname').textContent =
      currentUser.nickname ?? '';

    // 프로필 아바타 렌더링
    const avatarContainer = document.getElementById('profileAvatar');
    if (avatarContainer) {
      avatarContainer.innerHTML = '';
      const profileUrl =
        currentUser.profileImageUrl ||
        currentUser.profileImage ||
        getImageUrl(currentUser.profileImageUrls);
      const avatar = createAvatar({
        nickname: currentUser.nickname ?? '',
        imageUrl: profileUrl,
        size: 'lg',
      });
      avatarContainer.appendChild(avatar);
    }

    // Lucide 아이콘 렌더링
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  } catch (error) {
    logger.error('프로필 정보를 불러오지 못했습니다.', error);

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
  }
}

// ============ 내 게시글 로드 ============

/**
 * 로딩 스피너 생성
 */
function createMyPostsLoadingSpinner() {
  const spinner = document.createElement('div');
  spinner.id = 'my-posts-loading';
  spinner.className = 'posts-loading';

  const dot = document.createElement('span');
  dot.className = 'post-card__loading-dot';

  const text = document.createElement('span');
  text.textContent = '게시글을 불러오는 중...';

  spinner.appendChild(dot);
  spinner.appendChild(text);
  return spinner;
}

/**
 * 로딩 스피너 표시
 */
function showMyPostsLoading() {
  const postsList = document.getElementById('postsList');
  if (!postsList) return;

  let spinner = document.getElementById('my-posts-loading');
  if (!spinner) {
    spinner = createMyPostsLoadingSpinner();
    postsList.after(spinner);
  }
  spinner.style.display = 'flex';
}

/**
 * 로딩 스피너 숨김
 */
function hideMyPostsLoading() {
  const spinner = document.getElementById('my-posts-loading');
  if (spinner) {
    spinner.style.display = 'none';
  }
}

/**
 * 내 게시글 목록 로드 (인피니티 스크롤)
 */
async function loadMyPosts() {
  // 로딩 중이거나 더 이상 데이터가 없으면 종료
  if (myPostsIsLoading || !myPostsHasNext) return;

  const postsList = document.getElementById('postsList');
  const emptyState = document.getElementById('emptyState');
  const postsCount = document.getElementById('postsCount');

  if (!postsList) return;

  myPostsIsLoading = true;

  // 초기 로드 시 컨테이너 초기화
  if (myPostsIsInitialLoad) {
    postsList.innerHTML = '';
  }

  showMyPostsLoading();

  try {
    const result = await getMyPosts({
      cursor: myPostsNextCursor,
      limit: MY_POSTS_PAGE_SIZE,
    });

    const posts = result?.posts ?? [];
    myPostsHasNext = result?.hasNext ?? false;
    myPostsNextCursor = result?.nextCursor ?? null;

    // 게시글 수 업데이트 (초기 로드 시에만)
    if (myPostsIsInitialLoad) {
      const count = result?.count ?? posts.length;
      postsCount.textContent = count > 0 ? `${count}개` : '';
    }

    // 초기 로드인데 데이터가 없으면 빈 상태 표시
    if (myPostsIsInitialLoad && posts.length === 0) {
      postsList.innerHTML = '';
      emptyState.removeAttribute('hidden');
      hideMyPostsLoading();
      myPostsIsLoading = false;
      myPostsIsInitialLoad = false;
      return;
    }

    emptyState.setAttribute('hidden', '');

    // 게시글 카드 추가
    posts.forEach(post => {
      const postCard = createPostCard(post);
      if (postCard) {
        postsList.appendChild(postCard);
      }
    });

    // Lucide 아이콘 렌더링
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    myPostsIsInitialLoad = false;
  } catch (error) {
    logger.error('내 게시글을 불러오지 못했습니다.', error);
    if (myPostsIsInitialLoad) {
      postsCount.textContent = '';
      postsList.innerHTML = '';
      emptyState.removeAttribute('hidden');
    }
  } finally {
    hideMyPostsLoading();
    myPostsIsLoading = false;
  }
}

// Intersection Observer 인스턴스 (정리용)
let myPostsScrollObserver = null;

/**
 * 내 게시글 인피니티 스크롤 설정 (Intersection Observer)
 */
function setupMyPostsInfiniteScroll() {
  const postsList = document.getElementById('postsList');
  if (!postsList) return;

  // 센티넬 요소 생성
  const sentinel = document.createElement('div');
  sentinel.id = 'my-posts-scroll-sentinel';
  sentinel.className = 'scroll-sentinel';
  sentinel.setAttribute('aria-hidden', 'true');
  postsList.after(sentinel);

  // Intersection Observer 설정
  myPostsScrollObserver = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !myPostsIsLoading && myPostsHasNext) {
          loadMyPosts();
        }
      });
    },
    {
      root: null,
      rootMargin: '100px',
      threshold: 0,
    }
  );

  myPostsScrollObserver.observe(sentinel);
}

/**
 * 인피니티 스크롤 정리
 */
function cleanupMyPostsInfiniteScroll() {
  if (myPostsScrollObserver) {
    myPostsScrollObserver.disconnect();
    myPostsScrollObserver = null;
  }
}

// ============ 설정 메뉴 ============

function initSettingsMenu() {
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsMenu = document.getElementById('settingsMenu');

  if (!settingsBtn || !settingsMenu) return;

  // 설정 버튼 클릭 시 메뉴 토글
  settingsBtn.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = !settingsMenu.hidden;

    if (isOpen) {
      closeSettingsMenu();
    } else {
      openSettingsMenu();
    }
  });

  // 메뉴 외부 클릭 시 닫기
  document.addEventListener('click', e => {
    if (!settingsMenu.hidden && !settingsMenu.contains(e.target)) {
      closeSettingsMenu();
    }
  });

  // ESC 키로 닫기
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !settingsMenu.hidden) {
      closeSettingsMenu();
      settingsBtn.focus();
    }
  });
}

function openSettingsMenu() {
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsMenu = document.getElementById('settingsMenu');

  settingsMenu.removeAttribute('hidden');
  settingsBtn.setAttribute('aria-expanded', 'true');

  // Lucide 아이콘 렌더링
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

function closeSettingsMenu() {
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsMenu = document.getElementById('settingsMenu');

  settingsMenu.setAttribute('hidden', '');
  settingsBtn.setAttribute('aria-expanded', 'false');
}

// ============ 핸들러 ============

async function handleDeleteAccount() {
  try {
    await deleteCurrentUser();
    // 회원 탈퇴 API에서 이미 세션이 무효화되므로 logout 호출 불필요
    // 이전 사용자의 임시저장 데이터 정리
    localStorage.removeItem('anoo_post_draft');
    window.location.href = '/login';
  } catch (error) {
    showToast(
      error.message || '회원 탈퇴에 실패했습니다. 다시 시도해주세요.',
      'error'
    );
  }
}

async function handleLogout() {
  try {
    await logout();
  } catch (error) {
    logger.error('로그아웃 실패:', error);
  } finally {
    // 이전 사용자의 임시저장 데이터 정리
    localStorage.removeItem('anoo_post_draft');
    window.location.href = '/login';
  }
}

// ============ 이벤트 리스너 ============

function initEventListeners() {
  // 프로필 수정 버튼
  document.getElementById('editProfileBtn').addEventListener('click', () => {
    window.location.href = '/profile/edit';
  });

  // 로그아웃 버튼
  document.getElementById('logoutBtn').addEventListener('click', () => {
    closeSettingsMenu();
    openModal('로그아웃', '로그아웃 하시겠습니까?', handleLogout, {
      confirmText: '로그아웃',
    });
  });

  // 회원 탈퇴 버튼
  document.getElementById('deleteAccountBtn').addEventListener('click', () => {
    closeSettingsMenu();
    openModal(
      '회원 탈퇴',
      '정말로 탈퇴하시겠습니까?\n작성한 게시물과 댓글은 삭제됩니다.',
      handleDeleteAccount,
      {
        confirmText: '탈퇴',
        confirmColor: 'var(--color-danger)',
      }
    );
  });

  // 이용약관 버튼
  document.getElementById('termsBtn').addEventListener('click', e => {
    e.preventDefault();
    closeSettingsMenu();
    window.open('/terms', '_blank');
  });

  // 개인정보처리방침 버튼
  document.getElementById('privacyBtn').addEventListener('click', e => {
    e.preventDefault();
    closeSettingsMenu();
    window.open('/privacy', '_blank');
  });
}

// ============ 초기화 ============

document.addEventListener('DOMContentLoaded', async () => {
  await renderPageLayout('layout-template');
  await loadProfile();
  await loadMyPosts();
  setupMyPostsInfiniteScroll();
  initSettingsMenu();
  initEventListeners();
});

// 페이지 이탈 시 Observer 정리
window.addEventListener('pagehide', cleanupMyPostsInfiniteScroll);
