/**
 * 전역 레이아웃 로더
 * Header, Footer, Modal 컴포넌트를 동적으로 로드
 */

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
  } catch (error) {
    console.error('Failed to load header:', error);
  }
}

/**
 * Footer 컴포넌트 로드
 */
export async function loadFooter() {
  try {
    const container = document.getElementById('footer-container');
    if (!container) return;

    const response = await fetch('/component/footer/footer.html');
    if (!response.ok) throw new Error('Failed to load footer');

    const html = await response.text();
    container.innerHTML = html;
  } catch (error) {
    console.error('Failed to load footer:', error);
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
    console.error('Failed to load modal:', error);
  }
}

/**
 * 모든 레이아웃 컴포넌트 로드
 */
export async function loadLayout() {
  await Promise.all([loadHeader(), loadFooter(), loadModal()]);
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
 * @param {string} options.confirmColor - 확인 버튼 배경색
 *
 * @example
 * openModal('알림', '게시글이 삭제되었습니다.', () => {});
 */
export function openModal(title, description, onConfirm, options = {}) {
  const modalOverlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalDesc = document.getElementById('modal-desc');
  const confirmBtn = document.getElementById('modal-confirm');
  const cancelBtn = document.getElementById('modal-cancel');

  if (!modalOverlay || !modalTitle || !modalDesc || !confirmBtn || !cancelBtn) {
    console.error('Modal elements not found');
    return;
  }

  modalTitle.textContent = title;
  modalDesc.textContent = description;

  // 옵션 적용
  if (options.confirmText) {
    confirmBtn.textContent = options.confirmText;
  } else {
    confirmBtn.textContent = '확인';
  }

  if (options.confirmColor) {
    confirmBtn.style.background = options.confirmColor;
  } else {
    confirmBtn.style.background = '';
  }

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
    closeModal();
  };

  const handleOverlayClick = e => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  };

  // 이벤트 리스너 등록
  confirmBtn.addEventListener('click', handleConfirm);
  cancelBtn.addEventListener('click', handleCancel);
  modalOverlay.addEventListener('click', handleOverlayClick);

  // 정리를 위해 현재 핸들러 저장
  currentModalHandlers = {
    confirmBtn,
    cancelBtn,
    modalOverlay,
    handleConfirm,
    handleCancel,
    handleOverlayClick,
  };

  modalOverlay.removeAttribute('hidden');
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
  } = currentModalHandlers;

  confirmBtn.removeEventListener('click', handleConfirm);
  cancelBtn.removeEventListener('click', handleCancel);
  modalOverlay.removeEventListener('click', handleOverlayClick);

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
