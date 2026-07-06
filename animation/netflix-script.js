// ═══════════════════════════════════════════════════════════
// NETFLIX — TUDUM CINEMATIC SHOWCASE — 45s ANIMATION
// ═══════════════════════════════════════════════════════════

const TOTAL_FRAMES = 1350; // 45s @ 30fps
const FPS = 30;

// Phase boundaries
const P1_START = 0;     // Profile Selection & Browse (0s – 12s)
const P2_START = 360;   // TUDUM N-Ribbon (12s – 21s)
const P3_START = 630;   // Content Reel / Still Watching (21s – 34s)
const P4_START = 1020;  // Brand Celebration (34s – 45s)

// Playback state
let currentFrame = 0;
let isPlaying = true;
let playSpeed = 1.0;
let lastTimestamp = 0;

// ── DOM References ──
const sceneProfiles = document.getElementById('scene-profiles');
const sceneTudum    = document.getElementById('scene-tudum');
const sceneReel     = document.getElementById('scene-reel');
const sceneBrand    = document.getElementById('scene-brand');

// Profile elements
const whoWatching    = document.getElementById('nf-who-watching');
const profileGrid    = document.getElementById('nf-profile-grid');
const profiles       = [
  document.getElementById('profile-1'),
  document.getElementById('profile-2'),
  document.getElementById('profile-3'),
  document.getElementById('profile-add')
];
const browseOverlay  = document.getElementById('nf-browse-overlay');
const navLinks       = document.querySelectorAll('#nf-nav-links .nf-nav-link');
const heroInfo       = document.getElementById('nf-hero-info');
const top10Row       = document.getElementById('nf-top10-row');
const cardRow        = document.getElementById('nf-card-row');

// TUDUM elements
const tudumFlash     = document.getElementById('tudum-flash');
const tudumN         = document.getElementById('tudum-n');
const nLeft          = document.getElementById('n-left');
const nDiag          = document.getElementById('n-diag');
const nRight         = document.getElementById('n-right');
const tudumRing1     = document.getElementById('tudum-ring-1');
const tudumRing2     = document.getElementById('tudum-ring-2');
const particlesCanvas = document.getElementById('tudum-particles');
const pCtx           = particlesCanvas.getContext('2d');

// Reel elements
const reelFilmstrip  = document.getElementById('reel-filmstrip');
const stillWatching  = document.getElementById('still-watching');

// Brand elements
const brandNLogo     = document.getElementById('brand-n-logo');
const brandTagline   = document.getElementById('brand-tagline');
const brandSubtitle  = document.getElementById('brand-subtitle');
const stats = [
  document.getElementById('stat-1'),
  document.getElementById('stat-2'),
  document.getElementById('stat-3'),
  document.getElementById('stat-4')
];

// Overlays
const virtualCursor  = document.getElementById('virtual-cursor');
const cursorRipple   = document.getElementById('cursor-ripple');
const confettiCanvas = document.getElementById('confetti-canvas');
const cCtx           = confettiCanvas.getContext('2d');

// Controls
const btnPlay        = document.getElementById('btn-play');
const btnRestart     = document.getElementById('btn-restart');
const speedBtns      = document.querySelectorAll('.speed-btn');
const slider         = document.getElementById('timeline-slider');
const currentTimeEl  = document.getElementById('current-time');
const stepIndicators = document.querySelectorAll('.step-indicator');

// ── Canvas Setup ──
function resizeCanvas() {
  confettiCanvas.width = 1024; confettiCanvas.height = 576;
  particlesCanvas.width = 1024; particlesCanvas.height = 576;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ── Helpers ──
function lerp(a, b, t) { return (1 - t) * a + t * b; }
function clamp01(t) { return Math.max(0, Math.min(1, t)); }
function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }
function easeOutBack(x) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
function easeInOutQuad(x) {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}
function easeOutQuint(x) { return 1 - Math.pow(1 - x, 5); }
function easeOutElastic(x) {
  if (x === 0 || x === 1) return x;
  return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
}

