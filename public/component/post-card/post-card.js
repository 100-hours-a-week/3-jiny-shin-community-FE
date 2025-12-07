import { formatCount, formatDate, truncateText, getImageUrl } from '../../../utils/format.js';
import { createAvatar } from '../avatar/avatar.js';
import { logger } from '../../../utils/logger.js';

/**
 * 게시글 카드 생성 함수 (컴팩트 레이아웃)
 * @param {Object} postData - 게시글 데이터
 * @param {string|number} postData.id - 게시글 ID
 * @param {string} postData.title - 게시글 제목
 * @param {string} postData.content - 게시글 내용
 * @param {string|Date} postData.createdAt - 작성일
 * @param {number} [postData.likeCount] - 좋아요 수
 * @param {number} [postData.commentCount] - 댓글 수
 * @param {boolean} [postData.isLiked] - 좋아요 여부
 * @param {Array} [postData.contentImageUrls] - 게시글 이미지 URL 배열
 * @param {Object} [postData.author] - 작성자 정보
 * @param {string} [postData.author.nickname] - 작성자 닉네임
 * @param {string} [postData.author.profileImageUrl] - 작성자 프로필 이미지
 * @returns {HTMLElement} 게시글 카드 엘리먼트
 */
export function createPostCard(postData) {
  const postId = postData.postId ?? postData.id;

  if (postId === undefined || postId === null) {
    logger.warn('게시글 ID가 없습니다:', postData);
    return null;
  }

  const article = document.createElement('article');
  article.className = 'post-card';
  article.dataset.postId = postId;
  article.tabIndex = 0;

  // 클릭 시 상세 페이지로 이동
  article.addEventListener('click', () => {
    window.location.href = `/post/${postId}`;
  });
  article.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      window.location.href = `/post/${postId}`;
    }
  });

  // === Content (좌측) ===
  const content = document.createElement('div');
  content.className = 'post-card__content';

  // Header (아바타 + 이름 + 날짜)
  const header = document.createElement('div');
  header.className = 'post-card__header';

  const avatarWrapper = document.createElement('div');
  avatarWrapper.className = 'post-card__avatar';
  const authorProfileUrl =
    postData.author?.profileImageUrl ||
    postData.author?.profileImage ||
    getImageUrl(postData.author?.profileImageUrls);
  const avatar = createAvatar({
    nickname: postData.author?.nickname || '익명',
    imageUrl: authorProfileUrl,
    size: 'md',
  });
  avatarWrapper.appendChild(avatar);

  // Meta (이름 + dot + 날짜)
  const meta = document.createElement('div');
  meta.className = 'post-card__meta';

  const authorName = document.createElement('span');
  authorName.className = 'post-card__author-name';
  authorName.textContent = postData.author?.nickname || '익명';

  const dot = document.createElement('span');
  dot.className = 'post-card__dot';
  dot.setAttribute('aria-hidden', 'true');

  const date = document.createElement('span');
  date.className = 'post-card__date';
  date.textContent = formatDate(postData.createdAt, true);

  meta.appendChild(authorName);
  meta.appendChild(dot);
  meta.appendChild(date);

  header.appendChild(avatarWrapper);
  header.appendChild(meta);

  // Title
  const title = document.createElement('h3');
  title.className = 'post-card__title';
  title.textContent = postData.title;

  // Excerpt (미리보기)
  const excerptText = truncateText(postData.content ?? '', 100);
  const excerpt = document.createElement('p');
  excerpt.className = 'post-card__excerpt';
  excerpt.textContent = excerptText || '';

  // Stats (좋아요, 댓글)
  const stats = document.createElement('div');
  stats.className = 'post-card__stats';

  const isLiked = postData.isLiked ?? false;
  const likeCount = postData.likeCount ?? postData.likesCount ?? 0;
  const commentCount = postData.commentCount ?? postData.commentsCount ?? 0;

  // 좋아요
  const likeStat = document.createElement('span');
  likeStat.className = `post-card__stat${isLiked ? ' post-card__stat--liked' : ''}`;
  likeStat.innerHTML = `<i data-lucide="heart" aria-hidden="true"></i><span class="sr-only">좋아요</span> ${formatCount(likeCount)}`;
  stats.appendChild(likeStat);

  // 댓글
  const commentStat = document.createElement('span');
  commentStat.className = 'post-card__stat';
  commentStat.innerHTML = `<i data-lucide="message-circle" aria-hidden="true"></i><span class="sr-only">댓글</span> ${formatCount(commentCount)}`;
  stats.appendChild(commentStat);

  // 조회수
  const viewCount = postData.viewCount ?? postData.viewsCount ?? 0;
  const viewStat = document.createElement('span');
  viewStat.className = 'post-card__stat';
  viewStat.innerHTML = `<i data-lucide="eye" aria-hidden="true"></i><span class="sr-only">조회</span> ${formatCount(viewCount)}`;
  stats.appendChild(viewStat);

  // Content 조합
  content.appendChild(header);
  content.appendChild(title);
  content.appendChild(excerpt);
  content.appendChild(stats);

  article.appendChild(content);

  // === Thumbnail (우측, 이미지 있을 때만) ===
  const imageUrl = getImageUrl(postData.thumbnailUrls);

  if (imageUrl) {
    const thumbnail = document.createElement('div');
    thumbnail.className = 'post-card__thumbnail';

    const thumbImg = document.createElement('img');
    thumbImg.src = imageUrl;
    thumbImg.alt = '';
    thumbnail.appendChild(thumbImg);

    // AI 뱃지 (추후 구현 시 사용)
    // if (postData.isAiGenerated) {
    //   const badge = document.createElement('span');
    //   badge.className = 'post-card__ai-badge';
    //   badge.textContent = 'AI';
    //   thumbnail.appendChild(badge);
    // }

    article.appendChild(thumbnail);
  }

  return article;
}

/**
 * 게시글 카드 목록 렌더링 함수
 * @param {HTMLElement} container - 게시글 카드를 렌더링할 컨테이너
 * @param {Array} posts - 게시글 데이터 배열
 */
export function renderPostCards(container, posts) {
  if (!container) {
    logger.error('Container element not found');
    return;
  }

  container.classList.add('posts-grid');
  container.innerHTML = '';

  if (!posts || posts.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'post-card post-card--empty';
    emptyMessage.innerHTML = `
      <i data-lucide="scroll" class="post-card__empty-icon"></i>
      <p class="post-card__empty-text">아직 기록이 없습니다. 첫 번째 이야기를 들려주세요!</p>
    `;
    container.appendChild(emptyMessage);

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
    return;
  }

  posts.forEach(post => {
    const postCard = createPostCard(post);
    if (postCard) {
      container.appendChild(postCard);
    }
  });

  // Lucide 아이콘 초기화
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}
