import { renderPageLayout } from '../../../utils/layoutPage.js';

document.addEventListener('DOMContentLoaded', async () => {
  await renderPageLayout('layout-template');

  // Lucide 아이콘 초기화
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
});
