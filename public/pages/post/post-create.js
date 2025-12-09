import { openModal, closeModal, showToast } from '../../../utils/layout.js';
import { createPost } from '../../../services/post/postApi.js';
import {
  uploadImageToS3,
  saveImageMetadata,
  fetchImageAsBase64,
  fileToBase64,
  generateAndUploadAiImage,
  checkAiGenerationLimit,
  getAiGenerationRemaining,
} from '../../../services/image/imageApi.js';
import { getCurrentUser } from '../../../services/user/userApi.js';
import { renderPageLayout } from '../../../utils/layoutPage.js';
import { getImageUrl } from '../../../utils/format.js';
import { logger } from '../../../utils/logger.js';

// 이미지 관련 상수
const MAX_IMAGES_MANUAL = 4; // 직접 업로드 모드 최대 이미지
const MAX_IMAGES_AI = 1; // AI 모드 최대 참조 이미지
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
const IMAGE_EXPIRY_MS = 60 * 60 * 1000; // 1시간

// 이미지 모드 상태 ('manual' | 'ai')
let imageMode = 'manual';

// 사용자 상태
let currentUser = null;

// localStorage 키
const DRAFT_STORAGE_KEY = 'anoo_post_draft';
const DRAFT_SAVE_DELAY = 1000;

let draftSaveTimer = null;
let hasUnsavedChanges = false;

// 직접 업로드 모드 이미지 상태
// { imageId, storedFilename, previewUrl, uploadedAt, isUploading }
let uploadedImages = [];
let primaryImageIndex = 0; // 대표 이미지 인덱스 (기본값: 첫 번째)
let draggedIndex = null;
let isDragging = false; // 드래그 중 재렌더링 방지 플래그

// AI 모드 상태
let aiReferenceImage = null; // { imageId, previewUrl, base64Data }
let aiGeneratedImage = null; // { imageId, previewUrl }
let isAiGenerating = false;

/**
 * 저장되지 않은 이미지가 있는지 확인
 * @returns {boolean} 직접 업로드 또는 AI 모드에 이미지가 있으면 true
 */
function hasUnsavedImages() {
  return (
    uploadedImages.length > 0 || aiReferenceImage !== null || aiGeneratedImage !== null
  );
}

// 업로드 중인 Promise 추적
let pendingUploads = [];

// ============ 임시 저장 ============

function saveDraft() {
  const titleInput = document.getElementById('post-title');
  const contentInput = document.getElementById('post-content');

  const title = titleInput?.value || '';
  const content = contentInput?.value || '';

  if (!title && !content) {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    hasUnsavedChanges = false;
    return;
  }

  const draft = {
    title,
    content,
    savedAt: new Date().toISOString(),
  };

  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  hasUnsavedChanges = true;
}

function scheduleDraftSave() {
  if (draftSaveTimer) {
    clearTimeout(draftSaveTimer);
  }
  draftSaveTimer = setTimeout(saveDraft, DRAFT_SAVE_DELAY);
}

function loadDraft() {
  try {
    const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!saved) return null;
    return JSON.parse(saved);
  } catch {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    return null;
  }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_STORAGE_KEY);
  hasUnsavedChanges = false;
}

function restoreDraft(draft) {
  const titleInput = document.getElementById('post-title');
  const contentInput = document.getElementById('post-content');

  if (draft.title) {
    titleInput.value = draft.title;
    document.getElementById('title-char-count').textContent =
      `${draft.title.length}/26`;
  }

  if (draft.content) {
    contentInput.value = draft.content;
    const charCountEl = document.getElementById('content-char-count');
    if (charCountEl) {
      charCountEl.textContent = `${draft.content.length.toLocaleString()}/10,000`;
    }
  }

  hasUnsavedChanges = true;
}

function getTimeAgo(date) {
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;

  return date.toLocaleDateString('ko-KR');
}

// ============ 유효성 검사 ============

function validateTitle() {
  const titleInput = document.getElementById('post-title');
  const titleError = document.getElementById('title-error');
  const title = titleInput.value.trim();

  if (!title || title.length < 2) {
    titleInput.classList.add('error');
    titleError.textContent = '제목은 2자 이상 입력해주세요.';
    return false;
  }

  if (title.length > 26) {
    titleInput.classList.add('error');
    titleError.textContent = '제목은 최대 26자까지 입력할 수 있습니다.';
    return false;
  }

  titleInput.classList.remove('error');
  titleError.textContent = '';
  return true;
}

function validateContent() {
  const contentInput = document.getElementById('post-content');
  const contentError = document.getElementById('content-error');
  const content = contentInput.value.trim();

  if (!content || content.length < 2) {
    contentInput.classList.add('error');
    contentError.textContent = '본문은 2자 이상 입력해주세요.';
    return false;
  }

  if (content.length > 10000) {
    contentInput.classList.add('error');
    contentError.textContent = '본문은 10,000자 이하로 입력해주세요.';
    return false;
  }

  contentInput.classList.remove('error');
  contentError.textContent = '';
  return true;
}

