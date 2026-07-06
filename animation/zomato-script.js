// Animation constants
const TOTAL_FRAMES = 240;
const FPS = 30;

// Frame boundaries for phases
const PHASE_START_1 = 0;   // Normal View & Card Entry (0s - 2s)
const PHASE_START_2 = 60;  // 3D Zomato Tilt & Bubbles Expansion (2s - 4.5s)
const PHASE_START_3 = 135; // Straight Back & Cursor Click (4.5s - 6.5s)
const PHASE_START_4 = 195; // Close-up Pizza Card Zoom & Confetti (6.5s - 8s)

// State variables
let currentFrame = 0;
let isPlaying = true;
let playSpeed = 1.0;
let lastTimestamp = 0;

// DOM Elements
const viewport = document.querySelector('.showcase-viewport');
const zoomWrapper = document.getElementById('zoom-wrapper');
const phoneWrapper = document.getElementById('phone-mockup-wrapper');
const secondaryScreen = document.getElementById('secondary-phone-screen');
const phoneScreenContent = document.getElementById('phone-screen-content');
const phoneShell = document.querySelector('.phone-shell');
const profileHeader = document.querySelector('.profile-header');
const creatorPhotoWrapper = document.querySelector('.creator-photo-wrapper');

// Floating Cards
const card1 = document.getElementById('phone-card-1');
const card2 = document.getElementById('phone-card-2');
const card3 = document.getElementById('phone-card-3');
const card4 = document.getElementById('phone-card-4');
const btnGetStarted = document.getElementById('btn-get-started');

// Glass Bubbles
const bubbleCalendar = document.getElementById('bubble-calendar');
const bubbleDownloads = document.getElementById('bubble-downloads');
const bubbleCourse = document.getElementById('bubble-course');
const bubbleDecor = document.getElementById('bubble-decor');

// Connectors SVG Layer
const connectorsSvg = document.querySelector('.connectors-svg');
const pathCourse = document.getElementById('path-course');
const pathCalendar = document.getElementById('path-calendar');
const pathDownloads = document.getElementById('path-downloads');

// Cursor & Overlay
const virtualCursor = document.getElementById('virtual-cursor');
const cursorRipple = document.getElementById('cursor-ripple');
const celebrationToast = document.getElementById('celebration-toast');
const canvas = document.getElementById('confetti-canvas');
const ctx = canvas.getContext('2d');

// Controls
const btnPlay = document.getElementById('btn-play');
const btnRestart = document.getElementById('btn-restart');
const speedBtns = document.querySelectorAll('.speed-btn');
const slider = document.getElementById('timeline-slider');
const stepIndicators = document.querySelectorAll('.step-indicator');

// Resize canvas to fill viewport
function resizeCanvas() {
  canvas.width = viewport.clientWidth;
  canvas.height = viewport.clientHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ── Interpolation Helper Functions ──
function lerp(start, end, amt) {
  return (1 - amt) * start + amt * end;
}

function easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3);
}

function easeOutBack(x) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function easeInOutQuad(x) {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

// ── Deterministic Confetti Seed System (Zomato Colors) ──
const CONFETTI_COUNT = 90;
const confettiSeeds = [];
const confettiColors = ['#e23744', '#f59e0b', '#fbbf24', '#ffffff', '#9f1239', '#ef4444', '#ffebee'];

for (let i = 0; i < CONFETTI_COUNT; i++) {
  // Angle skewed upwards (1.3 to 1.7 * PI)
  const angle = (1.35 + Math.abs(Math.sin(i * 432.1)) * 0.3) * Math.PI;
  const speed = 5 + Math.abs(Math.cos(i * 123.4)) * 14;
  confettiSeeds.push({
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: 6 + Math.abs(Math.sin(i * 987.6)) * 8,
    color: confettiColors[i % confettiColors.length],
    rotSpeed: -8 + Math.abs(Math.cos(i * 654.3)) * 16,
    rotOffset: Math.abs(Math.sin(i * 321.0)) * 360
  });
}

function drawDeterministicConfetti(t) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (t <= 0) return;

  const gravity = 0.35;
  // Click target is at x=512, y=288 (since card is centered during zoom)
  const startX = 512;
  const startY = 288;
  const groundY = 530;

  for (let i = 0; i < CONFETTI_COUNT; i++) {
    const seed = confettiSeeds[i];

    let dx = seed.vx * t;
    let dy = seed.vy * t + 0.5 * gravity * t * t;

    let cx = startX + dx;
    let cy = startY + dy;

    if (cy > groundY) {
      const a = 0.5 * gravity;
      const b = seed.vy;
      const c = startY - groundY;
      const discriminant = b * b - 4 * a * c;
      if (discriminant >= 0) {
        const tc = (-b + Math.sqrt(discriminant)) / (2 * a);
        if (t > tc) {
          const tPost = t - tc;
          const vyCollision = seed.vy + gravity * tc;
          const vyBounce = -vyCollision * 0.35;
          const vxBounce = seed.vx * 0.7;
          cx = startX + seed.vx * tc + vxBounce * tPost;
          cy = groundY + vyBounce * tPost + 0.5 * gravity * tPost * tPost;
          if (cy > groundY) cy = groundY;
        }
      }
    }

    const maxLife = 50;
    let opacity = 1.0;
    if (t > 25) {
      opacity = Math.max(0, 1 - (t - 25) / (maxLife - 25));
    }

    if (opacity <= 0) continue;

    const rot = (seed.rotOffset + t * seed.rotSpeed) * Math.PI / 180;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.fillStyle = seed.color;
    ctx.globalAlpha = opacity;
    ctx.fillRect(-seed.size / 2, -seed.size / 2, seed.size, seed.size);
    ctx.restore();
  }
}

