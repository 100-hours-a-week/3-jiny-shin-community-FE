/**
 * Onboarding Page
 * 3개 슬라이드로 구성된 온보딩 페이지
 */

const TOTAL_SLIDES = 3;
let currentSlide = 0;

document.addEventListener('DOMContentLoaded', () => {
  // Lucide 아이콘 렌더링
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  initOnboarding();
});

function initOnboarding() {
  const slides = document.querySelectorAll('.onboarding__slide');
  const dots = document.querySelectorAll('.dot');
  const nextBtn = document.getElementById('nextBtn');
  const skipBtn = document.getElementById('skipBtn');

  // 다음 버튼 클릭
  nextBtn.addEventListener('click', () => {
    if (currentSlide < TOTAL_SLIDES - 1) {
      goToSlide(currentSlide + 1);
    } else {
      finishOnboarding();
    }
  });

  // 건너뛰기 버튼 클릭
  skipBtn.addEventListener('click', () => {
    finishOnboarding();
  });

  // 도트 클릭
  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      goToSlide(index);
    });
  });

  // 스와이프 지원
  let touchStartX = 0;
  let touchEndX = 0;

  const slidesContainer = document.getElementById('slides');

  slidesContainer.addEventListener(
    'touchstart',
    e => {
      touchStartX = e.changedTouches[0].screenX;
    },
    { passive: true }
  );

  slidesContainer.addEventListener(
    'touchend',
    e => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    },
    { passive: true }
  );

  function handleSwipe() {
    const diff = touchStartX - touchEndX;
    const threshold = 50;

    if (diff > threshold && currentSlide < TOTAL_SLIDES - 1) {
      // 왼쪽으로 스와이프 -> 다음 슬라이드
      goToSlide(currentSlide + 1);
    } else if (diff < -threshold && currentSlide > 0) {
      // 오른쪽으로 스와이프 -> 이전 슬라이드
      goToSlide(currentSlide - 1);
    }
  }

  // 초기 상태 설정
  updateButtonState();
}

function goToSlide(index) {
  const slides = document.querySelectorAll('.onboarding__slide');
  const dots = document.querySelectorAll('.dot');

  // 현재 슬라이드 비활성화
  slides[currentSlide].classList.remove('active');
  slides[currentSlide].classList.add(index > currentSlide ? 'prev' : '');
  dots[currentSlide].classList.remove('active');

  // 새 슬라이드 활성화
  currentSlide = index;
  slides[currentSlide].classList.remove('prev');
  slides[currentSlide].classList.add('active');
  dots[currentSlide].classList.add('active');

  updateButtonState();
}

function updateButtonState() {
  const nextBtn = document.getElementById('nextBtn');
  const skipBtn = document.getElementById('skipBtn');

  if (currentSlide === TOTAL_SLIDES - 1) {
    nextBtn.textContent = '시작하기';
    skipBtn.style.visibility = 'hidden';
  } else {
    nextBtn.textContent = '다음';
    skipBtn.style.visibility = 'visible';
  }
}

function finishOnboarding() {
  // 온보딩 완료 표시 저장
  localStorage.setItem('anoo_onboarding_complete', 'true');

  // 로그인 페이지로 이동 (replace로 온보딩을 히스토리에서 제거)
  window.location.replace('/login');
}