function validateImageFile(file) {
  const fileExtension = file.name.split('.').pop().toLowerCase();

  if (
    !ALLOWED_TYPES.includes(file.type) &&
    !ALLOWED_EXTENSIONS.includes(fileExtension)
  ) {
    return {
      valid: false,
      message: 'jpg, jpeg, png, webp 형식의 이미지만 업로드할 수 있습니다.',
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      message: '이미지 파일은 최대 5MB까지 업로드할 수 있습니다.',
    };
  }

  return { valid: true };
}

// ============ 이미지 프리뷰 렌더링 ============

function renderImagePreviews(force = false) {
  // 드래그 중에는 재렌더링 방지 (force가 아닌 경우)
  if (isDragging && !force) {
    return;
  }

  const container = document.getElementById('image-preview-container');
  const imageCount = document.getElementById('image-count');
  const helpText = document.getElementById('image-help-text');

  if (!container) return;

  container.innerHTML = '';

  if (uploadedImages.length === 0) {
    if (imageCount) imageCount.textContent = '';
    if (helpText) helpText.style.display = 'none';
    return;
  }

  if (imageCount)
    imageCount.textContent = `${uploadedImages.length}/${getMaxImages()}`;
  if (helpText) helpText.style.display = 'block';

  // UI상 대표 이미지: primaryImageIndex 기반 (기본값 0)
  // 인덱스가 범위를 벗어나면 0으로 리셋
  const effectivePrimaryIndex =
    primaryImageIndex >= 0 && primaryImageIndex < uploadedImages.length
      ? primaryImageIndex
      : 0;

  uploadedImages.forEach((imageData, index) => {
    const item = document.createElement('div');
    const isPrimary = index === effectivePrimaryIndex;
    item.className = `image-preview-item${isPrimary ? ' primary' : ''}`;
    item.draggable = true;
    item.dataset.index = index;

    // 대표 이미지 뱃지
    if (isPrimary) {
      const badge = document.createElement('span');
      badge.className = 'image-preview-item__badge';
      badge.textContent = '대표';
      item.appendChild(badge);
    }

    // 이미지
    const img = document.createElement('img');
    img.src = imageData.previewUrl;
    img.alt = `이미지 ${index + 1}`;
    img.draggable = false; // 이미지 자체 드래그 방지
    item.appendChild(img);

    // 대표 선택 버튼 (대표 아닌 경우에만 표시)
    if (!isPrimary) {
      const primaryBtn = document.createElement('button');
      primaryBtn.type = 'button';
      primaryBtn.className = 'image-preview-item__primary-btn';
      primaryBtn.textContent = '대표';
      primaryBtn.draggable = false; // 버튼 드래그 방지
      primaryBtn.addEventListener('click', e => {
        e.stopPropagation();
        e.preventDefault();
        setPrimaryImageByIndex(index);
      });
      item.appendChild(primaryBtn);
    }

    // 삭제 버튼
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'image-preview-item__remove';
    removeBtn.draggable = false; // 버튼 드래그 방지
    removeBtn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    removeBtn.addEventListener('click', e => {
      e.stopPropagation();
      e.preventDefault();
      removeImage(index);
    });
    item.appendChild(removeBtn);

    container.appendChild(item);
  });
}

// ============ 프로필 사진 확인 ============

// 백엔드 응답 필드명이 다를 수 있으므로 여러 필드 체크
function getProfileImageUrl(user) {
  if (!user) return null;
  // 문자열 형태 우선, 객체 형태는 getImageUrl로 처리
  return (
    user.profileImageUrl ||
    user.profileImage ||
    getImageUrl(user.profileImageUrls)
  );
}

function hasProfileImage() {
  // currentUser가 없으면 false
  if (!currentUser) {
    logger.debug('[프로필 체크] currentUser 없음');
    return false;
  }

  const profileUrl = getProfileImageUrl(currentUser);

  // URL이 없거나 빈 문자열이면 false
  if (!profileUrl || profileUrl.trim() === '') {
    logger.debug('[프로필 체크] 프로필 이미지 없음, currentUser:', currentUser);
    return false;
  }

  // 기본 아바타 URL 패턴 체크 (필요 시 조정)
  const defaultAvatarPatterns = [
    '/assets/icon/profile_default',
    'default_avatar',
    'default-avatar',
    'placeholder',
  ];
  const isDefault = defaultAvatarPatterns.some(pattern =>
    profileUrl.toLowerCase().includes(pattern.toLowerCase())
  );
  logger.debug('[프로필 체크] URL:', profileUrl, '기본아바타:', isDefault);
  return !isDefault;
}

function canUseAiMode() {
  return hasProfileImage();
}

// ============ AI 생성 횟수 관리 ============

/**
 * AI 생성 남은 횟수 조회 및 UI 갱신
 */
