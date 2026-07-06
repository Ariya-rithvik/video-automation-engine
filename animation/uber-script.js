// ═══════════════════════════════════════════════════════════
// UBER MOTO RIDE JOURNEY — 45s ANIMATION TIMELINE
// ═══════════════════════════════════════════════════════════

const TOTAL_FRAMES = 1350; // 45 seconds @ 30fps
const FPS = 30;

// Phase boundaries
const P1_START = 0;     // Phone App (0s – 8s)
const P2_START = 240;   // Book & Bike Burst (8s – 16s)
const P3_START = 480;   // Map Journey (16s – 32s)
const P4_START = 960;   // Brand Celebration (32s – 45s)

// Playback state
let currentFrame = 0;
let isPlaying = true;
let playSpeed = 1.0;
let lastTimestamp = 0;

// Caching to prevent layout thrashing
let lastTypedLen = -1;
let lastEta = -1;
let lastDist = -1;

// ── DOM References ──
const viewport = document.getElementById('showcase-viewport');

// Scenes
const scenePhone = document.getElementById('scene-phone');
const sceneMap   = document.getElementById('scene-map');
const sceneBrand = document.getElementById('scene-brand');

// Phone elements
const uberPhone     = document.getElementById('uber-phone');
const locationPin   = document.getElementById('location-pin');
const searchTyping  = document.getElementById('search-typing');
const rideOptions   = document.getElementById('ride-options');
const rideMoto      = document.getElementById('ride-moto');
const rideGo        = document.getElementById('ride-go');
const uberConfirm   = document.getElementById('uber-confirm');

// Bike burst
const bikeBurst = document.getElementById('bike-burst');

// Map elements
const driverRoute  = document.getElementById('driver-route');
const driverDot    = document.getElementById('driver-dot');
const homeMarker   = document.getElementById('home-marker');
const driverCard   = document.getElementById('driver-card');
const etaCard      = document.getElementById('eta-card');
const etaNumber    = document.getElementById('eta-number');
const distanceCard = document.getElementById('distance-card');
const distValue    = document.getElementById('distance-value');
const safetyCard   = document.getElementById('safety-card');

// Brand elements
const brandLogo     = document.getElementById('brand-logo');
const brandTagline  = document.getElementById('brand-tagline');
const brandSubtitle = document.getElementById('brand-subtitle');
const stat1 = document.getElementById('stat-1');
const stat2 = document.getElementById('stat-2');
const stat3 = document.getElementById('stat-3');

// Overlays
const virtualCursor    = document.getElementById('virtual-cursor');
const cursorRipple     = document.getElementById('cursor-ripple');
const celebrationToast = document.getElementById('celebration-toast');
const canvas           = document.getElementById('confetti-canvas');
const ctx              = canvas.getContext('2d');

// Controls
const btnPlay        = document.getElementById('btn-play');
const btnRestart     = document.getElementById('btn-restart');
const speedBtns      = document.querySelectorAll('.speed-btn');
const slider         = document.getElementById('timeline-slider');
const currentTimeEl  = document.getElementById('current-time');
const stepIndicators = document.querySelectorAll('.step-indicator');

// ── Canvas Setup ──
function resizeCanvas() {
  canvas.width = 1024;
  canvas.height = 576;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ── Helper Functions ──
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

// ── Typewriter Text ──
const DESTINATION_TEXT = "Koramangala, Bangalore";

// ── Driver Route Path Length ──
let routeLength = 0;
try { routeLength = driverRoute.getTotalLength(); } catch(e) { routeLength = 900; }

// ── Confetti System (Uber colors) ──
const CONFETTI_COUNT = 100;
const confettiSeeds = [];
const confettiColors = ['#276EF1', '#06C167', '#ffffff', '#4A8AF4', '#000', '#34d399', '#276EF1'];

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
  ctx.clearRect(0, 0, canvas.width, canvas.height);
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
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.fillStyle = s.color;
    ctx.globalAlpha = opacity;
    ctx.fillRect(-s.size / 2, -s.size / 2, s.size, s.size);
    ctx.restore();
  }
}

