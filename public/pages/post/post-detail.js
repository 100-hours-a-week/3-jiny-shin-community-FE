import { openModal, showToast } from '../../../utils/layout.js';
import { renderPageLayout } from '../../../utils/layoutPage.js';
import {
  formatCount,
  formatDate,
  escapeHtml,
  getImageUrl,
} from '../../../utils/format.js';
import { getPost, deletePost } from '../../../services/post/postApi.js';
import {
  addPostLike,
  removePostLike,
} from '../../../services/post/postLikeApi.js';
import {
  getComments,
  createComment as createCommentApi,
  deleteComment,
} from '../../../services/comment/commentApi.js';
import { createComment as createCommentComponent } from '../../../component/comment/comment.js';
import { createAvatar } from '../../../component/avatar/avatar.js';
import { getCurrentUser } from '../../../services/user/userApi.js';
import { logger } from '../../../utils/logger.js';

let isLiked = false;
let currentSlide = 0;
let totalSlides = 0;

// 드래그/스와이프 상태
let isDragging = false;
let startX = 0;
let currentX = 0;
let dragThreshold = 50; // 스와이프 감지 임계값

// 댓글 페이징 상태
const COMMENTS_PAGE_SIZE = 20;
let commentsNextCursor = null;
let commentsHasNext = true;
let commentsIsLoading = false;
let allComments = []; // 전체 댓글 저장 (오래된 순 정렬용)
let commentsTotalCount = 0;

/**
 * 404 콘텐츠를 현재 페이지에 렌더링 (URL 변경 없음)
 */
