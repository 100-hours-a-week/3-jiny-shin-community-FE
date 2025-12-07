/**
 * AI Proxy Router - Gemini API 프록시 엔드포인트
 *
 * 클라이언트에서 직접 Gemini API를 호출하지 않고 서버를 경유하여
 * API 키 노출을 방지합니다.
 */

const express = require('express');
const router = express.Router();

// Gemini API 설정
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODELS = {
  PROMPT_GENERATOR: 'gemini-2.5-flash',
  IMAGE_GENERATOR: 'gemini-2.5-flash-image',
};

/**
 * API 키 검증 미들웨어
 */
function validateApiKey(req, res, next) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'API 키가 설정되지 않았습니다.',
      code: 'API_KEY_NOT_CONFIGURED',
    });
  }
  req.geminiApiKey = apiKey;
  next();
}

/**
 * POST /api/ai/generate-prompt
 * 프로필 사진 + 본문 + 참조 이미지를 분석하여 이미지 생성 프롬프트 생성
 *
 * 요청:
 * - profileImageBase64: 프로필 사진 Base64
 * - postContent: 게시글 본문
 * - referenceImageBase64: 참조 이미지 Base64 (선택)
 * - options: 옵션 데이터 (style, location 등)
 *
 * 응답:
 * - AI가 생성한 이미지 프롬프트 (JSON)
 */