// ═══════════════════════════════════════════════════════════
// GENERATE CONTENT — Top 10 cards & Reel frames
// ═══════════════════════════════════════════════════════════
const SHOWS = [
  { title: 'Stranger Things', genre: 'SCI-FI', colors: ['#1a0a0a', '#3d0a0a'] },
  { title: 'Wednesday',       genre: 'MYSTERY', colors: ['#0a0a1a', '#1a1a3d'] },
  { title: 'Squid Game',      genre: 'THRILLER', colors: ['#0a1a0a', '#1a3d1a'] },
  { title: 'The Crown',       genre: 'DRAMA', colors: ['#1a1a0a', '#3d3d0a'] },
  { title: 'Money Heist',     genre: 'ACTION', colors: ['#1a0a0a', '#3d0a1a'] },
  { title: 'Bridgerton',      genre: 'ROMANCE', colors: ['#1a0a1a', '#3d0a3d'] },
  { title: 'Dark',            genre: 'MYSTERY', colors: ['#0a0a0a', '#1a1a1a'] },
  { title: 'Narcos',          genre: 'CRIME', colors: ['#0a1a0a', '#0a3d1a'] },
  { title: 'Ozark',           genre: 'DRAMA', colors: ['#0a0a1a', '#0a1a3d'] },
  { title: 'Black Mirror',    genre: 'SCI-FI', colors: ['#0a0a0a', '#1a1a2d'] }
];

// Generate Top 10 cards
function buildTop10Cards() {
  cardRow.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const show = SHOWS[i];
    const card = document.createElement('div');
    card.className = 'nf-card';
    card.id = `nf-card-${i}`;
    card.innerHTML = `
      <svg viewBox="0 0 130 180">
        <defs>
          <linearGradient id="card-g-${i}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${show.colors[0]}"/>
            <stop offset="100%" stop-color="${show.colors[1]}"/>
          </linearGradient>
        </defs>
        <rect width="130" height="180" fill="url(#card-g-${i})"/>
        <text x="65" y="100" font-size="11" fill="rgba(255,255,255,0.5)" text-anchor="middle" font-family="'Inter',sans-serif" font-weight="600">${show.title}</text>
      </svg>
      <span class="nf-card-number">${i + 1}</span>
    `;
    cardRow.appendChild(card);
  }
}
buildTop10Cards();

// Generate Film Reel frames (wider set for scrolling)
function buildReelFrames() {
  reelFilmstrip.innerHTML = '';
  const allShows = [...SHOWS, ...SHOWS, ...SHOWS]; // triple for seamless scroll
  for (let i = 0; i < allShows.length; i++) {
    const show = allShows[i % SHOWS.length];
    const frame = document.createElement('div');
    frame.className = 'reel-frame';
    frame.innerHTML = `
      <svg viewBox="0 0 280 160">
        <defs>
          <linearGradient id="reel-g-${i}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${show.colors[0]}"/>
            <stop offset="100%" stop-color="${show.colors[1]}"/>
          </linearGradient>
        </defs>
        <rect width="280" height="160" fill="url(#reel-g-${i})"/>
        <rect x="10" y="10" width="260" height="140" rx="4" fill="none" stroke="rgba(229,9,20,0.1)" stroke-width="1"/>
      </svg>
      <span class="reel-frame-genre">${show.genre}</span>
      <span class="reel-frame-label">${show.title}</span>
    `;
    reelFilmstrip.appendChild(frame);
  }
}
buildReelFrames();

// Build sprocket holes
function buildSprockets(container, count) {
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const hole = document.createElement('div');
    hole.className = 'sprocket-hole';
    container.appendChild(hole);
  }
}
buildSprockets(document.getElementById('sprockets-top'), 50);
buildSprockets(document.getElementById('sprockets-bottom'), 50);

