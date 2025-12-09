import { createAvatar } from '../avatar/avatar.js';

/**
 * 댓글 컴포넌트 생성 함수
 * @param {Object} commentData - 댓글 데이터 객체
 * @param {string} commentData.id - 댓글 ID
 * @param {string} commentData.author - 작성자 닉네임
 * @param {string} commentData.profileImage - 프로필 이미지 URL (선택적, 없으면 CSS 아바타 표시)
 * @param {string} commentData.content - 댓글 내용
 * @param {string} commentData.createdAt - 작성 시간 (ISO 형식 또는 표시 형식)
 * @param {boolean} commentData.isAuthor - 현재 사용자가 작성자인지 여부 (삭제 버튼 표시)
 * @param {boolean} commentData.isDeleted - 삭제된 댓글 여부
 * @param {Function} commentData.onDelete - 삭제 버튼 클릭 핸들러 (선택적)
 * @returns {HTMLElement} 생성된 댓글 DOM 엘리먼트
 */
export function createComment(commentData) {
  const {
    id,
    author,
    profileImage = null,
    content,
    createdAt,
    isAuthor = false,
    isDeleted = false,
    onDelete = null,
  } = commentData;

  const commentEl = document.createElement('article');
  commentEl.className = 'comment';
  commentEl.dataset.commentId = id;

  if (isDeleted) {
    commentEl.classList.add('comment--deleted');
  }

  const avatarEl = document.createElement('div');
  avatarEl.className = 'comment__avatar';
  const avatar = createAvatar({
    nickname: author ?? '익명',
    imageUrl: profileImage,
    size: 'sm',
  });
  avatarEl.appendChild(avatar);

  const bodyEl = document.createElement('div');
  bodyEl.className = 'comment__body';

  const metaRow = document.createElement('div');
  metaRow.className = 'comment__meta-row';

  const metaEl = document.createElement('div');
  metaEl.className = 'comment__meta';

  const nicknameEl = document.createElement('span');
  nicknameEl.className = 'comment__author-name';
  nicknameEl.textContent = author ?? '익명';

  const dotEl = document.createElement('span');
  dotEl.className = 'comment__dot';
  dotEl.setAttribute('aria-hidden', 'true');

  const dateEl = document.createElement('time');
  dateEl.className = 'comment__date';
  const dateValue = new Date(createdAt);
  if (!Number.isNaN(dateValue.getTime())) {
    dateEl.dateTime = dateValue.toISOString();
  }
  dateEl.textContent = formatDate(createdAt);

  metaEl.appendChild(nicknameEl);
  metaEl.appendChild(dotEl);
  metaEl.appendChild(dateEl);

  metaRow.appendChild(metaEl);

  const actionsEl = document.createElement('div');
  actionsEl.className = 'comment__actions';

  if (isAuthor && !isDeleted && typeof onDelete === 'function') {
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'comment__action comment__action--delete';
    deleteBtn.title = '댓글 삭제';
    deleteBtn.setAttribute('aria-label', '댓글 삭제');
    deleteBtn.innerHTML = '<i data-lucide="trash-2" aria-hidden="true"></i>';
    deleteBtn.addEventListener('click', () => onDelete(id));
    actionsEl.appendChild(deleteBtn);
  }

  if (actionsEl.children.length > 0) {
    metaRow.appendChild(actionsEl);
  }

  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'comment__content';
  if (isDeleted) {
    contentWrapper.classList.add('comment__content--deleted');
  }

  const paragraph = document.createElement('p');
  paragraph.textContent = isDeleted ? '삭제된 댓글입니다.' : (content ?? '');
  contentWrapper.appendChild(paragraph);

  bodyEl.appendChild(metaRow);
  bodyEl.appendChild(contentWrapper);

  commentEl.appendChild(avatarEl);
  commentEl.appendChild(bodyEl);

  return commentEl;
}

/**
 * 날짜 포맷팅 함수
 * @param {string|Date} date - 날짜 객체 또는 ISO 문자열
 * @returns {string} 포맷팅된 날짜 문자열 (YYYY-MM-DD HH:mm:ss)
 */
function formatDate(date) {
  // 이미 포맷팅된 문자열이면 그대로 반환
  if (
    typeof date === 'string' &&
    date.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  ) {
    return date;
  }

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const seconds = String(dateObj.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 댓글 목록 렌더링 함수
 * @param {HTMLElement} container - 댓글을 렌더링할 컨테이너 엘리먼트
 * @param {Array<Object>} comments - 댓글 데이터 배열
 */
export function renderComments(container, comments) {
  // 기존 댓글 제거
  container.innerHTML = '';

  // 댓글이 없는 경우
  if (!comments || comments.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'empty-message';
    emptyMessage.textContent = '첫 댓글을 작성해보세요!';
    container.appendChild(emptyMessage);
    return;
  }

  // 각 댓글 렌더링
  comments.forEach(comment => {
    const commentEl = createComment(comment);
    container.appendChild(commentEl);
  });

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}
