import { getPosts } from '../../../services/post/postApi.js';
import { createPostCard } from '../../component/post-card/post-card.js';
import { renderPageLayout } from '../../../utils/layoutPage.js';
import { logger } from '../../../utils/logger.js';

// 페이징 상태
const PAGE_SIZE = 10;
let nextCursor = null;
let hasNext = true;
let isLoading = false;
let isInitialLoad = true;

/**
 * 로딩 스피너 생성
 */
function createLoadingSpinner() {
  const spinner = document.createElement('div');
  spinner.id = 'posts-loading';
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
function showLoading() {
  const postsList = document.getElementById('posts-list');
  if (!postsList) return;

  let spinner = document.getElementById('posts-loading');
  if (!spinner) {
    spinner = createLoadingSpinner();
    postsList.after(spinner);
  }
  spinner.style.display = 'flex';
}

/**
 * 로딩 스피너 숨김
 */
function hideLoading() {
  const spinner = document.getElementById('posts-loading');
  if (spinner) {
    spinner.style.display = 'none';
  }
}

/**
 * 빈 상태 메시지 표시
 */
function showEmptyState() {
  const postsList = document.getElementById('posts-list');
  if (!postsList) return;

  postsList.innerHTML = '';
  const emptyMessage = document.createElement('div');
  emptyMessage.className = 'post-card post-card--empty';

  const icon = document.createElement('i');
  icon.setAttribute('data-lucide', 'scroll');
  icon.className = 'post-card__empty-icon';

  const text = document.createElement('p');
  text.className = 'post-card__empty-text';
  text.textContent = '아직 기록이 없습니다. 첫 번째 이야기를 들려주세요!';

  emptyMessage.appendChild(icon);
  emptyMessage.appendChild(text);
  postsList.appendChild(emptyMessage);

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

/**
 * 에러 메시지 표시
 */
function showError() {
  const postsList = document.getElementById('posts-list');
  if (!postsList) return;

  postsList.innerHTML = '';
  const errorMessage = document.createElement('p');
  errorMessage.className = 'empty-message';
  errorMessage.textContent = '게시글을 불러오는 데 실패했습니다.';
  postsList.appendChild(errorMessage);
}

/**
 * 게시글 목록 로드 (인피니티 스크롤)
 */
async function loadPosts() {
  // 로딩 중이거나 더 이상 데이터가 없으면 종료
  if (isLoading || !hasNext) return;

  const postsList = document.getElementById('posts-list');
  if (!postsList) return;

  isLoading = true;

  // 초기 로드 시 컨테이너 초기화
  if (isInitialLoad) {
    postsList.innerHTML = '';
    postsList.classList.add('posts-grid');
  }

  showLoading();

  try {
    const result = await getPosts({
      cursor: nextCursor,
      limit: PAGE_SIZE,
    });

    const posts = result?.posts ?? [];
    hasNext = result?.hasNext ?? false;
    nextCursor = result?.nextCursor ?? null;

    // 초기 로드인데 데이터가 없으면 빈 상태 표시
    if (isInitialLoad && posts.length === 0) {
      showEmptyState();
      hideLoading();
      isLoading = false;
      isInitialLoad = false;
      return;
    }

    // 게시글 카드 추가
    posts.forEach(post => {
      const postCard = createPostCard(post);
      if (postCard) {
        postsList.appendChild(postCard);
      }
    });

    // Lucide 아이콘 초기화
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    isInitialLoad = false;
  } catch (error) {
    logger.error('게시글 목록 로드 실패:', error);
    if (isInitialLoad) {
      showError();
    }
  } finally {
    hideLoading();
    isLoading = false;
  }
}

// Intersection Observer 인스턴스 (정리용)
let scrollObserver = null;

/**
 * 인피니티 스크롤 설정 (Intersection Observer)
 */
function setupInfiniteScroll() {
  // 센티넬 요소 생성 (스크롤 감지용)
  const postsList = document.getElementById('posts-list');
  if (!postsList) return;

  const sentinel = document.createElement('div');
  sentinel.id = 'scroll-sentinel';
  sentinel.className = 'scroll-sentinel';
  sentinel.setAttribute('aria-hidden', 'true');
  postsList.after(sentinel);

  // Intersection Observer 설정
  scrollObserver = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !isLoading && hasNext) {
          loadPosts();
        }
      });
    },
    {
      root: null, // viewport 기준
      rootMargin: '100px', // 100px 전에 미리 로드
      threshold: 0,
    }
  );

  scrollObserver.observe(sentinel);
}

/**
 * 인피니티 스크롤 정리
 */
function cleanupInfiniteScroll() {
  if (scrollObserver) {
    scrollObserver.disconnect();
    scrollObserver = null;
  }
}

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', async () => {
  await renderPageLayout('layout-template');
  await loadPosts();
  setupInfiniteScroll();
});

// 페이지 이탈 시 Observer 정리
window.addEventListener('pagehide', cleanupInfiniteScroll);