// ── Main Update Frame Call ──
function updateShowcase(frame) {
  slider.value = Math.floor(frame);

  const seconds = (frame / FPS).toFixed(2);
  document.querySelector('.time-label').textContent = `${seconds}s`;

  // Update step indicators
  stepIndicators.forEach((ind) => {
    const start = parseInt(ind.dataset.frame, 10);
    const stepIdx = Array.from(stepIndicators).indexOf(ind);
    const nextStart = stepIndicators[stepIdx + 1] ? parseInt(stepIndicators[stepIdx + 1].dataset.frame, 10) : TOTAL_FRAMES;

    if (frame >= start && frame < nextStart) {
      ind.classList.add('active');
    } else {
      ind.classList.remove('active');
    }
  });

  const globalFloat = Math.sin((frame / 16) * Math.PI) * 4;

  // -------------------------------------------------------------
  // PHASE 1: Normal View (Frames 0 to 60)
  // -------------------------------------------------------------
  if (frame >= PHASE_START_1 && frame < PHASE_START_2) {
    // Reset zoom wrapper & blur effects
    zoomWrapper.style.transform = `scale(1) translate3d(0, 0, 0)`;
    phoneShell.style.filter = 'none';
    phoneShell.style.opacity = '1';
    secondaryScreen.style.filter = 'none';
    secondaryScreen.style.opacity = '0';
    secondaryScreen.style.transform = `translate3d(0, 0, -10px)`;
    
    // Reset cards blur & opacity
    card1.style.filter = 'none';
    card1.style.opacity = '1';
    card2.style.filter = 'none';
    card2.style.opacity = '1';
    card3.style.filter = 'none';
    card3.style.opacity = '1';
    card4.style.filter = 'none';
    card4.style.opacity = '1';

    // Hide bubbles, connectors, toast, cursor, and confetti
    bubbleCalendar.style.opacity = 0;
    bubbleCalendar.style.transform = 'scale(0)';
    bubbleDownloads.style.opacity = 0;
    bubbleDownloads.style.transform = 'scale(0)';
    bubbleCourse.style.opacity = 0;
    bubbleCourse.style.transform = 'scale(0)';
    bubbleDecor.style.opacity = 0;
    bubbleDecor.style.transform = 'scale(0)';

    connectorsSvg.style.opacity = 0;
    celebrationToast.classList.remove('active');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    virtualCursor.style.display = 'none';
    cursorRipple.classList.remove('click-wave');
    btnGetStarted.classList.remove('clicked');

    // Phone rests straight in the center
    const entryProg = Math.min(1, frame / 20);
    const y = lerp(580, 0, easeOutBack(entryProg));
    phoneWrapper.style.opacity = 1;
    phoneWrapper.style.transform = `translate3d(0, ${y + globalFloat}px, 0) rotateY(0deg) rotateX(0deg)`;

    // Cards are stacked on top of phone (Normal Layout)
    card1.style.transform = `translate3d(0, ${globalFloat}px, 50px) rotateY(0deg) rotateX(0deg)`;
    card2.style.transform = `translate3d(0, 0, 30px) rotateY(0deg) rotateX(0deg)`;
    card3.style.transform = `translate3d(0, 0, 15px) rotateY(0deg) rotateX(0deg)`;
    card4.style.transform = `translate3d(0, 0, 40px) rotateY(0deg) rotateX(0deg)`;
  }

  // -------------------------------------------------------------
  // PHASE 2: 3D Zomato Tilt & Glass Bubbles Expansion (Frames 60 to 135)
  // -------------------------------------------------------------
  if (frame >= PHASE_START_2 && frame < PHASE_START_3) {
    celebrationToast.classList.remove('active');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    virtualCursor.style.display = 'none';
    cursorRipple.classList.remove('click-wave');
    btnGetStarted.classList.remove('clicked');

    // Interpolation for 3D Phone Tilt and Slide-Out Screen (Frames 60 to 95)
    const tiltProg = Math.min(1, (frame - 60) / 35);
    const rotateY = lerp(0, -24, easeInOutQuad(tiltProg));
    const rotateX = lerp(0, 12, easeInOutQuad(tiltProg));
    const tx = lerp(0, -60, easeInOutQuad(tiltProg));

    phoneWrapper.style.transform = `translate3d(${tx}px, ${globalFloat}px, 0) rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;

    // Secondary Screen expands out to the right
    const secScreenTx = lerp(0, 145, easeInOutQuad(tiltProg));
    const secScreenRotY = lerp(0, -8, easeInOutQuad(tiltProg));
    secondaryScreen.style.opacity = tiltProg;
    secondaryScreen.style.transform = `translate3d(${secScreenTx}px, 0, -40px) rotateY(${secScreenRotY}deg)`;

    // Cards follow 3D phone rotation & drift
    card1.style.transform = `translate3d(${tx}px, ${globalFloat}px, 70px) rotateY(${rotateY + 8}deg) rotateX(${rotateX + 4}deg)`;
    card2.style.transform = `translate3d(${tx}px, ${Math.sin(((frame + 20) / 18) * Math.PI) * 2}px, 45px) rotateY(${rotateY + 8}deg) rotateX(${rotateX + 4}deg)`;
    card3.style.transform = `translate3d(${tx}px, ${Math.sin(((frame + 40) / 20) * Math.PI) * 2}px, 25px) rotateY(${rotateY + 8}deg) rotateX(${rotateX + 4}deg)`;
    card4.style.transform = `translate3d(${tx}px, ${Math.sin(((frame + 10) / 16) * Math.PI) * 3}px, 55px) rotateY(${rotateY - 10}deg) rotateX(${rotateX + 4}deg)`;

    // Staggered Bubbles Expansion
    const bubbleProg = Math.min(1, (frame - 60) / 35);
    const easeBubble = easeOutCubic(bubbleProg);
    const scaleBubble = easeOutBack(bubbleProg);

    // Show Bubble Connectors SVG
    connectorsSvg.style.opacity = bubbleProg;
    const pathOffset = lerp(800, 0, easeBubble);
    pathCourse.style.strokeDashoffset = pathOffset;
    pathCalendar.style.strokeDashoffset = pathOffset;
    pathDownloads.style.strokeDashoffset = pathOffset;

    // Calendar Bubble (left top) - spawns from Card 2 (dx=220, dy=196)
    if (frame >= 60) {
      const p = Math.min(1, (frame - 60) / 32);
      const bScale = easeOutBack(p);
      const bTx = lerp(220, 0, easeOutCubic(p));
      const bTy = lerp(196, 0, easeOutCubic(p));
      bubbleCalendar.style.opacity = p;
      bubbleCalendar.style.transform = `translate3d(${bTx}px, ${bTy + Math.sin((frame / 18) * Math.PI) * 4}px, 120px) scale(${bScale})`;
    }

    // Downloads Bubble (left bottom) - spawns from Card 3 (dx=225, dy=61)
    if (frame >= 72) {
      const p = Math.min(1, (frame - 72) / 32);
      const bScale = easeOutBack(p);
      const bTx = lerp(225, 0, easeOutCubic(p));
      const bTy = lerp(61, 0, easeOutCubic(p));
      bubbleDownloads.style.opacity = p;
      bubbleDownloads.style.transform = `translate3d(${bTx}px, ${bTy + Math.cos((frame / 20) * Math.PI) * 3}px, 110px) scale(${bScale})`;
    }

    // Course Bubble (right top) - spawns from Card 1 (dx=-428, dy=22)
    if (frame >= 66) {
      const p = Math.min(1, (frame - 66) / 32);
      const bScale = easeOutBack(p);
      const bTx = lerp(-428, 0, easeOutCubic(p));
      const bTy = lerp(22, 0, easeOutCubic(p));
      bubbleCourse.style.opacity = p;
      bubbleCourse.style.transform = `translate3d(${bTx}px, ${bTy + Math.sin((frame / 16) * Math.PI) * 5}px, 130px) scale(${bScale})`;
    }

    // Decorative Bubble (bottom right)
    if (frame >= 80) {
      const p = Math.min(1, (frame - 80) / 30);
      bubbleDecor.style.opacity = p * 0.7;
      bubbleDecor.style.transform = `translate3d(${Math.sin((frame / 22) * Math.PI) * 3}px, ${Math.cos((frame / 22) * Math.PI) * 3}px, 40px) scale(${easeOutBack(p)})`;
    }
  }

  // -------------------------------------------------------------
  // PHASE 3: Straight Back & Cursor Click (Frames 135 to 195)
  // -------------------------------------------------------------
  if (frame >= PHASE_START_3 && frame < PHASE_START_4) {
    celebrationToast.classList.remove('active');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Zoom wrapper remains normal
    zoomWrapper.style.transform = `scale(1) translate3d(0, 0, 0)`;
    phoneShell.style.filter = 'none';
    phoneShell.style.opacity = '1';

    // Phone rotates back to straight position (Frames 135 to 160)
    const straightProg = Math.min(1, (frame - 135) / 25);
    const rotateY = lerp(-24, 0, easeInOutQuad(straightProg));
    const rotateX = lerp(12, 0, easeInOutQuad(straightProg));
    const tx = lerp(-60, 0, easeInOutQuad(straightProg));

    phoneWrapper.style.transform = `translate3d(${tx}px, ${globalFloat}px, 0) rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;

    // Secondary screen slides back behind the phone
    const secScreenTx = lerp(145, 0, easeInOutQuad(straightProg));
    secondaryScreen.style.opacity = 1 - straightProg;
    secondaryScreen.style.transform = `translate3d(${secScreenTx}px, 0, -10px)`;

    // Cards follow phone rotation
    card1.style.transform = `translate3d(${tx}px, ${globalFloat}px, 50px) rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;
    card2.style.transform = `translate3d(${tx}px, 0, 30px) rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;
    card3.style.transform = `translate3d(${tx}px, 0, 15px) rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;
    card4.style.transform = `translate3d(${tx}px, 0, 40px) rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;

    // Glass bubbles and connectors shrink and fade away
    const shrinkBubble = 1 - straightProg;
    bubbleCalendar.style.opacity = shrinkBubble;
    bubbleCalendar.style.transform = `scale(${shrinkBubble})`;
    bubbleDownloads.style.opacity = shrinkBubble;
    bubbleDownloads.style.transform = `scale(${shrinkBubble})`;
    bubbleCourse.style.opacity = shrinkBubble;
    bubbleCourse.style.transform = `scale(${shrinkBubble})`;
    bubbleDecor.style.opacity = shrinkBubble;
    bubbleDecor.style.transform = `scale(${shrinkBubble})`;
    connectorsSvg.style.opacity = shrinkBubble;

    // Virtual Cursor slides in to click button (target button: x=450, y=312)
    let cx, cy;
    const moveEndFrame = 170;
    const clickDuration = 8;

    if (frame < moveEndFrame) {
      const t = (frame - 150) / (moveEndFrame - 150);
      if (t >= 0) {
        cx = lerp(950, 450, easeOutCubic(t));
        cy = lerp(500, 312, easeOutCubic(t));
        virtualCursor.style.display = 'block';
      } else {
        virtualCursor.style.display = 'none';
      }
      cursorRipple.classList.remove('click-wave');
      btnGetStarted.classList.remove('clicked');
    } else if (frame < moveEndFrame + clickDuration) {
      // Button Click
      cx = 450;
      cy = 312;
      virtualCursor.style.display = 'block';
      btnGetStarted.classList.add('clicked');
      cursorRipple.classList.add('click-wave');
    } else {
      // Retract cursor
      const t = (frame - (moveEndFrame + clickDuration)) / (PHASE_START_4 - (moveEndFrame + clickDuration));
      cx = lerp(450, 950, easeOutCubic(t));
      cy = lerp(312, 500, easeOutCubic(t));
      virtualCursor.style.display = 'block';
      btnGetStarted.classList.remove('clicked');
      cursorRipple.classList.remove('click-wave');
    }

    if (virtualCursor.style.display === 'block') {
      virtualCursor.style.transform = `translate3d(${cx}px, ${cy}px, 200px)`;
    }
  }

  // -------------------------------------------------------------
  // PHASE 4: Close-up Food Card Zoom & Confetti (Frames 195 to 240)
  // -------------------------------------------------------------
  if (frame >= PHASE_START_4) {
    virtualCursor.style.display = 'none';
    cursorRipple.classList.remove('click-wave');
    btnGetStarted.classList.remove('clicked');

    // Zoom in on Card 1 (scale 1.65x, center it)
    const zoomProg = Math.min(1, (frame - PHASE_START_4) / 20);
    const zScale = lerp(1, 1.65, easeOutCubic(zoomProg));
    const zTx = lerp(0, -60, easeOutCubic(zoomProg));
    const zTy = lerp(0, -100, easeOutCubic(zoomProg));

    zoomWrapper.style.transform = `scale(${zScale}) translate3d(${zTx}px, ${zTy}px, 0)`;

    // Blur all background elements (Phone shell and other cards)
    const blurVal = lerp(0, 12, easeOutCubic(zoomProg));
    const bgOpacity = lerp(1, 0.15, easeOutCubic(zoomProg));

    phoneShell.style.filter = `blur(${blurVal}px)`;
    phoneShell.style.opacity = bgOpacity;
    secondaryScreen.style.filter = `blur(${blurVal}px)`;
    secondaryScreen.style.opacity = 0;

    // Fade out and blur non-selected cards
    const cardBgOpacity = lerp(1, 0.1, easeOutCubic(zoomProg));
    card2.style.filter = `blur(${blurVal}px)`;
    card2.style.opacity = cardBgOpacity;
    card3.style.filter = `blur(${blurVal}px)`;
    card3.style.opacity = cardBgOpacity;
    card4.style.filter = `blur(${blurVal}px)`;
    card4.style.opacity = cardBgOpacity;

    // Keep Card 1 sharp and float it slightly
    card1.style.filter = 'none';
    card1.style.opacity = '1';
    card1.style.transform = `translate3d(0, ${globalFloat * 0.4}px, 120px) rotateY(0deg) rotateX(0deg)`;

    // Clear bubbles
    bubbleCalendar.style.opacity = 0;
    bubbleDownloads.style.opacity = 0;
    bubbleCourse.style.opacity = 0;
    bubbleDecor.style.opacity = 0;
    connectorsSvg.style.opacity = 0;

    // Show toast banner
    celebrationToast.classList.add('active');

    // Fire Confetti Pop relative to zoomed card center
    const confettiFrame = frame - (PHASE_START_4 + 8);
    if (confettiFrame > 0) {
      drawDeterministicConfetti(confettiFrame);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
}

// ── Playback Loop Ticker ──
function tick(timestamp) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  const elapsedMs = timestamp - lastTimestamp;
  lastTimestamp = timestamp;

  if (isPlaying) {
    const frameDelta = (elapsedMs / 1000) * FPS * playSpeed;
    currentFrame += frameDelta;

    if (currentFrame >= TOTAL_FRAMES) {
      currentFrame = 0;
    }

    updateShowcase(currentFrame);
  }

  requestAnimationFrame(tick);
}

// ── Control Panel Event Listeners ──
btnPlay.addEventListener('click', () => {
  isPlaying = !isPlaying;
  btnPlay.textContent = isPlaying ? 'Pause' : 'Play';
  btnPlay.classList.toggle('btn-primary', isPlaying);
  btnPlay.classList.toggle('btn-secondary', !isPlaying);
});

btnRestart.addEventListener('click', () => {
  currentFrame = 0;
  updateShowcase(0);
  if (!isPlaying) {
    isPlaying = true;
    btnPlay.textContent = 'Pause';
    btnPlay.classList.remove('btn-secondary');
    btnPlay.classList.add('btn-primary');
  }
});

speedBtns.forEach((btn) => {
  btn.addEventListener('click', (e) => {
    speedBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    playSpeed = parseFloat(btn.dataset.speed);
  });
});

slider.addEventListener('input', (e) => {
  currentFrame = parseInt(e.target.value, 10);
  updateShowcase(currentFrame);

  if (isPlaying) {
    isPlaying = false;
    btnPlay.textContent = 'Play';
    btnPlay.classList.remove('btn-primary');
    btnPlay.classList.add('btn-secondary');
  }
});

stepIndicators.forEach((ind) => {
  ind.addEventListener('click', () => {
    currentFrame = parseInt(ind.dataset.frame, 10);
    updateShowcase(currentFrame);
    
    if (isPlaying) {
      isPlaying = false;
      btnPlay.textContent = 'Play';
      btnPlay.classList.remove('btn-primary');
      btnPlay.classList.add('btn-secondary');
    }
  });
});

// Boot loop
updateShowcase(0);
requestAnimationFrame(tick);
