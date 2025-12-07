/**
 * 전역 레이아웃 로더
 * Header, Bottom Navigation, Modal 컴포넌트를 동적으로 로드
 */

import { logger } from './logger.js';

/**
 * Header 컴포넌트 로드
 */
export async function loadHeader() {
  try {
    const container = document.getElementById('header-container');
    if (!container) return;

    const response = await fetch('/component/header/header.html');
    if (!response.ok) throw new Error('Failed to load header');

    const html = await response.text();
    container.innerHTML = html;

    // 헤더 이벤트 리스너 초기화
    const { initHeaderEvents } = await import('/component/header/header.js');
    initHeaderEvents();

    // Lucide 아이콘 렌더링
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  } catch (error) {
    logger.error('Failed to load header:', error);
  }
}

/**
 * Bottom Navigation 컴포넌트 로드
 */
export async function loadBottomNav() {
  try {
    const container = document.getElementById('bottom-nav-container');
    if (!container) return;

    const response = await fetch('/component/bottom-nav/bottom-nav.html');
    if (!response.ok) throw new Error('Failed to load bottom nav');

    const html = await response.text();
    container.innerHTML = html;

    // Bottom Nav 이벤트 리스너 초기화
    const { initBottomNavEvents } = await import(
      '/component/bottom-nav/bottom-nav.js'
    );
    initBottomNavEvents();
  } catch (error) {
    logger.error('Failed to load bottom nav:', error);
  }
}

/**
 * Modal 컴포넌트 로드
 */
export async function loadModal() {
  try {
    const container = document.getElementById('modal-container');
    if (!container) return;

    const response = await fetch('/component/modal/modal.html');
    if (!response.ok) throw new Error('Failed to load modal');

    const html = await response.text();
    container.innerHTML = html;
  } catch (error) {
    logger.error('Failed to load modal:', error);
  }
}

/**
 * 모든 레이아웃 컴포넌트 로드
 */
export async function loadLayout() {
  await Promise.all([loadHeader(), loadBottomNav(), loadModal()]);
}

// 모달 이벤트 핸들러 저장소 (재사용 및 정리를 위해)
let currentModalHandlers = null;

/**
 * 모달 열기 유틸리티
 * @param {string} title - 모달 제목
 * @param {string} description - 모달 설명
 * @param {Function} onConfirm - 확인 버튼 클릭 시 콜백
 * @param {Object} options - 추가 옵션
 * @param {string} options.confirmText - 확인 버튼 텍스트
 * @param {string} options.confirmClass - 확인 버튼 클래스 (btn--danger 등)
 * @param {('primary'|'danger'|'outline')} options.confirmVariant - 확인 버튼 프리셋
 * @param {string} options.confirmColor - 확인 버튼 배경 컬러 (선택)
 * @param {string} options.confirmTextColor - confirmColor 사용 시 텍스트 컬러
 * @param {string} options.cancelText - 취소 버튼 텍스트
 * @param {Function} options.onCancel - 취소 시 콜백
 *
 * @example
 * openModal('삭제 확인', '정말 삭제하시겠습니까?', () => {}, {
 *   confirmText: '삭제',
 *   confirmClass: 'btn--danger'
 * });
 */