async function updateAiRemainingCount() {
  try {
    const { remaining } = await getAiGenerationRemaining();

    const countEl = document.getElementById('ai-remaining-count');
    const infoEl = document.getElementById('ai-generation-info');
    const generateBtn = document.getElementById('ai-generate-btn');
    const regenerateBtn = document.getElementById('ai-regenerate-btn');
    const referenceInput = document.getElementById('ai-reference-input');
    const referenceDropzone = document.getElementById('ai-reference-dropzone');

    if (countEl) countEl.textContent = remaining;

    // 횟수 0이면 스타일 변경 및 버튼 비활성화
    const isExhausted = remaining <= 0;

    if (infoEl) {
      infoEl.classList.toggle('exhausted', isExhausted);
    }

    if (generateBtn) {
      generateBtn.disabled = isExhausted;
    }
    if (regenerateBtn) {
      regenerateBtn.disabled = isExhausted;
    }

    // 참조 이미지 업로드 영역도 비활성화
    if (referenceInput) {
      referenceInput.disabled = isExhausted;
    }
    if (referenceDropzone) {
      referenceDropzone.classList.toggle('disabled', isExhausted);
    }

    return remaining;
  } catch (error) {
    logger.error('[AI 횟수] 조회 실패:', error);
    return 0;
  }
}

// ============ 탭 전환 ============

function initTabs() {
  const tabManual = document.getElementById('tab-manual');
  const tabAi = document.getElementById('tab-ai');

  tabManual?.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    handleTabChange('manual');
  });

  tabAi?.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    handleTabChange('ai');
  });

  // 프로필 사진 상태에 따라 AI 탭 상태 업데이트
  updateAiTabAvailability();
}

/**
 * 프로필 사진 유무에 따라 AI 탭 가용성 업데이트
 */
function updateAiTabAvailability() {
  const tabAi = document.getElementById('tab-ai');
  const generateBtn = document.getElementById('ai-generate-btn');
  const referenceInput = document.getElementById('ai-reference-input');
  const referenceDropzone = document.getElementById('ai-reference-dropzone');

  const canUse = canUseAiMode();

  if (tabAi) {
    tabAi.classList.toggle('unavailable', !canUse);
  }

  // AI 모드 내부 버튼들도 비활성화
  if (!canUse) {
    if (generateBtn) generateBtn.disabled = true;
    if (referenceInput) referenceInput.disabled = true;
    if (referenceDropzone) referenceDropzone.classList.add('disabled');
  }
}

function handleTabChange(newMode) {
  if (newMode === imageMode) return;

  // AI 모드로 전환 시 프로필 사진 확인 (currentUser 로드 여부도 체크)
  if (newMode === 'ai') {
    if (!currentUser || !canUseAiMode()) {
      showToast('AI 기능은 프로필 사진 등록 후 이용 가능합니다.', 'info');
      logger.debug('[탭 전환] AI 모드 전환 차단 - currentUser:', currentUser, 'canUseAiMode:', canUseAiMode());
      return;
    }
  }

  // 현재 모드에 이미지가 있는지 확인
  const hasImages =
    (imageMode === 'manual' && uploadedImages.length > 0) ||
    (imageMode === 'ai' && (aiReferenceImage || aiGeneratedImage));

  if (hasImages) {
    let modalMessage = '';
    let useHtml = false;

    if (imageMode === 'ai' && newMode === 'manual') {
      // AI → 직접 업로드: 횟수 복원 안됨 안내 (Lucide 아이콘 사용)
      modalMessage = `직접 업로드 탭으로 전환하면 생성된 AI 이미지가 삭제됩니다.<br><br><span style="display:inline-flex;align-items:center;gap:4px;color:var(--color-danger);"><i data-lucide="alert-triangle" style="width:16px;height:16px;"></i> 이미 사용된 AI 생성 횟수는 복원되지 않습니다.</span>`;
      useHtml = true;
    } else {
      // 직접 업로드 → AI
      modalMessage = 'AI로 그리기 탭으로 전환하면 현재 이미지가 삭제됩니다.';
    }

    openModal(
      '탭 전환',
      modalMessage,
      () => {
        closeModal();
        clearCurrentModeImages();
        switchTab(newMode);
      },
      {
        confirmText: '전환하기',
        cancelText: '취소',
        useHtml,
      }
    );
  } else {
    switchTab(newMode);
  }
}

function clearCurrentModeImages() {
  if (imageMode === 'manual') {
    clearAllManualImages();
    renderImagePreviews(); // UI 갱신
  } else {
    clearAllAiImages();
    renderAiReferencePreview(); // UI 갱신
    renderAiResultPreview(); // UI 갱신
  }
}

function clearAllManualImages() {
  uploadedImages.forEach(img => {
    if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
  });
  uploadedImages = [];
  primaryImageIndex = 0;
}

function clearAllAiImages() {
  if (aiReferenceImage?.previewUrl) {
    URL.revokeObjectURL(aiReferenceImage.previewUrl);
  }
  aiReferenceImage = null;
  aiGeneratedImage = null;
}

