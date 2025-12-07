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

// ============ 프로필 로드 ============

async function loadProfile() {
  try {
    currentUser = await getCurrentUser();

    if (!currentUser) {
      throw new Error('사용자 정보를 불러오지 못했습니다.');
    }

    // 사용자 정보 표시
    document.getElementById('userEmail').textContent =
      currentUser.email ?? '';
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

    showToast(error.message || '사용자 정보를 불러오는 데 실패했습니다.', 'error');
  }
}

// ============ 내 게시글 로드 ============

async function loadMyPosts() {
  const postsList = document.getElementById('postsList');
  const emptyState = document.getElementById('emptyState');
  const postsCount = document.getElementById('postsCount');

  try {
    const result = await getMyPosts({ limit: 50 });
    const posts = result?.posts ?? [];

    // 게시글 수 업데이트 (0이면 숨김)
    const count = result?.count ?? posts.length;
    postsCount.textContent = count > 0 ? `${count}개` : '';

    if (posts.length === 0) {
      postsList.innerHTML = '';
      emptyState.removeAttribute('hidden');
      return;
    }

    emptyState.setAttribute('hidden', '');
    postsList.innerHTML = '';

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
  } catch (error) {
    logger.error('내 게시글을 불러오지 못했습니다.', error);
    postsCount.textContent = '';
    postsList.innerHTML = '';
    emptyState.removeAttribute('hidden');
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
    showToast(error.message || '회원 탈퇴에 실패했습니다. 다시 시도해주세요.', 'error');
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
    openModal(
      '로그아웃',
      '로그아웃 하시겠습니까?',
      handleLogout,
      { confirmText: '로그아웃' }
    );
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
  initSettingsMenu();
  initEventListeners();
});
