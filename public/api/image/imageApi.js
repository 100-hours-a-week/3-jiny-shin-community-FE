import { del, get, post } from '../httpClient.js';

const VALID_TYPES = new Set([
  'PROFILE',
  'POST_ORIGINAL',
  'POST_THUMBNAIL',
]);

export async function uploadImage({ file, type }) {
  if (!file) {
    throw new Error('업로드할 파일을 선택해주세요.');
  }

  if (!type || !VALID_TYPES.has(type)) {
    throw new Error('유효한 이미지 타입을 선택해주세요.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);

  const response = await post('/images', {
    body: formData,
  });

  return response.data ?? null;
}

export async function getImage(imageId) {
  if (imageId === undefined || imageId === null || imageId === '') {
    throw new Error('이미지 ID가 필요합니다.');
  }

  const response = await get(`/images/${imageId}`);
  return response.data ?? null;
}

export async function deleteImage(imageId) {
  if (imageId === undefined || imageId === null || imageId === '') {
    throw new Error('이미지 ID가 필요합니다.');
  }

  const response = await del(`/images/${imageId}`, { parseJson: true });
  return response.data ?? null;
}