function render404Content() {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  mainContent.innerHTML = `
    <div class="error-page">
      <div class="error-page__content">
        <div class="error-page__icon">
          <i data-lucide="map-pin-off"></i>
        </div>
        <p class="error-page__code">404</p>
        <h1 class="error-page__title">텅 빈 페이지예요</h1>
        <p class="error-page__desc">
          찾으시는 페이지가 존재하지 않거나<br />
          이동되었을 수 있어요
        </p>
        <a href="/feed" class="btn btn--primary">
          홈으로 돌아가기
        </a>
      </div>
    </div>
  `;

  // 404 페이지 스타일 적용
  mainContent.className = '';

  // Lucide 아이콘 초기화
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// ============ 이미지 캐러셀 ============

function renderImageCarousel(images) {
  const carousel = document.getElementById('post-carousel');
  const track = document.getElementById('carousel-track');
  const dots = document.getElementById('carousel-dots');
  const prevBtn = document.getElementById('carousel-prev');
  const nextBtn = document.getElementById('carousel-next');

  // 이미지가 없으면 캐러셀 숨김
  if (!Array.isArray(images) || images.length === 0) {
    carousel.classList.remove('show');
    return;
  }

  // position 순으로 정렬
  const sortedImages = [...images].sort(
    (a, b) => (a.position || 0) - (b.position || 0)
  );

  totalSlides = sortedImages.length;
  currentSlide = 0;

  // 트랙 초기화
  track.innerHTML = '';
  dots.innerHTML = '';

  // 이미지 슬라이드 생성
  sortedImages.forEach((img, index) => {
    const imageUrl = img.imageUrls?.webpUrl || img.imageUrls?.jpgUrl;
    if (!imageUrl) return;

    const slide = document.createElement('div');
    slide.className = 'post-detail__carousel-slide';

    const imgEl = document.createElement('img');
    imgEl.src = imageUrl;
    imgEl.alt = `이미지 ${index + 1}`;
    imgEl.className = 'post-detail__carousel-image';
    slide.appendChild(imgEl);

    track.appendChild(slide);

    // 도트 생성
    const dot = document.createElement('button');
    dot.className = `post-detail__carousel-dot${index === 0 ? ' active' : ''}`;
    dot.setAttribute('aria-label', `이미지 ${index + 1}로 이동`);
    dot.addEventListener('click', () => goToSlide(index));
    dots.appendChild(dot);
  });

  // 캐러셀 표시
  carousel.classList.add('show');

  // 이미지가 1장이면 네비게이션 숨김
  if (totalSlides <= 1) {
    prevBtn.style.display = 'none';
    nextBtn.style.display = 'none';
    dots.style.display = 'none';
  } else {
    prevBtn.style.display = 'flex';
    nextBtn.style.display = 'flex';
    dots.style.display = 'flex';
  }

  updateCarouselUI();
}

function goToSlide(index) {
  if (index < 0 || index >= totalSlides) return;

  currentSlide = index;
  updateCarouselUI();
}

function nextSlide() {
  if (currentSlide < totalSlides - 1) {
    currentSlide++;
    updateCarouselUI();
  }
}

function prevSlide() {
  if (currentSlide > 0) {
    currentSlide--;
    updateCarouselUI();
  }
}

function updateCarouselUI(animate = true) {
  const track = document.getElementById('carousel-track');
  const dots = document.querySelectorAll('.post-detail__carousel-dot');
  const prevBtn = document.getElementById('carousel-prev');
  const nextBtn = document.getElementById('carousel-next');

  // 트랙 이동
  track.style.transition = animate ? 'transform 0.3s ease' : 'none';
  track.style.transform = `translateX(-${currentSlide * 100}%)`;

  // 도트 업데이트
  dots.forEach((dot, index) => {
    dot.classList.toggle('active', index === currentSlide);
  });

  // 버튼 활성화/비활성화
  prevBtn.disabled = currentSlide === 0;
  nextBtn.disabled = currentSlide === totalSlides - 1;
}

// 드래그/스와이프 핸들러
function handleDragStart(e) {
  if (totalSlides <= 1) return;

  isDragging = true;
  startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
  currentX = startX;

  const track = document.getElementById('carousel-track');
  track.style.transition = 'none';
}

function handleDragMove(e) {
  if (!isDragging) return;

  currentX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
  const diff = currentX - startX;
  const track = document.getElementById('carousel-track');
  const offset = -currentSlide * 100 + (diff / track.offsetWidth) * 100;

  track.style.transform = `translateX(${offset}%)`;
}

function handleDragEnd() {
  if (!isDragging) return;

  isDragging = false;
  const diff = currentX - startX;

  if (Math.abs(diff) > dragThreshold) {
    if (diff > 0 && currentSlide > 0) {
      // 오른쪽으로 스와이프 → 이전 슬라이드
      currentSlide--;
    } else if (diff < 0 && currentSlide < totalSlides - 1) {
      // 왼쪽으로 스와이프 → 다음 슬라이드
      currentSlide++;
    }
  }

  updateCarouselUI(true);
}

function initCarouselDrag() {
  const carousel = document.getElementById('post-carousel');
  if (!carousel) return;

  // 마우스 이벤트
  carousel.addEventListener('mousedown', handleDragStart);
  carousel.addEventListener('mousemove', handleDragMove);
  carousel.addEventListener('mouseup', handleDragEnd);
  carousel.addEventListener('mouseleave', handleDragEnd);

  // 터치 이벤트
  carousel.addEventListener('touchstart', handleDragStart, { passive: true });
  carousel.addEventListener('touchmove', handleDragMove, { passive: true });
  carousel.addEventListener('touchend', handleDragEnd);

  // 드래그 중 이미지 선택 방지
  carousel.addEventListener('dragstart', e => e.preventDefault());
}

function getPostIdFromUrl() {
  // /post/:id 형태에서 id 추출
  const pathParts = window.location.pathname.split('/');
  const postId = pathParts[pathParts.length - 1];

  // 유효하지 않은 ID 체크 (undefined, null, 빈 문자열, 'undefined' 문자열)
  if (!postId || postId === 'undefined' || postId === 'null') {
    return null;
  }

  return postId;
}

function renderPost(post) {
  isLiked = Boolean(post.isLiked);

  document.getElementById('post-title').textContent = post.title ?? '게시글';

  // 작성자 아바타 (CSS 아바타 컴포넌트 사용)
  const authorAvatarContainer = document.getElementById('author-avatar');
  const authorNameElement = document.getElementById('author-name');
  const authorNickname = post.author?.nickname ?? '익명';

  if (authorAvatarContainer) {
    authorAvatarContainer.innerHTML = '';
    const authorProfileUrl =
      post.author?.profileImageUrl ||
      post.author?.profileImage ||
      getImageUrl(post.author?.profileImageUrls);
    const avatar = createAvatar({
      nickname: authorNickname,
      imageUrl: authorProfileUrl,
      size: 'md',
    });
    authorAvatarContainer.appendChild(avatar);
  }

  if (authorNameElement) {
    authorNameElement.textContent = authorNickname;
  }

  document.getElementById('post-date').textContent = formatDate(
    post.createdAt,
    true
  );

  // 이미지 캐러셀 렌더링
  renderImageCarousel(post.images);

  const contentElement = document.getElementById('post-content');
  contentElement.innerHTML = (post.content || '')
    .split('\n')
    .map(line => `<p>${escapeHtml(line)}</p>`)
    .join('');

  document.getElementById('likes-count').textContent = formatCount(
    post.likeCount
  );
  document.getElementById('views-count').textContent = formatCount(
    post.viewCount
  );
  document.getElementById('comments-count').textContent = formatCount(
    post.commentCount
  );

  const likeBtn = document.getElementById('like-btn');
  likeBtn.classList.toggle('liked', isLiked);

  const actionsElement = document.getElementById('post-actions');
  actionsElement.style.display = post.isAuthor ? 'flex' : 'none';
}

function createCommentElement(comment) {
  const authorNickname = comment.author?.nickname ?? '익명';
  const profileImage =
    comment.author?.profileImageUrl ||
    comment.author?.profileImage ||
    getImageUrl(comment.author?.profileImageUrls);

  const commentEl = createCommentComponent({
    id: comment.id,
    author: authorNickname,
    profileImage,
    content: comment.content ?? '',
    createdAt: comment.createdAt,
    isAuthor: Boolean(comment.isAuthor),
    isDeleted: Boolean(comment.isDeleted),
    onDelete:
      comment.isAuthor && !comment.isDeleted
        ? () => handleDeleteComment(comment)
        : null,
  });

  return commentEl;
}

/**
 * 댓글 로딩 스피너 생성
 */
function createCommentsLoadingSpinner() {
  const spinner = document.createElement('div');
  spinner.id = 'comments-loading';
  spinner.className = 'comments-loading';

  const dot = document.createElement('span');
  dot.className = 'post-card__loading-dot';

  const text = document.createElement('span');
  text.textContent = '댓글을 불러오는 중...';

  spinner.appendChild(dot);
  spinner.appendChild(text);
  return spinner;
}

/**
 * 댓글 로딩 스피너 표시
 */
function showCommentsLoading() {
  const commentsList = document.getElementById('comments-list');
  if (!commentsList) return;

  let spinner = document.getElementById('comments-loading');
  if (!spinner) {
    spinner = createCommentsLoadingSpinner();
    // 댓글 목록 맨 위에 로딩 표시 (더보기 버튼 위치)
    commentsList.prepend(spinner);
  }
  spinner.style.display = 'flex';
}

/**
 * 댓글 로딩 스피너 숨김
 */
function hideCommentsLoading() {
  const spinner = document.getElementById('comments-loading');
  if (spinner) {
    spinner.style.display = 'none';
  }
}

/**
 * "더보기" 버튼 표시/숨김
 */
function updateLoadMoreButton() {
  const commentsList = document.getElementById('comments-list');
  if (!commentsList) return;

  let loadMoreBtn = document.getElementById('comments-load-more');

  if (commentsHasNext) {
    if (!loadMoreBtn) {
      loadMoreBtn = document.createElement('button');
      loadMoreBtn.id = 'comments-load-more';
      loadMoreBtn.className = 'comments-load-more btn btn--outline';
      loadMoreBtn.textContent = '이전 댓글 더보기';
      loadMoreBtn.addEventListener('click', loadMoreComments);
      commentsList.prepend(loadMoreBtn);
    }
    loadMoreBtn.style.display = 'block';
  } else if (loadMoreBtn) {
    loadMoreBtn.style.display = 'none';
  }
}

/**
 * 댓글 목록 렌더링 (전체 다시 렌더링)
 */
function renderComments() {
  const commentsList = document.getElementById('comments-list');
  const commentsEmpty = document.getElementById('comments-empty');
  const commentCountLabel = document.getElementById('comment-count-label');

  commentCountLabel.textContent = commentsTotalCount;

  if (allComments.length === 0) {
    commentsEmpty.classList.add('show');
    commentsList.innerHTML = '';
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
    return;
  }

  commentsEmpty.classList.remove('show');

  // 기존 댓글만 제거 (더보기 버튼, 로딩 스피너 유지)
  const existingComments = commentsList.querySelectorAll('.comment');
  existingComments.forEach(el => el.remove());

  // 오래된 댓글이 위, 최신 댓글이 아래 순으로 정렬
  const sortedComments = [...allComments].sort((a, b) => a.id - b.id);

  const fragment = document.createDocumentFragment();
  sortedComments.forEach(comment => {
    fragment.appendChild(createCommentElement(comment));
  });
  commentsList.appendChild(fragment);

  // 더보기 버튼 업데이트
  updateLoadMoreButton();

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

async function refreshPost() {
  const postId = getPostIdFromUrl();
  if (!postId) return;

  try {
    const post = await getPost(postId);
    renderPost(post);
  } catch (error) {
    logger.error('게시글 갱신 실패:', error);
  }
}

/**
 * 댓글 페이징 상태 초기화
 */
function resetCommentsState() {
  commentsNextCursor = null;
  commentsHasNext = true;
  commentsIsLoading = false;
  allComments = [];
  commentsTotalCount = 0;
}

/**
 * 댓글 목록 초기 로드 (최신 댓글부터 - desc)
 */
async function loadComments() {
  const postId = getPostIdFromUrl();
  if (!postId) return;

  // 상태 초기화
  resetCommentsState();

  commentsIsLoading = true;
  showCommentsLoading();

  try {
    // 최신 댓글부터 가져옴 (desc)
    const result = await getComments(postId, {
      limit: COMMENTS_PAGE_SIZE,
      sort: 'desc',
    });

    const comments = result?.comments ?? [];
    commentsHasNext = result?.hasNext ?? false;
    commentsNextCursor = result?.nextCursor ?? null;
    commentsTotalCount = result?.count ?? comments.length;

    // 전체 댓글 배열에 추가
    allComments = [...comments];

    renderComments();

    document.getElementById('comments-count').textContent =
      formatCount(commentsTotalCount);
  } catch (error) {
    logger.error('댓글 목록 로드 에러:', error);
    allComments = [];
    commentsTotalCount = 0;
    renderComments();
  } finally {
    hideCommentsLoading();
    commentsIsLoading = false;
  }
}

/**
 * 이전 댓글 더 불러오기
 */
async function loadMoreComments() {
  if (commentsIsLoading || !commentsHasNext) return;

  const postId = getPostIdFromUrl();
  if (!postId) return;

  commentsIsLoading = true;
  showCommentsLoading();

  try {
    const result = await getComments(postId, {
      cursor: commentsNextCursor,
      limit: COMMENTS_PAGE_SIZE,
      sort: 'desc',
    });

    const comments = result?.comments ?? [];
    commentsHasNext = result?.hasNext ?? false;
    commentsNextCursor = result?.nextCursor ?? null;

    // 기존 댓글에 추가 (중복 제거)
    const existingIds = new Set(allComments.map(c => c.id));
    const newComments = comments.filter(c => !existingIds.has(c.id));
    allComments = [...allComments, ...newComments];

    renderComments();
  } catch (error) {
    logger.error('댓글 더보기 로드 에러:', error);
  } finally {
    hideCommentsLoading();
    commentsIsLoading = false;
  }
}

async function handleSubmitComment(event) {
  event.preventDefault();
  const textarea = document.getElementById('comment-textarea');
  const contents = textarea.value.trim();

  if (!contents) {
    showToast('댓글 내용을 입력해주세요.');
    return;
  }

  const postId = getPostIdFromUrl();
  if (!postId) return;

  try {
    await createCommentApi(postId, { contents });
    textarea.value = '';
    textarea.style.height = 'auto';
    await Promise.all([loadComments(), refreshPost()]);
  } catch (error) {
    showToast(error.message || '댓글 작성에 실패했습니다.', 'error');
  }
}

function handleDeleteComment(comment) {
  if (!comment || comment.isDeleted) {
    return;
  }

  openModal(
    '댓글 삭제',
    '정말로 이 댓글을 삭제하시겠습니까?',
    async () => {
      try {
        await deleteComment(comment.id);
        showToast('댓글이 삭제되었습니다.', 'success');
        await Promise.all([loadComments(), refreshPost()]);
      } catch (error) {
        showToast(error.message || '댓글 삭제에 실패했습니다.', 'error');
      }
    },
    {
      confirmText: '삭제',
      cancelText: '취소',
      confirmColor: 'var(--color-danger)',
    }
  );
}

async function handleTogglePostLike() {
  const postId = getPostIdFromUrl();
  if (!postId) return;

  const wasLiked = isLiked;

  try {
    let result;
    if (wasLiked) {
      result = await removePostLike(postId);
    } else {
      result = await addPostLike(postId);
    }

    // 좋아요 API 응답 데이터로 UI 업데이트 (조회수 증가 방지)
    if (result && result.postId !== undefined) {
      // API 응답에 데이터가 있는 경우 (좋아요 추가)
      isLiked = Boolean(result.isLiked);

      const likeCountElement = document.getElementById('likes-count');
      if (likeCountElement && result.likeCount !== undefined) {
        likeCountElement.textContent = formatCount(result.likeCount);
      }

      const likeBtn = document.getElementById('like-btn');
      if (likeBtn) {
        likeBtn.classList.toggle('liked', isLiked);
      }
    } else if (result === null && wasLiked) {
      // 좋아요 제거 시 응답이 null인 경우 수동 업데이트
      isLiked = false;

      const likeCountElement = document.getElementById('likes-count');
      if (likeCountElement) {
        const currentCount =
          parseInt(likeCountElement.textContent.replace(/,/g, '')) || 0;
        const newCount = Math.max(0, currentCount - 1);
        likeCountElement.textContent = formatCount(newCount);
      }

      const likeBtn = document.getElementById('like-btn');
      if (likeBtn) {
        likeBtn.classList.remove('liked');
      }
    }
  } catch (error) {
    logger.error('게시글 좋아요 토글 에러:', error);
    showToast(error.message || '좋아요 처리에 실패했습니다.', 'error');
  }
}

function handleDeletePost() {
  const postId = getPostIdFromUrl();
  if (!postId) return;

  openModal(
    '게시글 삭제',
    '정말로 이 게시글을 삭제하시겠습니까?',
    async () => {
      try {
        await deletePost(postId);
        showToast('게시글이 삭제되었습니다.', 'success');
        window.location.href = '/feed';
      } catch (error) {
        showToast(error.message || '게시글 삭제에 실패했습니다.', 'error');
      }
    },
    {
      confirmText: '삭제',
      cancelText: '취소',
      confirmColor: 'var(--color-danger)',
    }
  );
}

function showLoginRequiredModal() {
  openModal(
    '로그인 필요',
    '게시글을 보려면 로그인이 필요합니다.',
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
}

async function loadPost() {
  const postId = getPostIdFromUrl();

  // 유효하지 않은 postId는 404 콘텐츠 렌더링 (URL 유지)
  if (!postId) {
    render404Content();
    return;
  }

  try {
    const post = await getPost(postId);
    renderPost(post);
    await loadComments();
  } catch (error) {
    logger.error(
      '[post-detail] 게시글 로드 에러:',
      error,
      'status:',
      error.status
    );
    // 게시글 로드 실패 시 404 콘텐츠 렌더링 (URL 유지)
    render404Content();
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await renderPageLayout('layout-template');

  // 레이아웃 렌더링 후 로그인 상태 확인
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      // 메인 콘텐츠 숨기고 모달 표시
      const mainContent = document.getElementById('main-content');
      if (mainContent) mainContent.style.display = 'none';
      showLoginRequiredModal();
      return;
    }
  } catch {
    const mainContent = document.getElementById('main-content');
    if (mainContent) mainContent.style.display = 'none';
    showLoginRequiredModal();
    return;
  }

  await loadPost();

  // 이벤트 리스너 등록
  const likeBtn = document.getElementById('like-btn');
  const deletePostBtn = document.getElementById('delete-post-btn');
  const commentForm = document.getElementById('comment-form');
  const carouselPrev = document.getElementById('carousel-prev');
  const carouselNext = document.getElementById('carousel-next');

  if (likeBtn) {
    likeBtn.addEventListener('click', handleTogglePostLike);
  }

  if (deletePostBtn) {
    deletePostBtn.addEventListener('click', handleDeletePost);
  }

  if (commentForm) {
    commentForm.addEventListener('submit', handleSubmitComment);
  }

  // 댓글 textarea 자동 높이 조절
  const commentTextarea = document.getElementById('comment-textarea');
  if (commentTextarea) {
    commentTextarea.addEventListener('input', () => {
      commentTextarea.style.height = 'auto';
      commentTextarea.style.height =
        Math.min(commentTextarea.scrollHeight, 100) + 'px';
    });
  }

  // 캐러셀 이벤트
  if (carouselPrev) {
    carouselPrev.addEventListener('click', prevSlide);
  }

  if (carouselNext) {
    carouselNext.addEventListener('click', nextSlide);
  }

  // 캐러셀 드래그/스와이프 초기화
  initCarouselDrag();
});
