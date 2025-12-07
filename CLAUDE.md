# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**anoo** - 익명 기록 커뮤니티 서비스

> "Be Anonymous, Own Your Story."
> 익명으로 솔직하게 하루를 기록하고, 다른 사람들의 이야기를 가볍게 구경하는 공간.

**핵심 가치:** Authenticity(진정성), Ownership(나다움), Anonymity(익명), Narratives(서사)

**기술 특징:**
- Vanilla JS + ES Modules (프레임워크 없음)
- Express 서버 (Clean URL 라우팅, Gemini AI 프록시)
- Spring Boot 백엔드 REST API
- AI 이미지 생성 (프로필 사진 + 글 기반)

기획서: `docs/Design/anoo-service-plan.md`

## Development Commands

```bash
npm start              # Express 서버 (AI 프록시 포함) - 일반적으로 사용
npm run dev            # live-server (정적 파일만, AI 기능 불가)

npm run lint           # ESLint 검사
npm run lint:fix       # ESLint 자동 수정
npm run format         # Prettier 포맷팅
npm run format:check   # Prettier 검사
```

**포트:** 3000 (프론트엔드), 8080 (백엔드 API)

> AI 이미지 생성 기능 테스트 시 반드시 `npm start` 사용 (Gemini API 프록시 필요)

## Environment Variables

`.env` 파일 설정 (`.env.example` 참조):

```bash
GEMINI_API_KEY=your_api_key          # AI 이미지 생성용
API_BASE_URL=http://localhost:8080/api/
IMAGE_UPLOAD_API=https://xxx.execute-api.region.amazonaws.com/api/images
```

클라이언트는 `/config` 엔드포인트에서 설정을 가져옴 (`api-config.js`의 `getImageUploadApi()` 등).

## Architecture

### Express 서버 (`app.js`)

Clean URL 라우팅 + API 프록시:
- `/login`, `/signup`, `/feed`, `/post/:id`, `/profile` 등 → HTML 페이지 서빙
- `/api/ai/*` → Gemini AI 프록시 (`routes/ai.js`)
- `/api/image-proxy` → S3 이미지 CORS 우회
- `/config` → 클라이언트에 환경변수 전달 (API_BASE_URL, IMAGE_UPLOAD_API)

### API 클라이언트 구조

`public/services/` 도메인별 분리:
- `httpClient.js`: fetch 래퍼 (get, post, patch, del)
- `api-config.js`: 환경변수에서 BASE_URL, IMAGE_UPLOAD_API 로드
- 도메인별: `authApi.js`, `userApi.js`, `postApi.js`, `commentApi.js`, `imageApi.js`, `aiApi.js`

### 이미지 업로드 플로우

1. `uploadImageToS3()` → AWS Lambda (S3 직접 업로드)
2. `saveImageMetadata()` → WAS에 메타데이터 저장
3. `uploadImageComplete()` → 위 두 단계를 합친 함수

### AI 이미지 생성 플로우 (`routes/ai.js`)

1. `POST /api/ai/generate-prompt` - 프로필 사진 + 일기 본문 → 이미지 생성 프롬프트 (Gemini 2.5 Flash)
2. `POST /api/ai/generate-image` - 프롬프트 + 프로필 사진 → 생성된 이미지 (Gemini 2.5 Flash Image)

프로필 사진은 **1번째 이미지**로 항상 전달되어 인물 외형 분석에 사용됨.

## Code Patterns

### 동적 컴포넌트 로딩 (layout.js)

```javascript
export async function loadHeader() {
  const container = document.getElementById('header-container');
  const response = await fetch('/component/header/header.html');
  container.innerHTML = await response.text();
  const { initHeaderEvents } = await import('/component/header/header.js');
  initHeaderEvents();
}

export async function loadLayout() {
  await Promise.all([loadHeader(), loadBottomNav(), loadModal()]);
}
```

### XSS 방지

```javascript
// BAD: element.innerHTML = userInput;
// GOOD: element.textContent = userInput;
```

### 모달 사용법 (`utils/layout.js`)

```javascript
import { openModal } from '/utils/layout.js';

openModal('삭제 확인', '정말 삭제하시겠습니까?', () => handleDelete(), {
  confirmText: '삭제',
  confirmVariant: 'danger'  // 'primary' | 'danger' | 'outline'
});
```

모달은 `cleanupModalHandlers()`로 기존 리스너를 정리하여 메모리 누수 방지.

### 토스트 메시지 (`utils/layout.js`)

```javascript
import { showToast } from '/utils/layout.js';

showToast('저장되었습니다', 'success');  // 'success' | 'error' | 'warning' | 'info'
```

## Naming Conventions

- **CSS**: BEM 패턴 (`.post-card__header`, `.btn--primary`, `.btn--danger`)
- **JS 함수**: camelCase (`createComment`, `validateEmail`)
- **JS 상수**: UPPER_SNAKE_CASE (`API_CONFIG`)

## API Reference

백엔드 API 스펙: `docs/Api/api-spec.json` (OpenAPI 3.1.0)

주요 엔드포인트:
- 인증: `POST /api/auth/login`, `/api/auth/logout`
- 게시글: `GET/POST /api/posts`, `GET/DELETE/PATCH /api/posts/{postId}`
- 댓글: `GET/POST /api/posts/{postId}/comments`
- 좋아요: `POST/DELETE /api/posts/{postId}/likes`
- 사용자: `GET/PATCH/DELETE /api/users/me`
- 이미지: `POST /api/images/metadata`

## Git Conventions

**커밋 전 사용자 확인 필수** (git add, commit, push, merge 등)

Conventional Commits:
- `feat:` 새 기능
- `fix:` 버그 수정
- `refactor:` 리팩토링
- `chore:` 설정/의존성
- `docs:` 문서
- `style:` 코드 스타일
- `remove:` 코드 제거
