require('dotenv').config();

const path = require('path');
const express = require('express');
const packageJson = require('./package.json');

const app = express();

// JSON body parser (AI 이미지 생성 API용 - 큰 Base64 이미지 처리)
// 프로필 이미지 + 참조 이미지가 Base64로 전송되므로 넉넉하게 설정
app.use(express.json({ limit: '20mb' }));
const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const isProduction = process.env.NODE_ENV === 'production';

const staticOptions = {
  fallthrough: true,
  setHeaders(res) {
    if (!isProduction) {
      res.setHeader('Cache-Control', 'no-store');
    }
  },
};

// ==========================================
// Clean URL Routes (Express 라우팅)
// ==========================================

// Health check endpoint for ALB
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Client configuration endpoint (환경변수를 클라이언트에 전달)
app.get('/config', (req, res) => {
  res.json({
    API_BASE_URL: process.env.API_BASE_URL || '/api/',
    IMAGE_UPLOAD_API: process.env.IMAGE_UPLOAD_API || '',
    APP_VERSION: packageJson.version,
  });
});

// Root / Landing Page
app.get('/', (req, res) => {
  const indexPath = path.join(ROOT_DIR, 'public', 'index.html');
  res.sendFile(indexPath, err => {
    if (err) {
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head><title>anoo</title></head>
          <body>
            <h1>anoo Frontend</h1>
            <p>Server is running!</p>
            <p>Health Check: <a href="/health">/health</a></p>
          </body>
        </html>
      `);
    }
  });
});

// Auth Routes
app.get('/login', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'public', 'pages', 'login', 'login.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'public', 'pages', 'signup', 'signup.html'));
});

// Onboarding
app.get('/onboarding', (req, res) => {
  res.sendFile(
    path.join(ROOT_DIR, 'public', 'pages', 'onboarding', 'onboarding.html')
  );
});

// Feed / Home
app.get('/feed', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'public', 'pages', 'home', 'home.html'));
});

app.get('/home', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'public', 'pages', 'home', 'home.html'));
});

// Post Routes
app.get('/write', (req, res) => {
  res.sendFile(
    path.join(ROOT_DIR, 'public', 'pages', 'post', 'post-create.html')
  );
});

app.get('/post/:id', (req, res) => {
  res.sendFile(
    path.join(ROOT_DIR, 'public', 'pages', 'post', 'post-detail.html')
  );
});

// Profile Routes
app.get('/profile', (req, res) => {
  res.sendFile(
    path.join(ROOT_DIR, 'public', 'pages', 'profile', 'profile.html')
  );
});

app.get('/profile/edit', (req, res) => {
  res.sendFile(
    path.join(ROOT_DIR, 'public', 'pages', 'profile', 'profile-edit.html')
  );
});

// Legal Routes
app.get('/terms', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'public', 'pages', 'terms', 'terms.html'));
});

app.get('/privacy', (req, res) => {
  res.sendFile(
    path.join(ROOT_DIR, 'public', 'pages', 'privacy', 'privacy.html')
  );
});

// Feedback Route
app.get('/feedback', (req, res) => {
  res.sendFile(
    path.join(ROOT_DIR, 'public', 'pages', 'feedback', 'feedback.html')
  );
});

// ==========================================
// 접근 차단 (미구현 기능)
// ==========================================

// post-edit 접근 차단 (추후 활성화 예정)
app.get('/pages/post/post-edit*', (req, res) => {
  const notFoundPath = path.join(
    ROOT_DIR,
    'public',
    'pages',
    '404',
    '404.html'
  );
  res.status(404).sendFile(notFoundPath, err => {
    if (err) {
      res.status(404).send('Page Not Found');
    }
  });
});

// ==========================================
// AI API Router (Gemini 프록시)
// ==========================================

const aiRouter = require('./routes/ai');
app.use('/api/ai', aiRouter);

// ==========================================
// 이미지 프록시 (CORS 우회용)
// ==========================================

app.get('/api/image-proxy', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  // S3 URL만 허용 (보안)
  const allowedDomains = [
    'ktb-community-images.s3.ap-northeast-2.amazonaws.com',
    's3.ap-northeast-2.amazonaws.com',
  ];

  try {
    const parsedUrl = new URL(url);
    if (!allowedDomains.some(domain => parsedUrl.hostname.includes(domain))) {
      return res.status(403).json({ error: 'Domain not allowed' });
    }

    const response = await fetch(url);
    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: 'Failed to fetch image' });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();

    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('[Image Proxy] Error:', error.message);
    res.status(500).json({ error: 'Failed to proxy image' });
  }
});

// ==========================================
// Static Files
// ==========================================

app.use('/api', express.static(path.join(ROOT_DIR, 'api'), staticOptions));
app.use('/utils', express.static(path.join(ROOT_DIR, 'utils'), staticOptions));
app.use(
  express.static(path.join(ROOT_DIR, 'public'), {
    ...staticOptions,
    index: false,
  })
);

// ==========================================
// 404 Handler
// ==========================================

app.use((req, res) => {
  const notFoundPath = path.join(
    ROOT_DIR,
    'public',
    'pages',
    '404',
    '404.html'
  );
  res.status(404).sendFile(notFoundPath, err => {
    if (err) {
      res.status(404).send('Page Not Found');
    }
  });
});

// ==========================================
// Server Start
// ==========================================

const HOST = isProduction ? '0.0.0.0' : 'localhost';

app.listen(PORT, HOST, () => {
  console.log(`🚀 anoo server running at http://${HOST}:${PORT}`);
  console.log(`📡 Health check available at http://${HOST}:${PORT}/health`);
  console.log('');
  console.log('Clean URLs:');
  console.log(`  /login     -> Login page`);
  console.log(`  /signup    -> Signup page`);
  console.log(`  /onboarding -> Onboarding page`);
  console.log(`  /feed      -> Home feed`);
  console.log(`  /write     -> Create post`);
  console.log(`  /post/:id  -> Post detail`);
  console.log(`  /profile   -> Profile page`);
  console.log('');
  console.log('AI API:');
  console.log(`  POST /api/ai/generate-prompt -> AI 프롬프트 생성`);
  console.log(`  POST /api/ai/generate-image  -> AI 이미지 생성`);
});
