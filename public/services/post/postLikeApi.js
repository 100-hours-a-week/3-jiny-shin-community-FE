import { del, post } from '../httpClient.js';

function assertPostId(postId) {
  if (postId === undefined || postId === null || postId === '') {
    throw new Error('게시글 ID가 필요합니다.');
  }
}

export async function addPostLike(postId) {
  assertPostId(postId);
  const response = await post(`/posts/${postId}/likes`);
  return response.data ?? null;
}

export async function removePostLike(postId) {
  assertPostId(postId);
  const response = await del(`/posts/${postId}/likes`, { parseJson: true });
  return response.data ?? null;
}
