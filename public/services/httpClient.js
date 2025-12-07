import API_CONFIG from './api-config.js';

class ApiError extends Error {
  constructor(message, { status, data, errors, raw } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status ?? null;
    this.data = data ?? null;
    this.errors = errors ?? null;
    this.raw = raw ?? null;
  }
}

const ABSOLUTE_URL_REGEX = /^[a-z][a-z\d+\-.]*:\/\//i;
const PROTOCOL_RELATIVE_REGEX = /^\/\//;

function normalizeRequestPath(path) {
  if (path instanceof URL) {
    return { value: path.toString(), absolute: true };
  }

  if (path === undefined || path === null) {
    return { value: '', absolute: false };
  }

  const stringPath = String(path).trim();

  if (stringPath === '') {
    return { value: '', absolute: false };
  }

  if (
    ABSOLUTE_URL_REGEX.test(stringPath) ||
    PROTOCOL_RELATIVE_REGEX.test(stringPath)
  ) {
    return { value: stringPath, absolute: true };
  }

  return { value: stringPath.replace(/^\/+/, ''), absolute: false };
}

function buildUrl(path, query) {
  const { value, absolute } = normalizeRequestPath(path);

  let baseUrl = API_CONFIG.BASE_URL.endsWith('/')
    ? API_CONFIG.BASE_URL
    : `${API_CONFIG.BASE_URL}/`;

  // 상대 경로인 경우 현재 origin을 붙여서 절대 URL로 변환
  if (baseUrl.startsWith('/')) {
    baseUrl = window.location.origin + baseUrl;
  }

  const url = absolute ? new URL(value) : new URL(value, baseUrl);

  if (query && typeof query === 'object') {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      url.searchParams.append(key, String(value));
    });
  }

  return url.toString();
}

function mergeHeaders(customHeaders, isJsonBody) {
  const headers = new Headers(API_CONFIG.DEFAULT_HEADERS);

  if (customHeaders) {
    Object.entries(customHeaders).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      headers.set(key, value);
    });
  }

  if (isJsonBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json; charset=UTF-8');
  }

  return headers;
}

function shouldParseJson(response) {
  const status = response.status;

  if ([204, 205, 304].includes(status)) {
    const contentLength = response.headers.get('content-length');
    return Boolean(contentLength && Number(contentLength) > 0);
  }

  const contentType = response.headers.get('content-type') || '';
  const hasJsonContent = contentType.includes('application/json');

  if (hasJsonContent) {
    return true;
  }

  return false;
}

async function parseJsonResponse(response) {
  if (!shouldParseJson(response)) {
    return null;
  }

  try {
    return await response.json();
  } catch (error) {
    throw new ApiError('응답을 파싱하는 중 오류가 발생했습니다.', {
      status: response.status,
      raw: error,
    });
  }
}

function isJsonConvertibleBody(body) {
  if (body === undefined || body === null) {
    return false;
  }

  if (Array.isArray(body)) {
    return true;
  }

  const tag = Object.prototype.toString.call(body);
  return tag === '[object Object]';
}

async function baseRequest(path, options = {}) {
  const {
    method = 'GET',
    headers,
    body,
    query,
    timeout = API_CONFIG.TIMEOUT,
    withCredentials = true,
    parseJson = true,
    fetchOptions = {},
  } = options;

  const isFormData = body instanceof FormData;
  const isJsonBody =
    !isFormData &&
    !(body instanceof URLSearchParams) &&
    !(body instanceof Blob) &&
    !(body instanceof ArrayBuffer) &&
    !(
      typeof ReadableStream !== 'undefined' && body instanceof ReadableStream
    ) &&
    isJsonConvertibleBody(body);

  const requestInit = {
    method,
    credentials: withCredentials ? 'include' : 'same-origin',
    mode: 'cors',
    ...fetchOptions,
  };

  const controller = new AbortController();
  requestInit.signal = controller.signal;

  let timeoutId;
  if (timeout) {
    timeoutId = setTimeout(() => controller.abort(), timeout);
  }

  const requestHeaders = isFormData
    ? mergeHeaders(headers, false)
    : mergeHeaders(headers, isJsonBody);

  if (!(body instanceof FormData) && body !== undefined && body !== null) {
    if (isJsonBody) {
      requestInit.body = JSON.stringify(body);
    } else {
      requestInit.body = body;
    }
  } else if (body instanceof FormData) {
    requestInit.body = body;
  }

  if (requestHeaders.keys().next().done === false) {
    requestInit.headers = requestHeaders;
  }

  const requestUrl = buildUrl(path, query);

  let response;
  try {
    response = await fetch(requestUrl, requestInit);
  } catch (error) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (error.name === 'AbortError') {
      throw new ApiError('요청 시간이 초과되었습니다.', { status: null });
    }

    throw new ApiError('네트워크 오류가 발생했습니다.', { status: null });
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }

  const parsedBody = parseJson ? await parseJsonResponse(response) : null;

  if (response.redirected && response.url.includes('/auth/login')) {
    throw new ApiError('로그인이 필요합니다.', {
      status: 401,
    });
  }

  if (!response.ok) {
    const message =
      (parsedBody && typeof parsedBody === 'object' && parsedBody.message) ||
      `Request failed with status ${response.status}`;

    throw new ApiError(message, {
      status: response.status,
      data:
        parsedBody && typeof parsedBody === 'object'
          ? (parsedBody.data ?? null)
          : null,
      errors:
        parsedBody && typeof parsedBody === 'object'
          ? (parsedBody.errors ?? null)
          : null,
      raw: parsedBody,
    });
  }

  return {
    ok: response.ok,
    status: response.status,
    headers: response.headers,
    data:
      parsedBody && typeof parsedBody === 'object'
        ? (parsedBody.data ?? null)
        : parsedBody,
    message:
      parsedBody && typeof parsedBody === 'object'
        ? (parsedBody.message ?? null)
        : null,
    errors:
      parsedBody && typeof parsedBody === 'object'
        ? (parsedBody.errors ?? null)
        : null,
    raw: parsedBody,
  };
}

export async function get(path, options = {}) {
  return baseRequest(path, { ...options, method: 'GET' });
}

export async function post(path, options = {}) {
  return baseRequest(path, { ...options, method: 'POST' });
}

export async function patch(path, options = {}) {
  return baseRequest(path, { ...options, method: 'PATCH' });
}

export async function put(path, options = {}) {
  return baseRequest(path, { ...options, method: 'PUT' });
}

export async function del(path, options = {}) {
  return baseRequest(path, { ...options, method: 'DELETE' });
}

export { ApiError, baseRequest as request };