function switchTab(newMode) {
  imageMode = newMode;

  // 탭 버튼 상태 업데이트
  const tabManual = document.getElementById('tab-manual');
  const tabAi = document.getElementById('tab-ai');
  const panelManual = document.getElementById('panel-manual');
  const panelAi = document.getElementById('panel-ai');

  tabManual?.classList.toggle('active', newMode === 'manual');
  tabManual?.setAttribute('aria-selected', newMode === 'manual');
  tabAi?.classList.toggle('active', newMode === 'ai');
  tabAi?.setAttribute('aria-selected', newMode === 'ai');

  // 패널 표시/숨김
  if (panelManual) {
    panelManual.classList.toggle('active', newMode === 'manual');
    panelManual.hidden = newMode !== 'manual';
  }
  if (panelAi) {
    panelAi.classList.toggle('active', newMode === 'ai');
    panelAi.hidden = newMode !== 'ai';
  }

  // Lucide 아이콘 재렌더링
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// ============ 이미지 모드 관리 (공통) ============

function getMaxImages() {
  return imageMode === 'ai' ? MAX_IMAGES_AI : MAX_IMAGES_MANUAL;
}

// ============ 이미지 관리 ============

async function addImages(files) {
  const fileArray = Array.from(files);
  const maxImages = getMaxImages();
  const remainingSlots = maxImages - uploadedImages.length;

  if (remainingSlots <= 0) {
    const modeText = imageMode === 'ai' ? '참조 이미지는' : '이미지는';
    showToast(`${modeText} 최대 ${maxImages}장까지 업로드할 수 있습니다.`);
    return;
  }

  const filesToAdd = fileArray.slice(0, remainingSlots);

  if (fileArray.length > remainingSlots) {
    const modeText = imageMode === 'ai' ? '참조 이미지는' : '이미지는';
    showToast(
      `${modeText} 최대 ${maxImages}장까지 업로드할 수 있습니다. ${remainingSlots}장만 추가됩니다.`
    );
  }

  // 1단계: 모든 파일의 프리뷰를 먼저 즉시 표시
  const imagesToUpload = [];

  for (const file of filesToAdd) {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      showToast(`${file.name}: ${validation.message}`, 'error');
      continue;
    }

    // 프리뷰 URL 생성 및 즉시 추가
    const previewUrl = URL.createObjectURL(file);
    const tempImage = {
      previewUrl,
      isUploading: true,
      imageId: null,
      storedFilename: null,
      uploadedAt: null,
    };
    uploadedImages.push(tempImage);
    imagesToUpload.push({ file, tempImage, previewUrl });
  }

  // 프리뷰 즉시 렌더링 (업로드 전에 화면에 표시)
  renderImagePreviews();

  // 2단계: 백그라운드에서 각 이미지 업로드 (병렬 처리)
  const uploadPromises = imagesToUpload.map(
    async ({ file, tempImage, previewUrl }) => {
      try {
        // Lambda 업로드
        logger.debug('[이미지 업로드] Lambda 업로드 시작:', file.name);
        const s3Result = await uploadImageToS3({ file, imageType: 'POST' });
        logger.debug('[이미지 업로드] Lambda 응답:', s3Result);

        // Metadata 저장
        logger.debug('[이미지 업로드] Metadata 저장 시작');
        const metadataResult = await saveImageMetadata(s3Result);
        logger.debug('[이미지 업로드] Metadata 응답:', metadataResult);

        // 응답 검증
        if (!metadataResult || !metadataResult.imageId) {
          throw new Error('이미지 메타데이터 응답에 imageId가 없습니다.');
        }

        // 상태 업데이트
        tempImage.imageId = metadataResult.imageId;
        tempImage.storedFilename = s3Result.storedFilename;
        tempImage.uploadedAt = new Date();
        tempImage.isUploading = false;
        logger.debug('[이미지 업로드] 성공 - imageId:', tempImage.imageId);

        // 개별 업로드 완료 시 렌더링 갱신
        renderImagePreviews();
      } catch (error) {
        logger.error('[이미지 업로드] 실패:', error);
        // 실패 시 제거
        const idx = uploadedImages.indexOf(tempImage);
        if (idx > -1) {
          uploadedImages.splice(idx, 1);
        }
        URL.revokeObjectURL(previewUrl);
        showToast(error.message || '이미지 업로드에 실패했습니다.', 'error');
        renderImagePreviews();
      }
    }
  );

  // 진행 중인 업로드 Promise 추적
  pendingUploads.push(...uploadPromises);

  // 모든 업로드가 완료될 때까지 대기 (선택적)
  await Promise.allSettled(uploadPromises);

  // 완료된 Promise 제거
  pendingUploads = pendingUploads.filter(p => !uploadPromises.includes(p));
}

function removeImage(index) {
  const removed = uploadedImages[index];
  if (removed) {
    // URL 해제
    if (removed.previewUrl) {
      URL.revokeObjectURL(removed.previewUrl);
    }
  }
  uploadedImages.splice(index, 1);

  // primaryImageIndex 조정
  if (uploadedImages.length === 0) {
    primaryImageIndex = 0;
  } else if (index < primaryImageIndex) {
    // 대표보다 앞의 이미지가 삭제되면 인덱스 감소
    primaryImageIndex--;
  } else if (index === primaryImageIndex) {
    // 대표 이미지가 삭제되면 0으로 리셋
    primaryImageIndex = 0;
  }

  renderImagePreviews();
}

function setPrimaryImageByIndex(index) {
  // 해당 인덱스를 대표로 설정 (순서 변경 없음)
  if (index >= 0 && index < uploadedImages.length) {
    primaryImageIndex = index;
  }
  renderImagePreviews();
}

// ============ 드래그 앤 드롭 (컨테이너 이벤트 위임) ============