// ═══════════════════════════════════════════════════════════
// TUDUM PARTICLE SYSTEM (red sparks)
// ═══════════════════════════════════════════════════════════
const PARTICLE_COUNT = 120;
const particleSeeds = [];
for (let i = 0; i < PARTICLE_COUNT; i++) {
  const angle = Math.random() * Math.PI * 2;
  const speed = 2 + Math.random() * 8;
  particleSeeds.push({
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 2,
    size: 1.5 + Math.random() * 3,
    color: Math.random() > 0.3 ? '#E50914' : (Math.random() > 0.5 ? '#ff3d3d' : '#ff8080'),
    life: 0.5 + Math.random() * 0.5,
    delay: Math.random() * 10
  });
}

function drawTudumParticles(t) {
  pCtx.clearRect(0, 0, 1024, 576);
  if (t <= 0) return;
  const cx = 512, cy = 288;
  
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = particleSeeds[i];
    const pt = t - p.delay;
    if (pt <= 0) continue;
    
    const x = cx + p.vx * pt * 3;
    const y = cy + p.vy * pt * 3 + 0.1 * pt * pt;
    const alpha = Math.max(0, 1 - pt / (40 * p.life));
    if (alpha <= 0) continue;
    
    pCtx.beginPath();
    pCtx.arc(x, y, p.size * (1 - pt / 80), 0, Math.PI * 2);
    pCtx.fillStyle = p.color;
    pCtx.globalAlpha = alpha;
    pCtx.fill();
  }
  pCtx.globalAlpha = 1;
}

// ═══════════════════════════════════════════════════════════
// CONFETTI SYSTEM (Netflix colors)
// ═══════════════════════════════════════════════════════════
const CONFETTI_COUNT = 100;
const confettiSeeds = [];
const confettiColors = ['#E50914', '#B20710', '#ffffff', '#ff3d3d', '#831010', '#ff8080', '#E50914'];

for (let i = 0; i < CONFETTI_COUNT; i++) {
  const angle = (1.3 + Math.abs(Math.sin(i * 432.1)) * 0.4) * Math.PI;
  const speed = 4 + Math.abs(Math.cos(i * 123.4)) * 14;
  confettiSeeds.push({
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: 5 + Math.abs(Math.sin(i * 987.6)) * 7,
    color: confettiColors[i % confettiColors.length],
    rotSpeed: -8 + Math.abs(Math.cos(i * 654.3)) * 16,
    rotOffset: Math.abs(Math.sin(i * 321.0)) * 360
  });
}

function drawConfetti(t) {
  cCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  if (t <= 0) return;
  const gravity = 0.35, startX = 512, startY = 260, groundY = 540;

  for (let i = 0; i < CONFETTI_COUNT; i++) {
    const s = confettiSeeds[i];
    let dx = s.vx * t, dy = s.vy * t + 0.5 * gravity * t * t;
    let cx = startX + dx, cy = startY + dy;

    if (cy > groundY) {
      const a = 0.5 * gravity, b = s.vy, c = startY - groundY;
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const tc = (-b + Math.sqrt(disc)) / (2 * a);
        if (t > tc) {
          const tp = t - tc;
          const vyc = s.vy + gravity * tc;
          cx = startX + s.vx * tc + s.vx * 0.7 * tp;
          cy = groundY + (-vyc * 0.35) * tp + 0.5 * gravity * tp * tp;
          if (cy > groundY) cy = groundY;
        }
      }
    }

    let opacity = 1.0;
    if (t > 25) opacity = Math.max(0, 1 - (t - 25) / 25);
    if (opacity <= 0) continue;

    const rot = (s.rotOffset + t * s.rotSpeed) * Math.PI / 180;
    cCtx.save();
    cCtx.translate(cx, cy);
    cCtx.rotate(rot);
    cCtx.fillStyle = s.color;
    cCtx.globalAlpha = opacity;
    cCtx.fillRect(-s.size / 2, -s.size / 2, s.size, s.size);
    cCtx.restore();
  }
}

