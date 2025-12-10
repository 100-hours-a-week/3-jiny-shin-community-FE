import { post } from '../httpClient.js';

/**
 * 피드백 제출
 * @param {Object} feedbackData - 피드백 데이터
 * @param {string} feedbackData.content - 피드백 내용
 * @param {string} feedbackData.appVersion - 앱 버전
 * @param {string} feedbackData.platform - 플랫폼 (iOS, Android, Web 등)
 * @param {string} feedbackData.createdAt - 생성 시각 (ISO 8601)
 * @returns {Promise<Object>} - 응답 객체
 */
export async function submitFeedback(feedbackData) {
  const response = await post('feedback', {
    body: feedbackData,
  });

  return response.data;
}