function initDragAndDrop() {
  const container = document.getElementById('image-preview-container');
  if (!container) return;

  // dragstart - 드래그 시작
  container.addEventListener('dragstart', e => {
    const item = e.target.closest('.image-preview-item');
    if (!item) {
      e.preventDefault();
      return;
    }

    isDragging = true;
    draggedIndex = parseInt(item.dataset.index, 10);
    item.classList.add('dragging');

    // 드래그 이미지 설정
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedIndex.toString());

    // 드래그 이미지를 해당 아이템으로 설정
    const rect = item.getBoundingClientRect();
    e.dataTransfer.setDragImage(item, rect.width / 2, rect.height / 2);
  });

  // dragend - 드래그 종료
  container.addEventListener('dragend', e => {
    const item = e.target.closest('.image-preview-item');
    if (item) {
      item.classList.remove('dragging');
    }

    // 모든 drag-over 클래스 제거
    container.querySelectorAll('.image-preview-item').forEach(el => {
      el.classList.remove('drag-over');
    });

    isDragging = false;
    draggedIndex = null;
  });

  // dragover - 드래그 중 (드롭 가능 영역 표시)
  container.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const item = e.target.closest('.image-preview-item');
    if (item && !item.classList.contains('dragging')) {
      const targetIndex = parseInt(item.dataset.index, 10);
      if (draggedIndex !== null && targetIndex !== draggedIndex) {
        // 기존 drag-over 제거 후 현재 타겟에만 추가
        container
          .querySelectorAll('.image-preview-item.drag-over')
          .forEach(el => {
            if (el !== item) el.classList.remove('drag-over');
          });
        item.classList.add('drag-over');
      }
    }
  });

  // dragleave - 드래그 영역 벗어남
  container.addEventListener('dragleave', e => {
    const item = e.target.closest('.image-preview-item');
    if (item) {
      // relatedTarget이 같은 아이템 내부가 아닐 때만 제거
      const relatedItem = e.relatedTarget?.closest('.image-preview-item');
      if (relatedItem !== item) {
        item.classList.remove('drag-over');
      }
    }
  });

  // drop - 드롭
  container.addEventListener('drop', e => {
    e.preventDefault();
    e.stopPropagation();

    const item = e.target.closest('.image-preview-item');

    // 모든 drag-over 제거
    container.querySelectorAll('.image-preview-item').forEach(el => {
      el.classList.remove('drag-over');
    });

    if (!item) {
      isDragging = false;
      draggedIndex = null;
      return;
    }

    const targetIndex = parseInt(item.dataset.index, 10);

    if (
      draggedIndex !== null &&
      draggedIndex !== targetIndex &&
      !isNaN(targetIndex)
    ) {
      // primaryImageIndex 조정 (드래그로 순서 변경 시)
      if (primaryImageIndex === draggedIndex) {
        // 대표 이미지를 드래그한 경우 → 새 위치로 이동
        primaryImageIndex = targetIndex;
      } else if (
        draggedIndex < primaryImageIndex &&
        targetIndex >= primaryImageIndex
      ) {
        // 대표보다 앞에서 뒤로 이동 → 대표 인덱스 감소
        primaryImageIndex--;
      } else if (
        draggedIndex > primaryImageIndex &&
        targetIndex <= primaryImageIndex
      ) {
        // 대표보다 뒤에서 앞으로 이동 → 대표 인덱스 증가
        primaryImageIndex++;
      }

      // 배열 순서 변경
      const draggedItem = uploadedImages[draggedIndex];
      uploadedImages.splice(draggedIndex, 1);
      uploadedImages.splice(targetIndex, 0, draggedItem);

      // 드래그 상태 해제 후 렌더링
      isDragging = false;
      draggedIndex = null;
      renderImagePreviews(true); // force 렌더링
    } else {
      isDragging = false;
      draggedIndex = null;
    }
  });
}

function handleImageSelect(e) {
  const files = e.target.files;
  if (files.length > 0) {
    addImages(files);
  }
  e.target.value = '';
}

// ============ AI 참조 이미지 관리 ============

function showAiReferenceLoading(show) {
  const dropzone = document.getElementById('ai-reference-dropzone');
  const loading = document.getElementById('ai-reference-loading');
  const input = document.getElementById('ai-reference-input');

  if (dropzone) dropzone.hidden = show;
  if (loading) loading.hidden = !show;
  if (input) input.disabled = show;
}

function getKoreanErrorMessage(error) {
  const message = error.message || '';

  // 서버 에러 메시지 한국어 변환
  if (
    message.includes('Request Entity Too Large') ||
    message.includes('413') ||
    message.includes('too large')
  ) {
    return '이미지 파일이 너무 큽니다. 5MB 이하의 이미지를 선택해주세요.';
  }
  if (message.includes('Network') || message.includes('fetch')) {
    return '네트워크 오류가 발생했습니다. 다시 시도해주세요.';
  }
  if (message.includes('timeout') || message.includes('Timeout')) {
    return '요청 시간이 초과되었습니다. 다시 시도해주세요.';
  }

  return message || '이미지 업로드에 실패했습니다.';
}