// ── Scene Activation ──
function activateScene(name) {
  const configs = [
    { el: scenePhone, active: name === 'phone' },
    { el: sceneMap,   active: name === 'map' },
    { el: sceneBrand, active: name === 'brand' }
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

// ── Hide All Overlays ──
function resetOverlays() {
  virtualCursor.style.display = 'none';
  cursorRipple.classList.remove('click-wave');
  celebrationToast.classList.remove('active');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  bikeBurst.style.opacity = '0';
  bikeBurst.style.transform = 'translate(-50%,-50%) scale(0)';
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

  const gFloat = Math.sin((frame / 16) * Math.PI) * 4;

  // ─────────────────────────────────────────────────
  // PHASE 1: Uber Phone App (Frames 0 – 240 / 0s – 8s)
  // ─────────────────────────────────────────────────
  if (frame >= P1_START && frame < P2_START) {
    activateScene('phone');
    resetOverlays();

    // Phone entry bounce (first 30 frames)
    const entryT = clamp01(frame / 25);
    const entryY = lerp(600, 0, easeOutBack(entryT));
    uberPhone.style.opacity = '1';
    uberPhone.style.transform = `translate3d(0, ${entryY + gFloat}px, 0) rotateY(0deg)`;

    // Typewriter: starts at frame 40, types over 120 frames
    if (frame >= 40) {
      const typeProg = clamp01((frame - 40) / 120);
      const charCount = Math.floor(typeProg * DESTINATION_TEXT.length);
      if (charCount !== lastTypedLen) {
        searchTyping.textContent = DESTINATION_TEXT.substring(0, charCount);
        lastTypedLen = charCount;
      }
    } else {
      if (lastTypedLen !== 0) { searchTyping.textContent = ''; lastTypedLen = 0; }
    }

    // Location pin drops at frame 130
    if (frame >= 130) {
      const pinT = clamp01((frame - 130) / 15);
      const pinScale = easeOutBack(pinT);
      locationPin.style.transform = `translate(-50%, -100%) scale(${pinScale})`;
    } else {
      locationPin.style.transform = 'translate(-50%, -100%) scale(0)';
    }

    // Ride options slide up at frame 160
    if (frame >= 160) {
      const slideT = clamp01((frame - 160) / 20);
      rideOptions.style.opacity = slideT;
      rideOptions.style.transform = `translateY(${lerp(20, 0, easeOutCubic(slideT))}px)`;
    } else {
      rideOptions.style.opacity = '0';
      rideOptions.style.transform = 'translateY(20px)';
    }

    // Select Moto at frame 190
    rideMoto.classList.toggle('selected', frame >= 190);
    rideGo.classList.remove('selected');

    // Show confirm button at frame 200
    if (frame >= 200) {
      uberConfirm.classList.add('visible');
      uberConfirm.classList.add('active-btn');
    } else {
      uberConfirm.classList.remove('visible');
      uberConfirm.classList.remove('active-btn');
    }
    uberConfirm.classList.remove('clicked');

    // Virtual cursor: appears at frame 210, moves to confirm, clicks at 225
    if (frame >= 210) {
      virtualCursor.style.display = 'block';
      const moveT = clamp01((frame - 210) / 12);
      const cx = lerp(700, 512, easeOutCubic(moveT));
      const cy = lerp(150, 450, easeOutCubic(moveT));
      virtualCursor.style.transform = `translate3d(${cx}px, ${cy}px, 200px)`;

      if (frame >= 225 && frame < 233) {
        uberConfirm.classList.add('clicked');
        cursorRipple.classList.add('click-wave');
      } else {
        uberConfirm.classList.remove('clicked');
        cursorRipple.classList.remove('click-wave');
      }
    }
  }

  // ─────────────────────────────────────────────────
  // PHASE 2: Book & Bike Burst (Frames 240 – 480 / 8s – 16s)
  // ─────────────────────────────────────────────────
  if (frame >= P2_START && frame < P3_START) {
    celebrationToast.classList.remove('active');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    virtualCursor.style.display = 'none';
    cursorRipple.classList.remove('click-wave');

    // Sub-phase A: Phone confirmation flash & shrink (240-360)
    if (frame < 360) {
      activateScene('phone');
      
      // Phone screen confirmation flash
      const flashT = clamp01((frame - 240) / 10);
      if (flashT < 1) {
        uberConfirm.style.background = `rgba(6,193,103,${0.3 + flashT * 0.7})`;
      }

      // Phone shrinks and rotates
      const shrinkT = clamp01((frame - 260) / 80);
      const phoneScale = lerp(1, 0, easeInOutQuad(shrinkT));
      const phoneRot = lerp(0, 15, easeInOutQuad(shrinkT));
      const phoneOpacity = lerp(1, 0, easeInOutQuad(shrinkT));

      uberPhone.style.transform = `translate3d(0, ${gFloat}px, 0) scale(${phoneScale}) rotateZ(${phoneRot}deg)`;
      uberPhone.style.opacity = phoneOpacity;

      // Bike burst grows from center (starts at 290)
      if (frame >= 290) {
        const burstT = clamp01((frame - 290) / 50);
        const bikeScale = lerp(0, 1.1, easeOutBack(burstT));
        bikeBurst.style.opacity = burstT;
        bikeBurst.style.transform = `translate(-50%, -50%) scale(${bikeScale})`;
      }
    }
    // Sub-phase B: Bike floating center stage (360-420)
    else if (frame < 420) {
      activateScene('phone'); // keep scene for overlay
      scenePhone.style.opacity = '0.01'; // essentially invisible but present

      uberPhone.style.opacity = '0';

      // Bike floats with gentle bob
      const bikeY = Math.sin((frame / 12) * Math.PI) * 6;
      bikeBurst.style.opacity = '1';
      bikeBurst.style.transform = `translate(-50%, calc(-50% + ${bikeY}px)) scale(1.1)`;
      bikeBurst.style.filter = `drop-shadow(0 0 30px rgba(39,110,241,0.5))`;
    }
    // Sub-phase C: Bike shrinks, map fades in (420-480)
    else {
      const fadeT = clamp01((frame - 420) / 40);
      
      // Bike shrinks out
      const bikeScale = lerp(1.1, 0.3, easeInOutQuad(fadeT));
      const bikeOpacity = lerp(1, 0, easeInOutQuad(fadeT));
      bikeBurst.style.opacity = bikeOpacity;
      bikeBurst.style.transform = `translate(-50%, -50%) scale(${bikeScale})`;

      // Map scene fades in
      scenePhone.classList.remove('active');
      sceneMap.classList.add('active');
      sceneMap.style.opacity = fadeT;

      // Reset map cards
      driverCard.style.opacity = '0';
      etaCard.style.opacity = '0';
      distanceCard.style.opacity = '0';
      safetyCard.style.opacity = '0';
    }

    // Reset brand scene
    sceneBrand.classList.remove('active');
  }

  // ─────────────────────────────────────────────────
  // PHASE 3: Map Journey (Frames 480 – 960 / 16s – 32s)
  // ─────────────────────────────────────────────────
  if (frame >= P3_START && frame < P4_START) {
    activateScene('map');
    sceneMap.style.opacity = '1';
    bikeBurst.style.opacity = '0';
    celebrationToast.classList.remove('active');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    virtualCursor.style.display = 'none';

    // Driver dot follows route path
    const journeyT = clamp01((frame - P3_START) / (P4_START - P3_START));
    const journeyEased = easeInOutQuad(journeyT);
    const distAlong = journeyEased * routeLength;

    try {
      const pt = driverRoute.getPointAtLength(distAlong);
      driverDot.setAttribute('transform', `translate(${pt.x}, ${pt.y})`);
    } catch(e) {
      // fallback
      const fx = lerp(80, 880, journeyEased);
      const fy = lerp(400, 300, journeyEased);
      driverDot.setAttribute('transform', `translate(${fx}, ${fy})`);
    }

    // Driver info card appears at frame 510
    if (frame >= 510) {
      const t = clamp01((frame - 510) / 20);
      driverCard.style.opacity = t;
      driverCard.style.transform = `translateY(${lerp(10, 0, easeOutCubic(t))}px)`;
    }

    // ETA card appears at frame 540
    if (frame >= 540) {
      const t = clamp01((frame - 540) / 20);
      etaCard.style.opacity = t;
      etaCard.style.transform = `translateY(${lerp(10, 0, easeOutCubic(t))}px)`;

      // Update ETA number
      const eta = Math.max(1, Math.ceil(5 * (1 - journeyT)));
      if (eta !== lastEta) {
        etaNumber.textContent = eta;
        lastEta = eta;
      }
    }

    // Distance card at frame 570
    if (frame >= 570) {
      const t = clamp01((frame - 570) / 20);
      distanceCard.style.opacity = t;
      distanceCard.style.transform = `translateY(${lerp(10, 0, easeOutCubic(t))}px)`;

      // Update distance
      const dist = (3.2 * (1 - journeyT)).toFixed(1);
      if (dist !== lastDist) {
        distValue.textContent = dist;
        lastDist = dist;
      }
    }

    // Safety card at frame 600
    if (frame >= 600) {
      const t = clamp01((frame - 600) / 20);
      safetyCard.style.opacity = t;
      safetyCard.style.transform = `translateY(${lerp(10, 0, easeOutCubic(t))}px)`;
    }

    // "Arriving now" — pulse home marker near end
    if (frame >= 900) {
      const pulseT = ((frame - 900) / 10) % 1;
      const pulseScale = 1 + Math.sin(pulseT * Math.PI) * 0.15;
      homeMarker.setAttribute('transform', `translate(880, 280) scale(${pulseScale})`);
      
      // Update ETA to "Arriving"
      if (lastEta !== 0) {
        etaNumber.textContent = '✓';
        etaNumber.style.color = '#06C167';
        lastEta = 0;
      }
      // Update distance
      if (lastDist !== '0.0') {
        distValue.textContent = '0.0';
        lastDist = '0.0';
      }
    } else {
      homeMarker.setAttribute('transform', 'translate(880, 280) scale(1)');
      etaNumber.style.color = '#276EF1';
    }
  }

  // ─────────────────────────────────────────────────
  // PHASE 4: Brand Celebration (Frames 960 – 1350 / 32s – 45s)
  // ─────────────────────────────────────────────────
  if (frame >= P4_START) {
    activateScene('brand');
    bikeBurst.style.opacity = '0';
    virtualCursor.style.display = 'none';

    // Arrival merge pulse (960-990)
    if (frame < 990) {
      sceneMap.classList.add('active');
      const mergeT = clamp01((frame - 960) / 30);

      // Flash effect on map
      sceneMap.style.opacity = lerp(1, 0, easeOutCubic(mergeT));
      sceneBrand.style.opacity = mergeT;
    } else {
      sceneMap.classList.remove('active');
    }

    // Brand logo (frame 990)
    if (frame >= 990) {
      const t = clamp01((frame - 990) / 25);
      brandLogo.style.opacity = t;
      brandLogo.style.transform = `scale(${lerp(0.8, 1, easeOutBack(t))})`;
    } else {
      brandLogo.style.opacity = '0';
      brandLogo.style.transform = 'scale(0.8)';
    }

    // Tagline (frame 1030)
    if (frame >= 1030) {
      const t = clamp01((frame - 1030) / 25);
      brandTagline.style.opacity = t;
      brandTagline.style.transform = `translateY(${lerp(20, 0, easeOutCubic(t))}px)`;
    } else {
      brandTagline.style.opacity = '0';
      brandTagline.style.transform = 'translateY(20px)';
    }

    // Subtitle (frame 1060)
    if (frame >= 1060) {
      const t = clamp01((frame - 1060) / 25);
      brandSubtitle.style.opacity = t;
      brandSubtitle.style.transform = `translateY(${lerp(15, 0, easeOutCubic(t))}px)`;
    } else {
      brandSubtitle.style.opacity = '0';
      brandSubtitle.style.transform = 'translateY(15px)';
    }

    // Stats (staggered: 1100, 1120, 1140)
    [stat1, stat2, stat3].forEach((el, i) => {
      const startF = 1100 + i * 20;
      if (frame >= startF) {
        const t = clamp01((frame - startF) / 20);
        el.style.opacity = t;
        el.style.transform = `translateY(${lerp(15, 0, easeOutCubic(t))}px)`;
      } else {
        el.style.opacity = '0';
        el.style.transform = 'translateY(15px)';
      }
    });

    // Toast at frame 1080
    if (frame >= 1080) {
      celebrationToast.classList.add('active');
    } else {
      celebrationToast.classList.remove('active');
    }

    // Confetti at frame 1050
    const confettiT = frame - 1050;
    if (confettiT > 0) {
      drawConfetti(confettiT);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
}

// ═══════════════════════════════════════════════════════════
// PLAYBACK ENGINE
// ═══════════════════════════════════════════════════════════
function tick(timestamp) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  const elapsedMs = timestamp - lastTimestamp;
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
  lastTypedLen = -1; lastEta = -1; lastDist = -1;
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
  lastTypedLen = -1; lastEta = -1; lastDist = -1;
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
    lastTypedLen = -1; lastEta = -1; lastDist = -1;
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