router.post('/generate-prompt', validateApiKey, async (req, res) => {
  try {
    const {
      profileImageBase64,
      profileImageMimeType,
      postContent,
      referenceImageBase64,
      referenceImageMimeType,
      options,
    } = req.body;

    if (!profileImageBase64) {
      return res.status(400).json({
        error: '프로필 이미지가 필요합니다.',
        code: 'PROFILE_IMAGE_REQUIRED',
      });
    }

    if (!postContent) {
      return res.status(400).json({
        error: '본문 내용이 필요합니다.',
        code: 'CONTENT_REQUIRED',
      });
    }

    // 시스템 프롬프트 생성 (참조 이미지 유무 전달)
    const hasReferenceImage = !!referenceImageBase64;
    const systemPrompt = buildSystemPrompt(postContent, options, hasReferenceImage);

    // 요청 본문 구성 (mimeType 기본값: image/jpeg)
    const parts = [
      {
        inlineData: {
          data: profileImageBase64,
          mimeType: profileImageMimeType || 'image/jpeg',
        },
      },
    ];

    // 참조 이미지가 있는 경우 추가
    if (referenceImageBase64) {
      parts.push({
        inlineData: {
          data: referenceImageBase64,
          mimeType: referenceImageMimeType || 'image/jpeg',
        },
      });
    }

    // 시스템 프롬프트 추가
    parts.push({ text: systemPrompt });

    const response = await fetch(
      `${GEMINI_ENDPOINT}/${MODELS.PROMPT_GENERATOR}:generateContent?key=${req.geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.9,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[AI Proxy] 프롬프트 생성 실패:', error);
      return res.status(response.status).json({
        error: error.error?.message || '프롬프트 생성에 실패했습니다.',
        code: 'PROMPT_GENERATION_FAILED',
      });
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      return res.status(500).json({
        error: '프롬프트 생성 결과가 없습니다.',
        code: 'NO_PROMPT_RESULT',
      });
    }

    res.json({
      success: true,
      prompt: generatedText,
      rawResponse: data,
    });
  } catch (error) {
    console.error('[AI Proxy] 프롬프트 생성 오류:', error);
    res.status(500).json({
      error: error.message || '서버 오류가 발생했습니다.',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /api/ai/generate-image
 * 프롬프트 + 프로필 사진 + 참조 이미지로 이미지 생성
 *
 * 요청:
 * - prompt: AI가 생성한 이미지 프롬프트
 * - profileImageBase64: 프로필 사진 Base64
 * - referenceImageBase64: 참조 이미지 Base64 (선택)
 *
 * 응답:
 * - 생성된 이미지 Base64
 *
 * 고정 옵션: aspect_ratio=1:1, resolution=1K
 */
router.post('/generate-image', validateApiKey, async (req, res) => {
  try {
    const {
      prompt,
      profileImageBase64,
      profileImageMimeType,
      referenceImageBase64,
      referenceImageMimeType,
    } = req.body;

    if (!prompt) {
      return res.status(400).json({
        error: '이미지 생성 프롬프트가 필요합니다.',
        code: 'PROMPT_REQUIRED',
      });
    }

    if (!profileImageBase64) {
      return res.status(400).json({
        error: '프로필 이미지가 필요합니다.',
        code: 'PROFILE_IMAGE_REQUIRED',
      });
    }

    // 요청 본문 구성 (mime_type 기본값: image/jpeg)
    const parts = [
      { text: prompt },
      {
        inline_data: {
          data: profileImageBase64,
          mime_type: profileImageMimeType || 'image/jpeg',
        },
      },
    ];

    // 참조 이미지가 있는 경우 추가
    if (referenceImageBase64) {
      parts.push({
        inline_data: {
          data: referenceImageBase64,
          mime_type: referenceImageMimeType || 'image/jpeg',
        },
      });
    }

    const requestBody = {
      contents: [{ parts }],
    };

    // 디버깅: 요청 본문 로깅 (base64 데이터는 길이만 표시)
    console.log('[AI Proxy] 이미지 생성 요청:', JSON.stringify({
      ...requestBody,
      contents: requestBody.contents.map(c => ({
        parts: c.parts.map(p =>
          p.inline_data
            ? { inline_data: { mime_type: p.inline_data.mime_type, data: `[${p.inline_data.data.length} chars]` } }
            : p
        )
      }))
    }, null, 2));

    const response = await fetch(
      `${GEMINI_ENDPOINT}/${MODELS.IMAGE_GENERATOR}:generateContent?key=${req.geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AI Proxy] 이미지 생성 실패 (raw):', errorText);
      let error = {};
      try {
        error = JSON.parse(errorText);
      } catch (e) {
        error = { error: { message: errorText } };
      }
      return res.status(response.status).json({
        error: error.error?.message || 'AI 이미지 생성에 실패했습니다.',
        code: 'IMAGE_GENERATION_FAILED',
      });
    }

    const data = await response.json();
    const candidates = data.candidates?.[0]?.content?.parts || [];

    // 이미지 데이터 찾기
    let imageData = null;
    for (const part of candidates) {
      if (part.inlineData) {
        imageData = {
          data: part.inlineData.data,
          mimeType: part.inlineData.mimeType || 'image/png',
        };
        break;
      }
    }

    if (!imageData) {
      return res.status(500).json({
        error: 'AI 이미지 생성 결과가 없습니다.',
        code: 'NO_IMAGE_RESULT',
      });
    }

    res.json({
      success: true,
      image: imageData,
    });
  } catch (error) {
    console.error('[AI Proxy] 이미지 생성 오류:', error);
    res.status(500).json({
      error: error.message || '서버 오류가 발생했습니다.',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * 시스템 프롬프트 생성
 * @param {string} content - 일기 본문 내용
 * @param {Object} options - 옵션 데이터 (style, location 등)
 * @returns {string} 시스템 프롬프트
 */
function buildSystemPrompt(content, options, hasReferenceImage = false) {
  // 옵션이 있으면 옵션 기반 프롬프트, 없으면 기본 프롬프트
  if (options) {
    return buildAdvancedSystemPrompt(content, options, hasReferenceImage);
  }
  return buildDefaultSystemPrompt(content, hasReferenceImage);
}

/**
 * 기본 시스템 프롬프트 생성
 * @param {string} content - 일기 본문 내용
 * @returns {string} 시스템 프롬프트
 */
function buildDefaultSystemPrompt(content, hasReferenceImage = false) {
  const imageOrderNote = hasReferenceImage
    ? `**IMAGE ORDER:**
- **1st image = User's avatar/profile photo** (MUST analyze this for person appearance)
- **2nd image = Reference image** (Use for scene/style inspiration only)
`
    : `**IMAGE ORDER:**
- **1st image = User's avatar/profile photo** (MUST analyze this for person appearance)
`;

  return `You are an expert AI photo director creating prompts for a diary/journal app called "anoo". Your mission is to generate a detailed, highly realistic image prompt from a user's avatar and their diary entry text.

${imageOrderNote}
**CRITICAL RULE: PERSON CONSISTENCY**
If the image requires a person, they **MUST** be a very close match to the user in the **1st image (avatar)**.
- **Analyze the avatar (1st image) first:** Identify gender, ethnicity, approximate age, hair style, and facial features.
- **Maintain these traits:** The generated person's ethnicity, age, gender, and general appearance must be consistent with the avatar.
- **NEVER use the reference image (2nd image) for person appearance.** Only use it for scene composition, lighting, or style inspiration.

**Step-by-Step Process:**
1. Analyze the **1st image (avatar)** to extract person characteristics.
2. Analyze the diary entry content provided below.
3. If a 2nd image (reference) exists, use it for scene/style inspiration only.
4. Decide if a person should be in the image based on the content.
5. Choose an appropriate photo style (candid, proof shot, POV, etc.)
6. Generate a detailed prompt for the image generator.

**Diary Entry:**
${content}

Generate a single, concise paragraph describing the image. Use photographic terms like "shot on iPhone," "candid," "natural lighting," etc.`;
}

/**
 * 고급 시스템 프롬프트 생성 (옵션 기반)
 * @param {string} content - 일기 본문 내용
 * @param {Object} options - 옵션 데이터
 * @returns {string} 시스템 프롬프트
 */
function buildAdvancedSystemPrompt(content, options, hasReferenceImage = false) {
  const optionsText = options ? JSON.stringify(options, null, 2) : '없음';

  const imageOrderNote = hasReferenceImage
    ? `## 이미지 순서 (중요!)
- **1번째 이미지 = 사용자 프로필 사진** (인물 외형 분석에 반드시 사용)
- **2번째 이미지 = 참조 이미지** (장면/스타일 참고용으로만 사용, 인물 외형에 사용 금지)
`
    : `## 이미지 순서 (중요!)
- **1번째 이미지 = 사용자 프로필 사진** (인물 외형 분석에 반드시 사용)
`;

  return `당신은 이미지 생성 프롬프트를 만드는 전문가입니다.
사용자의 프로필 사진, 게시글 본문, 참조 이미지(있는 경우)를 분석하여
이미지 생성에 필요한 프롬프트를 구성해야 합니다.

${imageOrderNote}
## Step 1: 프로필 사진 분석 (1번째 이미지 사용)
1. Subject Type 분류: Person/Character (사람, 동물, 캐릭터) 또는 Object (아이템, 제품)
2. Key Features 추출: 얼굴 특징, 헤어스타일, 체형, 눈에 띄는 특징 등

## Step 2: Style 매칭
프로필 사진의 분위기에 맞는 스타일을 선택하세요.
옵션에 적합한 스타일이 없으면 직접 정의하세요.

## Step 3: Scene 속성 매핑 (참조 이미지 + 본문 기반)
다음 속성들을 매핑하세요:
- Location
- Lighting
- Action
- Clothing (Person인 경우만)
- Expression (Person인 경우만)

## Step 4: 나머지 속성 자동 결정
앞서 결정된 속성들과 조화롭게:
- Camera/Composition
- Pose

## Step 5: 최종 프롬프트 조합
모든 속성을 조합하여 영어로 이미지 생성 프롬프트를 출력하세요.

**사용 가능한 옵션:**
${optionsText}

**게시글 본문:**
${content}

응답 형식 (JSON):
{
  "subjectType": "Person" | "Object",
  "keyFeatures": "...",
  "style": { "name": "...", "description": "..." },
  "location": { "name": "...", "description": "..." },
  "lighting": { "name": "...", "description": "..." },
  "action": { "name": "...", "description": "..." },
  "clothing": { "name": "...", "description": "..." },
  "expression": { "name": "...", "description": "..." },
  "cameraComposition": { "name": "...", "description": "..." },
  "pose": { "name": "...", "description": "..." },
  "finalPrompt": "..."
}`;
}

module.exports = router;