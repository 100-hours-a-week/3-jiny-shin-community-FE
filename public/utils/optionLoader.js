/**
 * AI 옵션 파일 로더 유틸리티
 *
 * JSON 옵션 파일들을 로드하고 캐싱합니다.
 * 옵션 파일 경로: /data/ai-options/*.json
 */

const optionCache = {};
const OPTION_BASE_PATH = '/data/ai-options';

/**
 * 단일 옵션 파일 로드 (캐싱 적용)
 * @param {string} optionName - 옵션 파일 이름 (확장자 제외)
 * @returns {Promise<Object>} - 옵션 데이터
 */
async function loadOption(optionName) {
  if (optionCache[optionName]) {
    return optionCache[optionName];
  }

  const response = await fetch(`${OPTION_BASE_PATH}/${optionName}.json`);

  if (!response.ok) {
    throw new Error(`옵션 파일 로드 실패: ${optionName}`);
  }

  const data = await response.json();
  optionCache[optionName] = data;
  return data;
}

/**
 * 모든 AI 옵션 파일 로드
 * @returns {Promise<Object>} - 모든 옵션 데이터
 */
export async function loadAllOptions() {
  const optionNames = [
    'style',
    'location',
    'lighting',
    'action',
    'clothing',
    'expression',
    'camera_and_composition',
    'pose',
  ];

  const results = await Promise.all(optionNames.map(loadOption));

  return optionNames.reduce((acc, name, index) => {
    acc[name] = results[index];
    return acc;
  }, {});
}