async function handleAiReferenceSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  const validation = validateImageFile(file);
  if (!validation.valid) {
    showToast(validation.message, 'error');
    e.target.value = '';
    return;
  }

  const previewUrl = URL.createObjectURL(file);

  // 로딩 UI 표시
  showAiReferenceLoading(true);

  try {
    // Base64 변환 (AI 생성 시 사용)
    const base64Data = await fileToBase64(file);

    // S3 업로드
    const s3Result = await uploadImageToS3({ file, imageType: 'POST' });
    const metadataResult = await saveImageMetadata(s3Result);

    if (!metadataResult?.imageId) {
      throw new Error('이미지 메타데이터 응답에 imageId가 없습니다.');
    }

    aiReferenceImage = {
      imageId: metadataResult.imageId,
      previewUrl,
      base64Data, // { data, mimeType }
    };

    renderAiReferencePreview();
  } catch (error) {
    URL.revokeObjectURL(previewUrl);
    const koreanMessage = getKoreanErrorMessage(error);
    showToast(koreanMessage, 'error');
    logger.error('[참조 이미지] 업로드 실패:', error);
  } finally {
    // 로딩 UI 숨김
    showAiReferenceLoading(false);
  }

  e.target.value = '';
}

function renderAiReferencePreview() {
  const uploadArea = document.getElementById('ai-reference-upload');
  const previewArea = document.getElementById('ai-reference-preview');
  const previewImage = document.getElementById('ai-reference-image');

  if (aiReferenceImage) {
    uploadArea.hidden = true;
    previewArea.hidden = false;
    previewImage.src = aiReferenceImage.previewUrl;
  } else {
    uploadArea.hidden = false;
    previewArea.hidden = true;
    previewImage.src = '';
  }

  // Lucide 아이콘 재렌더링
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

function removeAiReferenceImage() {
  if (aiReferenceImage?.previewUrl) {
    URL.revokeObjectURL(aiReferenceImage.previewUrl);
  }
  aiReferenceImage = null;
  renderAiReferencePreview();
}

// ============ AI 이미지 생성 ============

async function handleAiGenerate() {
  if (isAiGenerating) return;

  const contentInput = document.getElementById('post-content');
  const content = contentInput.value.trim();

  if (!content) {
    showToast('AI 이미지 생성을 위해 본문을 먼저 작성해주세요.', 'error');
    contentInput.focus();
    return;
  }

  const profileUrl = getProfileImageUrl(currentUser);
  if (!profileUrl) {
    showToast('프로필 사진이 필요합니다.', 'error');
    return;
  }

  // 일일 생성 횟수 체크
  const limitCheck = await checkAiGenerationLimit();
  if (!limitCheck.canGenerate) {
    showToast(limitCheck.message, 'error');
    return;
  }

  isAiGenerating = true;
  showAiLoading(true);

  try {
    // 프로필 이미지 Base64 변환
    logger.debug('[AI 생성] 프로필 이미지 가져오기:', profileUrl);
    const avatarImage = await fetchImageAsBase64(profileUrl);

    // AI 이미지 생성 및 업로드
    const result = await generateAndUploadAiImage({
      content,
      avatarImage,
      referenceImage: aiReferenceImage?.base64Data || null,
    });

    logger.debug('[AI 생성] 완료:', result);

    // 기존 생성 이미지 정리
    const mimeType = result.imageMimeType || 'image/png';
    aiGeneratedImage = {
      imageId: result.imageId,
      previewUrl:
        result.imageUrl || `data:${mimeType};base64,${result.imageData || ''}`,
    };

    renderAiResultPreview();

    // 남은 횟수 갱신
    const remaining = await updateAiRemainingCount();
    showToast(
      `AI 이미지가 생성되었습니다. (오늘 ${remaining}회 남음)`,
      'success'
    );
  } catch (error) {
    logger.error('[AI 생성] 실패:', error);
    const koreanMessage = getKoreanErrorMessage(error);
    showToast(koreanMessage, 'error');
  } finally {
    isAiGenerating = false;
    showAiLoading(false);
  }
}

function showAiLoading(show) {
  const loadingEl = document.getElementById('ai-loading');
  const generateBtn = document.getElementById('ai-generate-btn');
  const resultSection = document.getElementById('ai-result-section');

  if (loadingEl) loadingEl.hidden = !show;
  if (generateBtn) {
    generateBtn.disabled = show;
    const btnText = generateBtn.querySelector('span');
    if (btnText) btnText.textContent = show ? '생성 중...' : '이미지 생성하기';
  }
  if (resultSection && show) resultSection.hidden = true;
}

function renderAiResultPreview() {
  const resultSection = document.getElementById('ai-result-section');
  const resultImage = document.getElementById('ai-result-image');

  if (aiGeneratedImage) {
    resultSection.hidden = false;
    resultImage.src = aiGeneratedImage.previewUrl;
  } else {
    resultSection.hidden = true;
    resultImage.src = '';
  }

  // Lucide 아이콘 재렌더링
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// ============ 게시글 등록 ============

function buildCreatePostRequest() {
  const titleInput = document.getElementById('post-title');
  const contentInput = document.getElementById('post-content');

  const baseData = {
    title: titleInput.value.trim(),
    content: contentInput.value.trim(),
    imageMode, // 'manual' | 'ai'
  };

  if (imageMode === 'manual') {
    // 직접 업로드 모드
    const completedImages = uploadedImages.filter(
      img => !img.isUploading && img.imageId
    );
    const imageIds = completedImages.map(img => img.imageId);

    // 대표 이미지: primaryImageIndex에 해당하는 이미지의 imageId
    let finalPrimaryId = null;
    if (imageIds.length > 0) {
      const primaryImage = uploadedImages[primaryImageIndex];
      if (primaryImage && primaryImage.imageId) {
        finalPrimaryId = primaryImage.imageId;
      } else {
        // primaryImageIndex의 이미지가 아직 업로드 안됐으면 첫 번째 완료된 이미지
        finalPrimaryId = imageIds[0];
      }
    }

    return {
      ...baseData,
      imageIds,
      primaryImageId: finalPrimaryId,
    };
  } else {
    // AI 모드
    const imageIds = [];
    if (aiGeneratedImage?.imageId) {
      imageIds.push(aiGeneratedImage.imageId);
    }

    return {
      ...baseData,
      imageIds,
      primaryImageId: aiGeneratedImage?.imageId || null,
      referenceImageId: aiReferenceImage?.imageId || null,
    };
  }
}

function checkExpiredImages() {
  const now = Date.now();
  const expiredImages = uploadedImages.filter(
    img => img.uploadedAt && now - img.uploadedAt.getTime() > IMAGE_EXPIRY_MS
  );

  if (expiredImages.length > 0) {
    showToast('일부 이미지가 만료되었습니다. 다시 업로드해주세요.', 'error');
    // 만료된 이미지 제거
    expiredImages.forEach(img => {
      const idx = uploadedImages.indexOf(img);
      if (idx > -1) {
        if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
        uploadedImages.splice(idx, 1);
      }
    });
    renderImagePreviews();
    return false;
  }
  return true;
}

async function handleSubmit(e) {
  e.preventDefault();

  const isTitleValid = validateTitle();
  const isContentValid = validateContent();

  if (!isTitleValid || !isContentValid) {
    return;
  }

  const submitBtn = document.getElementById('submit-btn');

  // 업로드 중인 이미지가 있으면 자동으로 대기
  const uploadingImages = uploadedImages.filter(img => img.isUploading);
  if (uploadingImages.length > 0 || pendingUploads.length > 0) {
    submitBtn.disabled = true;
    submitBtn.textContent = '이미지 업로드 중...';

    // 모든 업로드 완료 대기
    await Promise.allSettled(pendingUploads);

    // 업로드 실패로 이미지가 없어졌을 수 있으므로 버튼 텍스트 복원 후 계속 진행
    submitBtn.textContent = '기록하는 중...';
  }

  // 만료된 이미지 체크
  if (!checkExpiredImages()) {
    submitBtn.disabled = false;
    submitBtn.textContent = '기록하기';
    return;
  }

  const postData = buildCreatePostRequest();

  logger.debug('[게시글 등록] uploadedImages 상태:', uploadedImages);
  logger.debug('[게시글 등록] 요청 데이터:', postData);

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = '기록하는 중...';

    const result = await createPost(postData);
    logger.debug('[게시글 등록] 응답:', result);

    if (!result || result.postId === undefined) {
      throw new Error('게시글 ID를 확인할 수 없습니다.');
    }

    clearDraft();
    hasUnsavedChanges = false;

    // URL 해제 및 배열 비우기 (beforeunload 경고 방지)
    uploadedImages.forEach(img => {
      if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
    });
    uploadedImages = [];

    // replace를 사용하여 작성 페이지를 히스토리에서 제거
    // 뒤로가기 시 작성 페이지가 아닌 피드로 이동하도록 함
    window.location.replace(`/post/${result.postId}`);
  } catch (error) {
    showToast(error.message || '게시글 등록에 실패했습니다.', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = '기록하기';
  }
}

// ============ 취소 ============

/**
 * 모든 이미지 URL 해제 (직접 업로드 + AI 모드)
 */
function revokeAllImageUrls() {
  // 직접 업로드 모드 이미지 URL 해제
  uploadedImages.forEach(img => {
    if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
  });

  // AI 모드 이미지 URL 해제
  if (aiReferenceImage?.previewUrl) {
    URL.revokeObjectURL(aiReferenceImage.previewUrl);
  }
  // aiGeneratedImage는 data URL이므로 revokeObjectURL 불필요
}

function handleCancel() {
  const titleInput = document.getElementById('post-title');
  const contentInput = document.getElementById('post-content');

  if (
    titleInput.value.trim() ||
    contentInput.value.trim() ||
    hasUnsavedImages()
  ) {
    openModal(
      '작성 취소',
      '작성 중인 내용이 있습니다. 임시 저장된 내용은 다음에 다시 불러올 수 있습니다.',
      () => {
        closeModal();
        hasUnsavedChanges = false;
        // 모든 이미지 URL 해제
        revokeAllImageUrls();
        window.location.href = '/feed';
      },
      {
        confirmText: '나가기',
        cancelText: '계속 작성',
      }
    );
  } else {
    clearDraft();
    window.location.href = '/feed';
  }
}

// ============ 초기화 ============

document.addEventListener('DOMContentLoaded', async () => {
  await renderPageLayout('layout-template');

  try {
    currentUser = await getCurrentUser();
    logger.debug('[초기화] 현재 사용자:', currentUser);
  } catch {
    openModal(
      '로그인 필요',
      '로그인이 필요한 서비스입니다. 로그인 페이지로 이동합니다.',
      () => {
        window.location.href = '/login';
      },
      {
        confirmText: '로그인하기',
        cancelText: '취소',
        onCancel: () => {
          window.location.href = '/feed';
        },
      }
    );
    return;
  }

  const titleInput = document.getElementById('post-title');
  const contentInput = document.getElementById('post-content');
  const imageInput = document.getElementById('post-image');
  const form = document.getElementById('post-form');
  const cancelBtn = document.getElementById('cancel-btn');

  // 탭 초기화
  initTabs();

  // AI 생성 횟수 초기 조회
  updateAiRemainingCount();

  // AI 참조 이미지 이벤트
  const aiReferenceInput = document.getElementById('ai-reference-input');
  const aiReferenceRemove = document.getElementById('ai-reference-remove');
  const aiGenerateBtn = document.getElementById('ai-generate-btn');
  const aiRegenerateBtn = document.getElementById('ai-regenerate-btn');

  aiReferenceInput?.addEventListener('change', handleAiReferenceSelect);
  aiReferenceRemove?.addEventListener('click', removeAiReferenceImage);
  aiGenerateBtn?.addEventListener('click', handleAiGenerate);
  aiRegenerateBtn?.addEventListener('click', handleAiGenerate);

  // 임시 저장 복원
  const savedDraft = loadDraft();
  if (savedDraft && (savedDraft.title || savedDraft.content)) {
    const savedDate = new Date(savedDraft.savedAt);
    const timeAgo = getTimeAgo(savedDate);

    openModal(
      '임시 저장된 글이 있습니다',
      `${timeAgo} 작성하던 글이 있습니다. 이어서 작성하시겠습니까?`,
      () => {
        restoreDraft(savedDraft);
        closeModal();
      },
      {
        confirmText: '이어서 작성',
        cancelText: '새로 작성',
      }
    );
  }

  // 제목 입력 이벤트
  titleInput.addEventListener('input', e => {
    // 26자 초과 시 자동으로 자르기 (내용과 동일한 방식)
    const maxLength = 26;
    if (e.target.value.length > maxLength) {
      e.target.value = e.target.value.slice(0, maxLength);
    }

    const count = e.target.value.length;
    document.getElementById('title-char-count').textContent = `${count}/26`;
    scheduleDraftSave();
  });

  titleInput.addEventListener('blur', validateTitle);

  // 내용 입력 이벤트
  contentInput.addEventListener('input', e => {
    // 10,000자 초과 시 자동으로 자르기 (제목처럼 동작)
    const maxLength = 10000;
    if (e.target.value.length > maxLength) {
      e.target.value = e.target.value.slice(0, maxLength);
    }

    const count = e.target.value.length;
    const charCountEl = document.getElementById('content-char-count');
    if (charCountEl) {
      charCountEl.textContent = `${count.toLocaleString()}/10,000`;
    }
    if (count > 0) validateContent();
    scheduleDraftSave();
  });

  contentInput.addEventListener('blur', validateContent);

  // 이미지 선택 이벤트
  imageInput.addEventListener('change', handleImageSelect);

  // 폼 제출 이벤트
  form.addEventListener('submit', handleSubmit);

  // 취소 버튼 이벤트
  cancelBtn.addEventListener('click', handleCancel);

  // 브라우저 닫기 경고 (직접 업로드 + AI 모드 모두 체크)
  window.addEventListener('beforeunload', e => {
    if (hasUnsavedChanges || hasUnsavedImages()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // 내부 링크 클릭 시 자체 모달로 경고 (브라우저 기본 경고 대신)
  document.addEventListener('click', e => {
    // 링크 요소 찾기 (a 태그 또는 부모 중 a 태그)
    const link = e.target.closest('a[href]');
    if (!link) return;

    const href = link.getAttribute('href');

    // 외부 링크, 앵커, 또는 현재 페이지는 무시
    if (
      !href ||
      href.startsWith('#') ||
      href.startsWith('javascript:') ||
      href.startsWith('mailto:') ||
      link.target === '_blank'
    ) {
      return;
    }

    // 저장되지 않은 내용이 있으면 자체 모달 표시
    const titleInput = document.getElementById('post-title');
    const contentInput = document.getElementById('post-content');
    const hasContent =
      titleInput?.value.trim() ||
      contentInput?.value.trim() ||
      hasUnsavedImages();

    if (hasContent) {
      e.preventDefault();
      openModal(
        '페이지를 나가시겠습니까?',
        '작성 중인 내용이 있습니다. 페이지를 나가면 저장되지 않은 내용이 사라집니다.',
        () => {
          closeModal();
          hasUnsavedChanges = false;
          revokeAllImageUrls();
          window.location.href = href;
        },
        {
          confirmText: '나가기',
          cancelText: '계속 작성',
        }
      );
    }
  });

  // 드래그 앤 드롭 초기화
  initDragAndDrop();

  // 초기 렌더링
  renderImagePreviews();
});