export function openModal(title, description, onConfirm, options = {}) {
  const modalOverlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalDesc = document.getElementById('modal-desc');
  const confirmBtn = document.getElementById('modal-confirm');
  const cancelBtn = document.getElementById('modal-cancel');

  if (!modalOverlay || !modalTitle || !modalDesc || !confirmBtn || !cancelBtn) {
    logger.error('Modal elements not found');
    return;
  }

  modalTitle.textContent = title;

  // HTML 사용 여부에 따라 textContent 또는 innerHTML 사용
  if (options.useHtml) {
    modalDesc.innerHTML = description;
    // Lucide 아이콘 렌더링
    if (typeof lucide !== 'undefined') {
      lucide.createIcons({ nodes: [modalDesc] });
    }
  } else {
    modalDesc.textContent = description;
  }

  // 확인 버튼 설정
  confirmBtn.textContent = options.confirmText || '확인';
  const confirmVariant = options.confirmVariant || null;
  let confirmClass = options.confirmClass;
  if (!confirmClass) {
    switch (confirmVariant) {
      case 'danger':
        confirmClass = 'btn--danger';
        break;
      case 'outline':
        confirmClass = 'btn--outline';
        break;
      default:
        confirmClass = 'btn--primary';
        break;
    }
  }
  confirmBtn.className = `btn ${confirmClass}`;
  confirmBtn.style.background = '';
  confirmBtn.style.color = '';
  confirmBtn.style.borderColor = '';
  if (options.confirmColor) {
    confirmBtn.style.background = options.confirmColor;
    confirmBtn.style.borderColor = options.confirmColor;
    confirmBtn.style.color = options.confirmTextColor || '#ffffff';
  }

  // 취소 버튼 설정
  cancelBtn.textContent = options.cancelText || '취소';
  cancelBtn.className = 'btn btn--outline';

  // 기존 스타일 초기화
  confirmBtn.style.background = '';

  if (options.titleClass) {
    modalTitle.className = `modal__title ${options.titleClass}`;
  } else {
    modalTitle.className = 'modal__title';
  }

  if (options.descClass) {
    modalDesc.className = `modal__desc ${options.descClass}`;
  } else {
    modalDesc.className = 'modal__desc';
  }

  // 기존 이벤트 리스너 정리
  cleanupModalHandlers();

  // 새 이벤트 핸들러 생성
  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    closeModal();
  };

  const handleCancel = () => {
    if (typeof options.onCancel === 'function') {
      options.onCancel();
    }
    closeModal();
  };

  const handleOverlayClick = e => {
    if (e.target === modalOverlay) {
      handleCancel();
    }
  };

  const handleKeydown = e => {
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  // 이벤트 리스너 등록
  confirmBtn.addEventListener('click', handleConfirm);
  cancelBtn.addEventListener('click', handleCancel);
  modalOverlay.addEventListener('click', handleOverlayClick);
  document.addEventListener('keydown', handleKeydown);

  // 정리를 위해 현재 핸들러 저장
  currentModalHandlers = {
    confirmBtn,
    cancelBtn,
    modalOverlay,
    handleConfirm,
    handleCancel,
    handleOverlayClick,
    handleKeydown,
  };

  modalOverlay.removeAttribute('hidden');

  // 확인 버튼에 포커스
  confirmBtn.focus();
}

// 모달 이벤트 핸들러 정리
function cleanupModalHandlers() {
  if (!currentModalHandlers) return;

  const {
    confirmBtn,
    cancelBtn,
    modalOverlay,
    handleConfirm,
    handleCancel,
    handleOverlayClick,
    handleKeydown,
  } = currentModalHandlers;

  confirmBtn.removeEventListener('click', handleConfirm);
  cancelBtn.removeEventListener('click', handleCancel);
  modalOverlay.removeEventListener('click', handleOverlayClick);
  if (handleKeydown) {
    document.removeEventListener('keydown', handleKeydown);
  }

  currentModalHandlers = null;
}

/**
 * 모달 닫기 유틸리티
 */
export function closeModal() {
  const modalOverlay = document.getElementById('modal-overlay');
  if (modalOverlay) {
    modalOverlay.setAttribute('hidden', '');
    cleanupModalHandlers(); // 이벤트 리스너 정리
  }
}

/**
 * 토스트 메시지 표시
 * @param {string} message - 표시할 메시지
 * @param {string} type - 토스트 타입 ('success' | 'error' | 'warning' | 'info')
 * @param {number} duration - 표시 시간 (ms)
 */
export function showToast(message, type = 'success', duration = 3000) {
  // 기존 토스트 컨테이너 찾기 또는 생성
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  // 자동 제거
  setTimeout(() => {
    toast.classList.add('toast--fade-out');
    setTimeout(() => {
      toast.remove();
      // 컨테이너가 비어있으면 제거
      if (container.children.length === 0) {
        container.remove();
      }
    }, 300);
  }, duration);
}