// ═══════════════════════════════════════════════════════════
// SCENE MANAGEMENT
// ═══════════════════════════════════════════════════════════
function activateScene(name) {
  const configs = [
    { el: sceneProfiles, active: name === 'profiles' },
    { el: sceneTudum,    active: name === 'tudum' },
    { el: sceneReel,     active: name === 'reel' },
    { el: sceneBrand,    active: name === 'brand' }
  ];
  configs.forEach(cfg => {
    if (cfg.active) {
      cfg.el.classList.add('active');
    } else {
      cfg.el.classList.remove('active');
      cfg.el.style.opacity = ""; // Clear inline opacity override to prevent it blocking other scenes
    }
  });
}

function resetOverlays() {
  virtualCursor.style.display = 'none';
  cursorRipple.classList.remove('click-wave');
  cCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
}

// ═══════════════════════════════════════════════════════════
// MAIN UPDATE FUNCTION
// ═══════════════════════════════════════════════════════════
function updateShowcase(frame) {
  slider.value = Math.floor(frame);
  currentTimeEl.textContent = `${(frame / FPS).toFixed(2)}s`;

  // Step indicators
  stepIndicators.forEach((ind) => {
    const start = parseInt(ind.dataset.frame, 10);
    const idx = Array.from(stepIndicators).indexOf(ind);
    const next = stepIndicators[idx + 1] ? parseInt(stepIndicators[idx + 1].dataset.frame, 10) : TOTAL_FRAMES;
    ind.classList.toggle('active', frame >= start && frame < next);
  });

  const gFloat = Math.sin((frame / 16) * Math.PI) * 3;

  // ─────────────────────────────────────────────────
  // PHASE 1: Profile Selection & Browse (0 – 360)
  // ─────────────────────────────────────────────────
  if (frame >= P1_START && frame < P2_START) {
    activateScene('profiles');
    resetOverlays();
    pCtx.clearRect(0, 0, 1024, 576);

    // "Who's watching?" fades in (0-30)
    const whoT = clamp01(frame / 30);
    whoWatching.style.opacity = easeOutCubic(whoT);
    whoWatching.style.transform = `translateY(${lerp(-10, 0, easeOutCubic(whoT))}px)`;

    // Profiles appear staggered (20, 35, 50, 65)
    profiles.forEach((p, i) => {
      const startF = 20 + i * 15;
      const t = clamp01((frame - startF) / 20);
      p.style.opacity = easeOutCubic(t);
      p.style.transform = `scale(${lerp(0.8, 1, easeOutBack(t))})`;
    });

    // Cursor appears at frame 80, moves to profile 1
    if (frame >= 80 && frame < 140) {
      virtualCursor.style.display = 'block';
      const moveT = clamp01((frame - 80) / 20);
      const cx = lerp(700, 290, easeOutCubic(moveT));
      const cy = lerp(100, 260, easeOutCubic(moveT));
      virtualCursor.style.transform = `translate3d(${cx}px, ${cy}px, 200px)`;
    }

    // Click profile at frame 105
    if (frame >= 105 && frame < 115) {
      cursorRipple.classList.add('click-wave');
      profiles[0].classList.add('selected');
    } else if (frame >= 115) {
      cursorRipple.classList.remove('click-wave');
    }

    // Profile selected highlight
    profiles[0].classList.toggle('selected', frame >= 105);

    // Browse UI fades in at frame 130
    if (frame >= 130) {
      const browseT = clamp01((frame - 130) / 30);
      browseOverlay.style.opacity = easeOutCubic(browseT);
      
      // Profile grid fades out
      whoWatching.style.opacity = lerp(1, 0, browseT);
      profileGrid.style.opacity = lerp(1, 0, browseT);

      virtualCursor.style.display = 'none';
    } else {
      browseOverlay.style.opacity = '0';
    }

    // Nav links fade in staggered (160+)
    navLinks.forEach((link, i) => {
      const startF = 160 + i * 8;
      const t = clamp01((frame - startF) / 15);
      link.style.opacity = easeOutCubic(t);
    });

    // Hero info slides in (180+)
    if (frame >= 180) {
      const heroT = clamp01((frame - 180) / 30);
      heroInfo.style.opacity = easeOutCubic(heroT);
      heroInfo.style.transform = `translateY(${lerp(20, 0, easeOutCubic(heroT))}px)`;
    } else {
      heroInfo.style.opacity = '0';
      heroInfo.style.transform = 'translateY(20px)';
    }

    // Top 10 row slides in (230+)
    if (frame >= 230) {
      const rowT = clamp01((frame - 230) / 25);
      top10Row.style.opacity = easeOutCubic(rowT);
      top10Row.style.transform = `translateY(${lerp(20, 0, easeOutCubic(rowT))}px)`;

      // Cards slide in staggered
      for (let i = 0; i < 7; i++) {
        const card = document.getElementById(`nf-card-${i}`);
        if (!card) continue;
        const cardStart = 240 + i * 10;
        const ct = clamp01((frame - cardStart) / 18);
        card.style.opacity = easeOutCubic(ct);
        card.style.transform = `translateX(${lerp(40, 0, easeOutCubic(ct))}px)`;
      }
    } else {
      top10Row.style.opacity = '0';
    }

    // Play button cursor at frame 290, click at 310
    if (frame >= 290 && frame < 340) {
      virtualCursor.style.display = 'block';
      const moveT = clamp01((frame - 290) / 15);
      const cx = lerp(700, 120, easeOutCubic(moveT));
      const cy = lerp(100, 420, easeOutCubic(moveT));
      virtualCursor.style.transform = `translate3d(${cx}px, ${cy}px, 200px)`;
    }

    if (frame >= 310 && frame < 320) {
      cursorRipple.classList.add('click-wave');
    } else if (frame >= 320) {
      cursorRipple.classList.remove('click-wave');
    }

    // Fade to black for TUDUM (330-360)
    if (frame >= 330) {
      const fadeT = clamp01((frame - 330) / 30);
      sceneProfiles.style.filter = `brightness(${lerp(1, 0, fadeT)})`;
    } else {
      sceneProfiles.style.filter = 'brightness(1)';
    }
  }

  // ─────────────────────────────────────────────────
  // PHASE 2: TUDUM N-Ribbon (360 – 630)
  // ─────────────────────────────────────────────────
  if (frame >= P2_START && frame < P3_START) {
    activateScene('tudum');
    virtualCursor.style.display = 'none';
    cCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

    const localF = frame - P2_START;

    // Black pause (0-30 frames)
    if (localF < 30) {
      tudumN.style.opacity = '0';
      nLeft.setAttribute('opacity', '0');
      nDiag.setAttribute('opacity', '0');
      nRight.setAttribute('opacity', '0');
      tudumFlash.style.opacity = '0';
      pCtx.clearRect(0, 0, 1024, 576);
    }

    // N Left leg sweeps down (30-60)
    if (localF >= 30) {
      tudumN.style.opacity = '1';
      const t = clamp01((localF - 30) / 25);
      const scaleY = easeOutCubic(t);
      tudumN.style.transform = `scale(${lerp(0.6, 1, easeOutBack(clamp01((localF - 30) / 40)))})`;
      nLeft.setAttribute('opacity', scaleY.toString());
      nLeft.style.transformOrigin = '60px 0';
      nLeft.style.transform = `scaleY(${scaleY})`;
    }

    // N Diagonal sweeps (45-80)
    if (localF >= 45) {
      const t = clamp01((localF - 45) / 30);
      nDiag.setAttribute('opacity', easeOutCubic(t).toString());
    }

    // N Right leg (55-90)
    if (localF >= 55) {
      const t = clamp01((localF - 55) / 30);
      nRight.setAttribute('opacity', easeOutCubic(t).toString());
    }

    // TUDUM flash! (75-90)
    if (localF >= 75 && localF < 100) {
      const flashT = clamp01((localF - 75) / 4);
      const flashDecay = clamp01((localF - 79) / 20);
      tudumFlash.style.opacity = (flashT * (1 - flashDecay)).toString();
    } else {
      tudumFlash.style.opacity = '0';
    }

    // Pulse rings (80+)
    if (localF >= 80) {
      const r1T = clamp01((localF - 80) / 40);
      const r1Scale = lerp(1, 8, easeOutCubic(r1T));
      const r1Opacity = lerp(0.6, 0, r1T);
      tudumRing1.style.opacity = r1Opacity;
      tudumRing1.style.transform = `translate(-50%, -50%) scale(${r1Scale})`;
      tudumRing1.style.left = '50%';
      tudumRing1.style.top = '50%';
    } else {
      tudumRing1.style.opacity = '0';
    }

    if (localF >= 95) {
      const r2T = clamp01((localF - 95) / 40);
      const r2Scale = lerp(1, 7, easeOutCubic(r2T));
      const r2Opacity = lerp(0.4, 0, r2T);
      tudumRing2.style.opacity = r2Opacity;
      tudumRing2.style.transform = `translate(-50%, -50%) scale(${r2Scale})`;
      tudumRing2.style.left = '50%';
      tudumRing2.style.top = '50%';
    } else {
      tudumRing2.style.opacity = '0';
    }

    // Particles burst from N (80+)
    if (localF >= 80) {
      drawTudumParticles(localF - 80);
    } else {
      pCtx.clearRect(0, 0, 1024, 576);
    }

    // N floats and glows (100+)
    if (localF >= 100) {
      const breathe = Math.sin((localF / 20) * Math.PI) * 0.03;
      tudumN.style.transform = `scale(${1 + breathe}) translateY(${gFloat}px)`;
      tudumN.style.filter = `drop-shadow(0 0 ${60 + Math.sin(localF / 10) * 20}px rgba(229,9,20,0.5))`;
    }

    // Fade out N for scene 3 transition (240-270)
    if (localF >= 240) {
      const fadeT = clamp01((localF - 240) / 30);
      tudumN.style.opacity = lerp(1, 0, fadeT);
      pCtx.globalAlpha = 1 - fadeT;
    }
  }

  // ─────────────────────────────────────────────────
  // PHASE 3: Content Reel / Still Watching (630 – 1020)
  // ─────────────────────────────────────────────────
  if (frame >= P3_START && frame < P4_START) {
    activateScene('reel');
    virtualCursor.style.display = 'none';
    cCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    pCtx.clearRect(0, 0, 1024, 576);

    const localF = frame - P3_START;
    const totalReelFrames = P4_START - P3_START; // 390 frames

    // Film strip scrolling (continuous horizontal movement)
    const reelWidth = 30 * (280 + 16); // 30 frames * (width + gap)
    const scrollProgress = clamp01(localF / (totalReelFrames - 60));
    const scrollX = -scrollProgress * reelWidth * 0.5 + 200;
    reelFilmstrip.style.transform = `translateX(${scrollX}px) translateY(208px)`;

    // Reel entry fade
    if (localF < 30) {
      const t = clamp01(localF / 30);
      sceneReel.style.opacity = easeOutCubic(t);
    } else {
      sceneReel.style.opacity = '1';
    }

    // "Are you still watching?" popup (180-300)
    if (localF >= 180 && localF < 300) {
      const popT = clamp01((localF - 180) / 20);
      stillWatching.style.opacity = easeOutCubic(popT);
      stillWatching.style.transform = `translate(-50%, -50%) scale(${lerp(0.9, 1, easeOutBack(popT))})`;

      // Reel pauses (slows down) — handled by scroll math above becoming slower
      
      // Cursor appears, clicks "Continue Watching" at frame 260
      if (localF >= 240 && localF < 290) {
        virtualCursor.style.display = 'block';
        const moveT = clamp01((localF - 240) / 15);
        const cx = lerp(700, 490, easeOutCubic(moveT));
        const cy = lerp(150, 330, easeOutCubic(moveT));
        virtualCursor.style.transform = `translate3d(${cx}px, ${cy}px, 200px)`;
      }

      if (localF >= 260 && localF < 270) {
        cursorRipple.classList.add('click-wave');
      } else {
        cursorRipple.classList.remove('click-wave');
      }
    }
    
    // Dismiss popup (after click)
    if (localF >= 270) {
      const dismissT = clamp01((localF - 270) / 15);
      stillWatching.style.opacity = lerp(1, 0, dismissT);
      stillWatching.style.transform = `translate(-50%, -50%) scale(${lerp(1, 0.95, dismissT)})`;
      virtualCursor.style.display = 'none';
    }
    
    if (localF < 180) {
      stillWatching.style.opacity = '0';
    }

    // Fade to brand (370-390)
    if (localF >= 360) {
      const fadeT = clamp01((localF - 360) / 30);
      sceneReel.style.filter = `brightness(${lerp(1, 0, fadeT)})`;
    } else {
      sceneReel.style.filter = 'brightness(1)';
    }
  }

  // ─────────────────────────────────────────────────
  // PHASE 4: Brand Celebration (1020 – 1350)
  // ─────────────────────────────────────────────────
  if (frame >= P4_START) {
    activateScene('brand');
    virtualCursor.style.display = 'none';
    pCtx.clearRect(0, 0, 1024, 576);

    const localF = frame - P4_START;

    // N Logo rises (0-30)
    if (localF >= 0) {
      const t = clamp01(localF / 30);
      brandNLogo.style.opacity = easeOutCubic(t);
      brandNLogo.style.transform = `scale(${lerp(0.7, 1, easeOutBack(t))}) translateY(${lerp(20, 0, easeOutCubic(t))}px)`;
    }

    // Tagline (40-70)
    if (localF >= 40) {
      const t = clamp01((localF - 40) / 25);
      brandTagline.style.opacity = easeOutCubic(t);
      brandTagline.style.transform = `translateY(${lerp(20, 0, easeOutCubic(t))}px)`;
    } else {
      brandTagline.style.opacity = '0';
      brandTagline.style.transform = 'translateY(20px)';
    }

    // Subtitle (70-100)
    if (localF >= 70) {
      const t = clamp01((localF - 70) / 25);
      brandSubtitle.style.opacity = easeOutCubic(t);
      brandSubtitle.style.transform = `translateY(${lerp(15, 0, easeOutCubic(t))}px)`;
    } else {
      brandSubtitle.style.opacity = '0';
      brandSubtitle.style.transform = 'translateY(15px)';
    }

    // Stats staggered (100, 120, 140, 160)
    stats.forEach((el, i) => {
      const startF = 100 + i * 20;
      if (localF >= startF) {
        const t = clamp01((localF - startF) / 22);
        el.style.opacity = easeOutCubic(t);
        el.style.transform = `translateY(${lerp(15, 0, easeOutCubic(t))}px)`;
      } else {
        el.style.opacity = '0';
        el.style.transform = 'translateY(15px)';
      }
    });

    // Confetti at localF 80
    const confettiT = localF - 80;
    if (confettiT > 0) {
      drawConfetti(confettiT);
    } else {
      cCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }

    // N logo gentle float
    if (localF >= 30) {
      const breathe = Math.sin((localF / 20) * Math.PI) * 3;
      brandNLogo.style.transform = `scale(1) translateY(${breathe}px)`;
    }
  }
}

// ═══════════════════════════════════════════════════════════
// PLAYBACK ENGINE
// ═══════════════════════════════════════════════════════════
function tick(timestamp) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  const elapsedMs = Math.min(timestamp - lastTimestamp, 100); // Cap for tab-switch
  lastTimestamp = timestamp;

  if (isPlaying) {
    currentFrame += (elapsedMs / 1000) * FPS * playSpeed;
    if (currentFrame >= TOTAL_FRAMES) currentFrame = 0;
    updateShowcase(currentFrame);
  }
  requestAnimationFrame(tick);
}

// ── Controls ──
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
  btn.addEventListener('click', () => {
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

// ── URL param support ──
const urlParams = new URLSearchParams(window.location.search);
const frameParam = urlParams.get('frame');
if (frameParam !== null) {
  currentFrame = parseInt(frameParam, 10);
  isPlaying = false;
  btnPlay.textContent = 'Play';
  btnPlay.classList.remove('btn-primary');
  btnPlay.classList.add('btn-secondary');
}

// ── Boot ──
updateShowcase(currentFrame);
requestAnimationFrame(tick);
