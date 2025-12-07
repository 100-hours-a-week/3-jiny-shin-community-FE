import { getPosts } from '../../../services/post/postApi.js';
import { renderPostCards } from '../../component/post-card/post-card.js';
import { renderPageLayout } from '../../../utils/layoutPage.js';
import { logger } from '../../../utils/logger.js';

// 게시글 목록 로드
async function loadPosts() {
  const postsList = document.getElementById('posts-list');
  if (!postsList) return;

  postsList.innerHTML = '';

  const placeholder = document.createElement('article');
  placeholder.className = 'post-card post-card--placeholder';
  placeholder.innerHTML =
    '<span class="post-card__loading-dot"></span> 게시글을 불러오는 중입니다...';
  postsList.appendChild(placeholder);

  try {
    const result = await getPosts({ limit: 12 });
    const posts = result?.posts ?? [];
    renderPostCards(postsList, posts);
  } catch (error) {
    logger.error('게시글 목록 로드 실패:', error);
    postsList.innerHTML =
      '<p class="empty-message">게시글을 불러오는 데 실패했습니다.</p>';
  }
}

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', async () => {
  await renderPageLayout('layout-template');
  loadPosts();
});
