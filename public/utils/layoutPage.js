import { loadLayout } from './layout.js';
import { initConfig } from '../services/api-config.js';

let cachedLayoutMarkup = '';

async function getLayoutMarkup() {
  if (cachedLayoutMarkup) return cachedLayoutMarkup;

  const response = await fetch('/layout.html', { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error('Failed to fetch layout template');
  }

  cachedLayoutMarkup = await response.text();
  return cachedLayoutMarkup;
}

async function createLayoutRoot() {
  const markup = await getLayoutMarkup();
  const parser = new DOMParser();
  const parsed = parser.parseFromString(markup, 'text/html');
  const appRoot = parsed.getElementById('app');

  if (!appRoot) {
    throw new Error('Layout template is missing #app root element');
  }

  return appRoot;
}

/**
 * Replace layout placeholder with page-specific template content and load common layout parts.
 * @param {string} templateId - The id attribute for the <template> element containing page markup.
 */
export async function renderPageLayout(templateId) {
  // API 설정을 먼저 로드 (API 호출 전에 BASE_URL이 설정되어야 함)
  await initConfig();

  const template = document.getElementById(templateId);
  if (!template) {
    throw new Error(`Layout template "${templateId}" not found in document`);
  }

  const fragment = template.content ? template.content.cloneNode(true) : null;

  if (!fragment) {
    throw new Error(
      `Layout template "${templateId}" does not contain any content`
    );
  }

  const layoutRoot = await createLayoutRoot();
  const layoutPlaceholder = layoutRoot.querySelector('#main-content');

  if (!layoutPlaceholder) {
    throw new Error('Layout template is missing #main-content placeholder');
  }

  layoutPlaceholder.replaceWith(fragment);

  document.body.replaceChildren(layoutRoot);

  await loadLayout();

  return layoutRoot;
}
