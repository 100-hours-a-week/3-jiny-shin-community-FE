import { del, get, patch, post } from '../httpClient.js';

function validateTitle(title) {
  if (typeof title !== 'string' || title.trim().length === 0) {
    throw new Error('제목을 입력해주세요.');
  }

  if (title.trim().length < 2 || title.trim().length > 26) {
    throw new Error('제목은 2~26자 사이로 입력해주세요.');
  }
}

function validateContent(content) {
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('본문 내용을 입력해주세요.');
  }

  const length = content.trim().length;
  if (length < 2 || length > 10000) {
    throw new Error('본문은 2~10000자 사이로 입력해주세요.');
  }
}

function normalizeImageIds(imageIds, { defaultValue } = {}) {
  if (imageIds === undefined || imageIds === null) {
    return defaultValue;
  }

  if (!Array.isArray(imageIds)) {
    throw new Error('imageIds는 배열이어야 합니다.');
  }

  return imageIds.map((id) => Number(id)).filter((id) => !Number.isNaN(id));
}

/**
 * 게시글 작성
 */
export async function createPost({ title, content, imageIds } = {}) {
  validateTitle(title);
  validateContent(content);

  const normalizedImageIds = normalizeImageIds(imageIds, { defaultValue: [] });

  const response = await post('/posts', {
    body: {
      title: title.trim(),
      content: content.trim(),
      imageIds: normalizedImageIds,
    },
  });

  return response.data ?? null;
}

/**
 * 게시글 목록 조회 (커서 기반 페이지네이션)
 */
export async function getPosts({ cursor, sort = 'desc', limit = 10 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const safeSort = sort === 'asc' ? 'asc' : 'desc';

  const query = {
    sort: safeSort,
    limit: safeLimit,
  };

  if (cursor !== undefined && cursor !== null && cursor !== '') {
    query.cursor = cursor;
  }

  const response = await get('/posts', { query });
  return response.data ?? null;
}

/**
 * 게시글 상세 조회
 */
export async function getPost(postId) {
  if (postId === undefined || postId === null || postId === '') {
    throw new Error('게시글 ID가 필요합니다.');
  }

  const response = await get(`/posts/${postId}`);
  return response.data ?? null;
}

/**
 * 게시글 수정 (작성자)
 */
export async function updatePost(postId, { title, content, imageIds } = {}) {
  if (postId === undefined || postId === null || postId === '') {
    throw new Error('게시글 ID가 필요합니다.');
  }

  const payload = {};

  if (title !== undefined) {
    validateTitle(title);
    payload.title = title.trim();
  }

  if (content !== undefined) {
    validateContent(content);
    payload.content = content.trim();
  }

  if (imageIds !== undefined) {
    payload.imageIds = normalizeImageIds(imageIds, { defaultValue: [] });
  }

  if (Object.keys(payload).length === 0) {
    throw new Error('수정할 항목을 최소 1개 이상 입력해주세요.');
  }

  const response = await patch(`/posts/${postId}`, { body: payload });
  return response.data ?? null;
}

/**
 * 게시글 삭제 (작성자)
 */
export async function deletePost(postId) {
  if (postId === undefined || postId === null || postId === '') {
    throw new Error('게시글 ID가 필요합니다.');
  }

  const response = await del(`/posts/${postId}`, { parseJson: true });
  return response.data ?? null;
}
