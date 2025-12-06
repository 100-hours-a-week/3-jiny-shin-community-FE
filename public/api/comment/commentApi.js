import { del, get, patch, post } from '../httpClient.js';

function assertPostId(postId) {
  if (postId === undefined || postId === null || postId === '') {
    throw new Error('게시글 ID가 필요합니다.');
  }
}

function assertCommentId(commentId) {
  if (commentId === undefined || commentId === null || commentId === '') {
    throw new Error('댓글 ID가 필요합니다.');
  }
}

function validateContents(contents) {
  if (typeof contents !== 'string' || contents.trim().length === 0) {
    throw new Error('댓글 내용을 입력해주세요.');
  }

  const length = contents.trim().length;
  if (length < 1 || length > 1000) {
    throw new Error('댓글은 1~1000자 사이로 입력해주세요.');
  }
}

/**
 * 댓글 작성
 */
export async function createComment(postId, { contents } = {}) {
  assertPostId(postId);
  validateContents(contents);

  const response = await post(`/posts/${postId}/comments`, {
    body: { contents: contents.trim() },
  });

  return response.data ?? null;
}

/**
 * 댓글 목록 (커서 기반)
 */
export async function getComments(
  postId,
  { cursor, sort = 'desc', limit = 10 } = {}
) {
  assertPostId(postId);

  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const safeSort = sort === 'asc' ? 'asc' : 'desc';

  const query = {
    sort: safeSort,
    limit: safeLimit,
  };

  if (cursor !== undefined && cursor !== null && cursor !== '') {
    query.cursor = cursor;
  }

  const response = await get(`/posts/${postId}/comments`, { query });
  return response.data ?? null;
}

/**
 * 댓글 수정 (작성자)
 */
export async function updateComment(commentId, { contents } = {}) {
  assertCommentId(commentId);
  validateContents(contents);

  const response = await patch(`/comments/${commentId}`, {
    body: { contents: contents.trim() },
  });

  return response.data ?? null;
}

/**
 * 댓글 삭제 (작성자)
 */
export async function deleteComment(commentId) {
  assertCommentId(commentId);
  const response = await del(`/comments/${commentId}`, { parseJson: true });
  return response.data ?? null;
}
