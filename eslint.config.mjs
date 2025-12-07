import js from '@eslint/js';

export default [
  {
    ignores: [
      'node_modules/**',
      'public/assets/**',
      'public/component-preview.html',
      'public/component/**/example.html',
    ],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 'latest',
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        alert: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        Headers: 'readonly',
        fetch: 'readonly',
        AbortController: 'readonly',
        Blob: 'readonly',
        FileReader: 'readonly',
        ReadableStream: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        history: 'readonly',
        localStorage: 'readonly',
        lucide: 'readonly',
        DOMParser: 'readonly',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-console': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['app.js', 'routes/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      ecmaVersion: 'latest',
      globals: {
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
      },
    },
  },
];
