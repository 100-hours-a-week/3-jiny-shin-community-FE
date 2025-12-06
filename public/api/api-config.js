// API 기본 설정
const getBaseUrl = () => {
  // 브라우저 환경이 아닌 경우 (예: 테스트 환경)
  if (typeof window === 'undefined') {
    return 'http://localhost:8080';
  }

  const hostname = window.location.hostname;

  // 프로덕션 환경 (배포된 도메인)
  if (hostname === 'jinyshin.cloud' || hostname.endsWith('.jinyshin.cloud')) {
    return 'https://jinyshin.cloud/api';
  }

  // 로컬 개발 환경
  return 'http://localhost:8080';
};

const API_CONFIG = {
  BASE_URL: getBaseUrl(),
  TIMEOUT: 10000,
  DEFAULT_HEADERS: {
    Accept: 'application/json',
  },
};

export default API_CONFIG;
