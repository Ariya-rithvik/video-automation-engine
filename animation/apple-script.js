// ═══════════════════════════════════════════════════════════
// APPLE — THINK DIFFERENT SHOWCASE — 45s ANIMATION
// ═══════════════════════════════════════════════════════════

const TOTAL_FRAMES = 1800; // 60s @ 30fps
const FPS = 30;

// Phase boundaries
const P1_START = 0;     // Keynote Stage (0s – 12s)
const P2_START = 360;   // iPhone Line-Draw (12s – 24s)
const P3_START = 720;   // Ecosystem Arc (24s – 36s)
const P4_START = 1080;  // Brand Celebration (36s – 48s)
const P5_START = 1440;  // AI Partnership (Apple + Google) (48s – 60s)

// Playback state
let currentFrame = 0;
let isPlaying = true;
let playSpeed = 1.0;
let lastTimestamp = 0;

// ── DOM References ──
const sceneKeynote   = document.getElementById('scene-keynote');
const sceneLinedraw  = document.getElementById('scene-linedraw');
const sceneEcosystem = document.getElementById('scene-ecosystem');
const sceneBrand     = document.getElementById('scene-brand');

// Scene 1: Keynote Stage
const spotLeft       = document.getElementById('spot-left');
const spotCenter     = document.getElementById('spot-center');
const spotRight      = document.getElementById('spot-right');
const keynoteScreen  = document.getElementById('keynote-screen');
const keynoteLogoWrap = document.getElementById('keynote-logo-wrap');
const appleLogoPath  = document.getElementById('apple-logo-path');
const logoGlowCircle = document.getElementById('logo-glow-circle');
const keynoteOmt     = document.getElementById('keynote-omt');
const keynoteProduct = document.getElementById('keynote-product');
const audienceCanvas = document.getElementById('audience-canvas');
const aCtx           = audienceCanvas.getContext('2d');

// Scene 2: iPhone Line-Draw
const linedrawCanvas = document.getElementById('linedraw-canvas');
const lCtx           = linedrawCanvas.getContext('2d');

// Scene 3: Ecosystem
const ecosystemParticles = document.getElementById('ecosystem-particles');
const epCtx              = ecosystemParticles.getContext('2d');
const ecoIphone      = document.getElementById('eco-iphone');
const ecoIpad        = document.getElementById('eco-ipad');
const ecoMacbook     = document.getElementById('eco-macbook');
const ecoWatch       = document.getElementById('eco-watch');
const ecoAirpods     = document.getElementById('eco-airpods');
const ecoCalifornia  = document.getElementById('eco-california');

// Scene 4: Brand
const brandLogo      = document.getElementById('brand-apple-logo');
const brandTagline   = document.getElementById('brand-tagline');
const brandSubtitle  = document.getElementById('brand-subtitle');
const stat1          = document.getElementById('stat-1');
const stat2          = document.getElementById('stat-2');
const stat3          = document.getElementById('stat-3');
const stat4          = document.getElementById('stat-4');
const confettiCanvas = document.getElementById('confetti-canvas');
const cCtx           = confettiCanvas.getContext('2d');

// Scene 5: AI Partnership
const sceneAiPartnership = document.getElementById('scene-ai-partnership');
const aiAppleOutline     = document.getElementById('ai-apple-outline');
const aiGoogleOutline     = document.getElementById('ai-google-outline');
const aiStarFlare        = document.getElementById('ai-star-flare');
const aiTagline          = document.getElementById('ai-partnership-tagline');
const aiSubtitle         = document.getElementById('ai-partnership-subtitle');
const aiFlashOverlay     = document.getElementById('ai-flash-overlay');

// Global Controls
const btnPlay        = document.getElementById('btn-play');
const btnRestart     = document.getElementById('btn-restart');
const speedBtns      = document.querySelectorAll('.speed-btn');
const slider         = document.getElementById('timeline-slider');
const currentTimeEl  = document.getElementById('current-time');
const stepIndicators = document.querySelectorAll('.step-indicator');

// ── Canvas Setup ──
function resizeCanvas() {
  audienceCanvas.width = 1024; audienceCanvas.height = 80;
  linedrawCanvas.width = 1024; linedrawCanvas.height = 576;
  ecosystemParticles.width = 1024; ecosystemParticles.height = 576;
  confettiCanvas.width = 1024; confettiCanvas.height = 576;
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
function easeOutBackScale(x, start, end) {
  return lerp(start, end, easeOutBack(x));
}

// ═══════════════════════════════════════════════════════════
// ACTIVE SCENE MANAGER
// ═══════════════════════════════════════════════════════════
function activateScene(activeScene) {
  const scenes = [sceneKeynote, sceneLinedraw, sceneEcosystem, sceneBrand, sceneAiPartnership];
  scenes.forEach(scene => {
    if (scene === activeScene) {
      scene.classList.add('active');
    } else {
      scene.classList.remove('active');
      scene.style.opacity = ""; // Clear inline opacity override to prevent it blocking other scenes
    }
  });
}

// ═══════════════════════════════════════════════════════════
// SCENE 1: KEYNOTE AUDIENCE APPLAUSE DRAWING
// ═══════════════════════════════════════════════════════════
function drawAudienceApplause(frame, active) {
  aCtx.clearRect(0, 0, 1024, 80);
  if (!active) return;

  const w = 1024;
  const h = 80;
  const numPeople = 60;
  const gap = w / numPeople;

  aCtx.fillStyle = 'rgba(255, 255, 255, 0.08)';

  // Draw audience silhouettes bouncing slightly
  for (let i = 0; i < numPeople; i++) {
    const x = i * gap + gap/2;
    // Bouncing calculation based on sine + noise
    const bounceOffset = Math.sin(frame * 0.4 + i) * 6 * active;
    const size = 18 + Math.sin(i * 1.5) * 4;

    // Draw simple rounded silhouette head and shoulders
    aCtx.beginPath();
    aCtx.arc(x, h - size + bounceOffset, 7, 0, Math.PI * 2);
    aCtx.fill();

    aCtx.beginPath();
    aCtx.ellipse(x, h + 8 + bounceOffset, 14, 10, 0, 0, Math.PI * 2);
    aCtx.fill();
  }
}

// ═══════════════════════════════════════════════════════════
// SCENE 2: IPHONE LINE-DRAW REVEAL
// ═══════════════════════════════════════════════════════════
const iphonePoints = [];
function buildIphonePath() {
  // Center is (512, 288)
  const cx = 512, cy = 250;
  const w = 160, h = 330, r = 24;

  // Add Outer Border Rounded Rectangle points sequentially
  // Starts from top-left, moves clockwise
  // Top edge
  iphonePoints.push({ x: cx - w/2 + r, y: cy - h/2 });
  iphonePoints.push({ x: cx + w/2 - r, y: cy - h/2 });
  // Top-right corner
  for (let a = -Math.PI/2; a <= 0; a += 0.1) {
    iphonePoints.push({ x: cx + w/2 - r + Math.cos(a)*r, y: cy - h/2 + r + Math.sin(a)*r });
  }
  // Right edge
  iphonePoints.push({ x: cx + w/2, y: cy + h/2 - r });
  // Bottom-right corner
  for (let a = 0; a <= Math.PI/2; a += 0.1) {
    iphonePoints.push({ x: cx + w/2 - r + Math.cos(a)*r, y: cy + h/2 - r + Math.sin(a)*r });
  }
  // Bottom edge
  iphonePoints.push({ x: cx - w/2 + r, y: cy + h/2 });
  // Bottom-left corner
  for (let a = Math.PI/2; a <= Math.PI; a += 0.1) {
    iphonePoints.push({ x: cx - w/2 + r + Math.cos(a)*r, y: cy + h/2 - r + Math.sin(a)*r });
  }
  // Left edge
  iphonePoints.push({ x: cx - w/2, y: cy - h/2 + r });
  // Top-left corner
  for (let a = Math.PI; a <= 1.5 * Math.PI; a += 0.1) {
    iphonePoints.push({ x: cx - w/2 + r + Math.cos(a)*r, y: cy - h/2 + r + Math.sin(a)*r });
  }

  // Dynamic Island
  // Separator token to start new sub-path
  iphonePoints.push(null);
  const diX = cx, diY = cy - h/2 + 20, diW = 50, diH = 14, diR = 7;
  iphonePoints.push({ x: diX - diW/2 + diR, y: diY - diH/2 });
  iphonePoints.push({ x: diX + diW/2 - diR, y: diY - diH/2 });
  for (let a = -Math.PI/2; a <= Math.PI/2; a += 0.2) {
    iphonePoints.push({ x: diX + diW/2 - diR + Math.cos(a)*diR, y: diY + Math.sin(a)*diR });
  }
  iphonePoints.push({ x: diX - diW/2 + diR, y: diY + diH/2 });
  for (let a = Math.PI/2; a <= 1.5 * Math.PI; a += 0.2) {
    iphonePoints.push({ x: diX - diW/2 + diR + Math.cos(a)*diR, y: diY + Math.sin(a)*diR });
  }
}
buildIphonePath();

function drawIphoneLineDraw(progress, filledAlpha) {
  lCtx.clearRect(0, 0, 1024, 576);

  // Background
  lCtx.fillStyle = '#000000';
  lCtx.fillRect(0, 0, 1024, 576);

  // Draw outline path
  const numPoints = iphonePoints.length;
  const drawLimit = Math.floor(progress * numPoints);

  lCtx.save();
  lCtx.strokeStyle = '#ffffff';
  lCtx.lineWidth = 2.5;
  lCtx.shadowBlur = 12;
  lCtx.shadowColor = 'rgba(255,255,255,0.8)';
  lCtx.lineCap = 'round';
  lCtx.lineJoin = 'round';

  lCtx.beginPath();
  let first = true;
  for (let i = 0; i < drawLimit; i++) {
    const p = iphonePoints[i];
    if (p === null) {
      lCtx.stroke();
      lCtx.beginPath();
      first = true;
      continue;
    }
    if (first) {
      lCtx.moveTo(p.x, p.y);
      first = false;
    } else {
      lCtx.lineTo(p.x, p.y);
    }
  }
  lCtx.stroke();

  // Draw a bright, glowing drawing-tip dot at the active tip
  if (drawLimit > 0 && drawLimit < numPoints && iphonePoints[drawLimit] !== null) {
    const tip = iphonePoints[drawLimit];
    lCtx.beginPath();
    lCtx.arc(tip.x, tip.y, 5, 0, Math.PI * 2);
    lCtx.fillStyle = '#ffffff';
    lCtx.shadowBlur = 20;
    lCtx.shadowColor = '#00d4ff';
    lCtx.fill();
  }
  lCtx.restore();

  // Draw solid chassis fill & Screen icons after outline complete
  if (filledAlpha > 0) {
    lCtx.save();
    lCtx.globalAlpha = filledAlpha;

    const cx = 512, cy = 250;
    const w = 160, h = 330, r = 24;

    // Solid phone body backing
    lCtx.fillStyle = '#1d1d1f';
    lCtx.beginPath();
    lCtx.roundRect(cx - w/2, cy - h/2, w, h, r);
    lCtx.fill();

    // Screen light-up
    lCtx.fillStyle = '#090a10';
    lCtx.beginPath();
    lCtx.roundRect(cx - w/2 + 6, cy - h/2 + 6, w - 12, h - 12, r - 6);
    lCtx.fill();

    // Draw iOS simplified wallpaper (a subtle colorful diagonal blur gradient)
    const wallpaperGrad = lCtx.createLinearGradient(cx - w/2, cy - h/2, cx + w/2, cy + h/2);
    wallpaperGrad.addColorStop(0, '#5856d6');
    wallpaperGrad.addColorStop(0.5, '#ff2d55');
    wallpaperGrad.addColorStop(1, '#ff9500');
    lCtx.fillStyle = wallpaperGrad;
    lCtx.globalAlpha = filledAlpha * 0.15;
    lCtx.beginPath();
    lCtx.roundRect(cx - w/2 + 6, cy - h/2 + 6, w - 12, h - 12, r - 6);
    lCtx.fill();

    // Draw Dynamic Island
    lCtx.globalAlpha = filledAlpha;
    lCtx.fillStyle = '#000';
    lCtx.beginPath();
    lCtx.roundRect(cx - 25, cy - h/2 + 13, 50, 14, 7);
    lCtx.fill();

    // Draw colored application dots in grid
    const dotRows = 6;
    const dotCols = 4;
    const startX = cx - w/2 + 25;
    const startY = cy - h/2 + 50;
    const colGap = 36;
    const rowGap = 42;

    lCtx.globalAlpha = filledAlpha * 0.7;
    for (let r = 0; r < dotRows; r++) {
      for (let c = 0; c < dotCols; c++) {
        const dotX = startX + c * colGap;
        const dotY = startY + r * rowGap;

        // Choose nice iOS style app colors
        let color = '#34c759'; // Green
        if (r % 3 === 0) color = '#007aff';
        else if (r % 3 === 1) color = '#ff9500';
        else if (c % 2 === 0) color = '#af52de';

        lCtx.beginPath();
        lCtx.arc(dotX, dotY, 6, 0, Math.PI * 2);
        lCtx.fillStyle = color;
        lCtx.fill();
      }
    }
    lCtx.restore();
  }
}

// ═══════════════════════════════════════════════════════════
// SCENE 3: ECOSYSTEM NETWORK DRAWING
// ═══════════════════════════════════════════════════════════
const productLocations = {
  macbook: { x: 512, y: 250 },
  iphone:  { x: 300, y: 350 },
  ipad:    { x: 340, y: 160 },
  watch:   { x: 724, y: 170 },
  airpods: { x: 684, y: 360 }
};

function drawEcosystemNetwork(frame, progress) {
  epCtx.clearRect(0, 0, 1024, 576);
  if (progress <= 0) return;

  const center = productLocations.macbook;
  const leaves = [
    productLocations.iphone,
    productLocations.ipad,
    productLocations.watch,
    productLocations.airpods
  ];

  epCtx.save();
  epCtx.lineWidth = 1.5;
  epCtx.globalAlpha = progress * 0.35;

  leaves.forEach(leaf => {
    // Draw neon connecting lines
    const lineGrad = epCtx.createLinearGradient(center.x, center.y, leaf.x, leaf.y);
    lineGrad.addColorStop(0, '#ffffff');
    lineGrad.addColorStop(1, 'rgba(255,255,255,0.1)');
    epCtx.strokeStyle = lineGrad;

    epCtx.beginPath();
    epCtx.moveTo(center.x, center.y);
    epCtx.lineTo(leaf.x, leaf.y);
    epCtx.stroke();

    // Pulse signal dots traveling along lines
    const signalT = (frame * 0.02) % 1.0;
    const sx = lerp(center.x, leaf.x, signalT);
    const sy = lerp(center.y, leaf.y, signalT);

    epCtx.save();
    epCtx.globalAlpha = progress;
    epCtx.beginPath();
    epCtx.arc(sx, sy, 4.5, 0, Math.PI * 2);
    epCtx.fillStyle = '#ffffff';
    epCtx.shadowBlur = 10;
    epCtx.shadowColor = '#ffffff';
    epCtx.fill();
    epCtx.restore();
  });

  epCtx.restore();
}

// ═══════════════════════════════════════════════════════════
// CONFETTI SYSTEM (Apple minimalist white/silver)
// ═══════════════════════════════════════════════════════════
const CONFETTI_COUNT = 80;
const confettiSeeds = [];
for (let i = 0; i < CONFETTI_COUNT; i++) {
  confettiSeeds.push({
    x: Math.random() * 1024,
    y: Math.random() * -400,
    speed: 1.0 + Math.random() * 2.5,
    size: 2 + Math.random() * 4,
    osc: Math.random() * Math.PI,
    oscSpeed: 0.01 + Math.random() * 0.03,
    oscAmp: 8 + Math.random() * 12,
    opacity: 0.2 + Math.random() * 0.6
  });
}

function drawAppleConfetti(t) {
  cCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  if (t <= 0) return;

  cCtx.fillStyle = '#ffffff';

  for (let i = 0; i < CONFETTI_COUNT; i++) {
    const s = confettiSeeds[i];
    s.osc += s.oscSpeed;
    // vertical fall
    const fy = s.y + s.speed * t;
    const fx = s.x + Math.sin(s.osc) * s.oscAmp;

    if (fy > 576) {
      // wrap around
      s.y = -10;
      s.x = Math.random() * 1024;
    }

    let alpha = s.opacity;
    if (t > 250) alpha *= Math.max(0, 1 - (t - 250) / 70); // fade out at very end

    cCtx.globalAlpha = alpha;
    cCtx.beginPath();
    cCtx.arc(fx, fy, s.size, 0, Math.PI * 2);
    cCtx.fill();
  }
  cCtx.globalAlpha = 1.0;
}

// ═══════════════════════════════════════════════════════════
// MAIN SHOWCASE UPDATE LOOP
// ═══════════════════════════════════════════════════════════
function updateShowcase(frame) {
  slider.value = Math.floor(frame);
  currentTimeEl.textContent = `${(frame / FPS).toFixed(2)}s`;

  // Step Indicators highlight
  stepIndicators.forEach((ind) => {
    const start = parseInt(ind.dataset.frame, 10);
    const idx = Array.from(stepIndicators).indexOf(ind);
    const next = stepIndicators[idx + 1] ? parseInt(stepIndicators[idx + 1].dataset.frame, 10) : TOTAL_FRAMES;
    ind.classList.toggle('active', frame >= start && frame < next);
  });

  // ─────────────────────────────────────────────────
  // PHASE 1: Keynote Stage (0 – 330)
  // ─────────────────────────────────────────────────
  if (frame >= P1_START && frame < P2_START) {
    activateScene(sceneKeynote);
    lCtx.clearRect(0, 0, 1024, 576);
    epCtx.clearRect(0, 0, 1024, 576);
    cCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

    const localF = frame - P1_START;

    // Spotlights slide/scale in
    if (localF < 50) {
      const spotT = clamp01(localF / 50);
      spotLeft.style.opacity = spotT * 0.3;
      spotCenter.style.opacity = spotT * 0.5;
      spotRight.style.opacity = spotT * 0.3;
    } else {
      spotLeft.style.opacity = 0.3;
      spotCenter.style.opacity = 0.5;
      spotRight.style.opacity = 0.3;
    }

    // Screen scale and opacity
    const screenT = clamp01(localF / 30);
    keynoteScreen.style.opacity = screenT;
    keynoteScreen.style.transform = `translate(-50%, -50%) scale(${lerp(0.96, 1.0, easeOutCubic(screenT))})`;

    // Apple screen logo reveal (50-130)
    if (localF >= 50 && localF < 130) {
      const logoT = clamp01((localF - 50) / 40);
      appleLogoPath.setAttribute('opacity', easeOutCubic(logoT).toString());
      logoGlowCircle.setAttribute('opacity', (easeOutCubic(logoT) * 0.4).toString());
    } else if (localF >= 130) {
      // Fade out logo for OMT typewriter
      const fadeT = clamp01((localF - 130) / 25);
      appleLogoPath.setAttribute('opacity', (1 - fadeT).toString());
      logoGlowCircle.setAttribute('opacity', (0.4 * (1 - fadeT)).toString());
    } else {
      appleLogoPath.setAttribute('opacity', '0');
      logoGlowCircle.setAttribute('opacity', '0');
    }

    // "One more thing..." Typewriter reveal (150-240)
    const omtText = "One more thing...";
    if (localF >= 150 && localF < 240) {
      const typeT = clamp01((localF - 150) / 60);
      const chars = Math.floor(typeT * omtText.length);
      keynoteOmt.innerHTML = `${omtText.substring(0, chars)}<span style="opacity:${Math.floor(localF/8)%2?'1':'0'}">|</span>`;
      keynoteOmt.style.opacity = 1;
    } else if (localF >= 240) {
      keynoteOmt.innerHTML = omtText;
      // Fade out OMT for product silhouette (250+)
      const fadeT = clamp01((localF - 250) / 20);
      keynoteOmt.style.opacity = 1 - fadeT;
    } else {
      keynoteOmt.innerHTML = "";
      keynoteOmt.style.opacity = 1;
    }

    // Product Silhouette reveal (260-310)
    if (localF >= 260) {
      const prodT = clamp01((localF - 260) / 30);
      keynoteProduct.style.opacity = easeOutCubic(prodT);
      keynoteProduct.style.transform = `translate(-50%, -50%) scale(${lerp(0.85, 1.0, easeOutBack(prodT))})`;
    } else {
      keynoteProduct.style.opacity = 0;
      keynoteProduct.style.transform = 'translate(-50%, -50%) scale(0.85)';
    }

    // Audience Applause canvas wave (triggered on Product reveal 270+)
    const applauseAct = clamp01((localF - 270) / 30);
    drawAudienceApplause(localF, applauseAct);

    // Fade out scene
    if (localF >= 310) {
      const fadeOut = clamp01((localF - 310) / 20);
      sceneKeynote.style.opacity = 1 - fadeOut;
    } else {
      sceneKeynote.style.opacity = 1;
    }
  }

  // ─────────────────────────────────────────────────
  // PHASE 2: iPhone Line-Draw Reveal (330 – 660)
  // ─────────────────────────────────────────────────
  if (frame >= P2_START && frame < P3_START) {
    activateScene(sceneLinedraw);
    epCtx.clearRect(0, 0, 1024, 576);
    cCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    drawAudienceApplause(0, 0);

    const localF = frame - P2_START;

    // Consolidated fade in/out scene opacity
    let sceneOpacity = 1;
    if (localF < 20) {
      sceneOpacity = clamp01(localF / 20);
    } else if (localF >= 310) {
      sceneOpacity = 1 - clamp01((localF - 310) / 20);
    }
    sceneLinedraw.style.opacity = sceneOpacity;

    // Line drawing progress (20 to 220)
    let drawProgress = 0;
    let fillAlpha = 0;

    if (localF >= 20 && localF < 220) {
      drawProgress = clamp01((localF - 20) / 200);
      fillAlpha = 0;
    } else if (localF >= 220) {
      drawProgress = 1.0;
      // Fade in gradient details & screens (220 to 270)
      fillAlpha = clamp01((localF - 220) / 50);
    }

    drawIphoneLineDraw(drawProgress, fillAlpha);

    // Fade out is handled by consolidated opacity logic at top of Phase 2
  }

  // ─────────────────────────────────────────────────
  // PHASE 3: Product Ecosystem Arc (660 – 1020)
  // ─────────────────────────────────────────────────
  if (frame >= P3_START && frame < P4_START) {
    activateScene(sceneEcosystem);
    lCtx.clearRect(0, 0, 1024, 576);
    cCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

    const localF = frame - P3_START;

    // Consolidated fade in/out scene opacity
    let sceneOpacity = 1;
    if (localF < 20) {
      sceneOpacity = clamp01(localF / 20);
    } else if (localF >= 340) {
      sceneOpacity = 1 - clamp01((localF - 340) / 20);
    }
    sceneEcosystem.style.opacity = sceneOpacity;

    // Products floating entry staggered
    const products = [
      { el: ecoMacbook, start: 20, endX: 512, endY: 250, startX: 512, startY: -100 },
      { el: ecoIphone,  start: 40, endX: 300, endY: 350, startX: -100, startY: 350 },
      { el: ecoIpad,    start: 55, endX: 340, endY: 160, startX: 340, startY: -120 },
      { el: ecoWatch,   start: 70, endX: 724, endY: 170, startX: 724, startY: -80 },
      { el: ecoAirpods, start: 85, endX: 684, endY: 360, startX: 1124, startY: 360 }
    ];

    products.forEach((p) => {
      if (localF >= p.start) {
        const t = clamp01((localF - p.start) / 35);
        const ease = easeOutCubic(t);
        const currX = lerp(p.startX, p.endX, ease);
        const currY = lerp(p.startY, p.endY, ease);

        p.el.style.display = 'flex';
        p.el.style.opacity = ease;
        p.el.style.left = `${currX}px`;
        p.el.style.top = `${currY}px`;
      } else {
        p.el.style.display = 'none';
        p.el.style.opacity = 0;
      }
    });

    // Animate network linkages (starts drawing at frame 130+)
    const networkT = clamp01((localF - 130) / 40);
    drawEcosystemNetwork(localF, networkT);

    // "Designed in California" text (180+)
    if (localF >= 180) {
      const textT = clamp01((localF - 180) / 25);
      ecoCalifornia.style.opacity = textT;
      ecoCalifornia.style.transform = `translateX(-50%) translateY(${lerp(15, 0, easeOutCubic(textT))}px)`;
    } else {
      ecoCalifornia.style.opacity = 0;
      ecoCalifornia.style.transform = 'translateX(-50%) translateY(15px)';
    }

    // Fade out is handled by consolidated opacity logic at top of Phase 3
  }

  // ─────────────────────────────────────────────────
  // PHASE 4: Brand Celebration (1080 – 1440 / 36s – 48s)
  // ─────────────────────────────────────────────────
  if (frame >= P4_START && frame < P5_START) {
    activateScene(sceneBrand);
    lCtx.clearRect(0, 0, 1024, 576);
    epCtx.clearRect(0, 0, 1024, 576);

    const localF = frame - P4_START;

    // Rainbow Apple bitten logo scales in
    if (localF >= 0) {
      const t = clamp01(localF / 25);
      brandLogo.style.opacity = easeOutCubic(t);
      const scale = easeOutBackScale(t, 0.7, 1.0);
      brandLogo.style.transform = `scale(${scale})`;
    }

    // Tagline reveal
    if (localF >= 30) {
      const t = clamp01((localF - 30) / 20);
      brandTagline.style.opacity = easeOutCubic(t);
      brandTagline.style.transform = `translateY(${lerp(15, 0, easeOutCubic(t))}px)`;
    } else {
      brandTagline.style.opacity = 0;
      brandTagline.style.transform = 'translateY(15px)';
    }

    // Subtitle reveal
    if (localF >= 50) {
      const t = clamp01((localF - 50) / 20);
      brandSubtitle.style.opacity = easeOutCubic(t);
      brandSubtitle.style.transform = `translateY(${lerp(15, 0, easeOutCubic(t))}px)`;
    } else {
      brandSubtitle.style.opacity = 0;
      brandSubtitle.style.transform = 'translateY(15px)';
    }

    // Stats staggered rise
    const statsArray = [stat1, stat2, stat3, stat4];
    statsArray.forEach((st, i) => {
      const delay = 75 + i * 15;
      if (localF >= delay) {
        const t = clamp01((localF - delay) / 20);
        st.style.opacity = easeOutCubic(t);
        st.style.transform = `translateY(${lerp(20, 0, easeOutCubic(t))}px)`;
      } else {
        st.style.opacity = 0;
        st.style.transform = 'translateY(20px)';
      }
    });

    // Slow falling white dots confetti
    drawAppleConfetti(localF);
  }

  // ─────────────────────────────────────────────────
  // PHASE 5: AI Partnership (Apple + Google) (1440 – 1800 / 48s – 60s)
  // ─────────────────────────────────────────────────
  if (frame >= P5_START) {
    activateScene(sceneAiPartnership);
    lCtx.clearRect(0, 0, 1024, 576);
    epCtx.clearRect(0, 0, 1024, 576);
    cCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

    const localF = frame - P5_START;

    const applePathEl = aiAppleOutline.querySelector('.glow-path');
    const googlePathEl = aiGoogleOutline.querySelector('.glow-path');

    // Path stroke-dasharray properties
    applePathEl.style.strokeDasharray = '600';
    googlePathEl.style.strokeDasharray = '100';

    // 1. Draw Apple neon outline (0 to 60)
    if (localF >= 0 && localF < 60) {
      const drawT = clamp01(localF / 60);
      aiAppleOutline.style.opacity = easeOutCubic(drawT);
      aiAppleOutline.style.transform = 'scale(1.0)';
      applePathEl.style.strokeDashoffset = lerp(600, 0, drawT);
      
      aiGoogleOutline.style.opacity = 0;
      aiGoogleOutline.style.transform = 'scale(0.8)';
      googlePathEl.style.strokeDashoffset = '100';
      
      aiStarFlare.style.opacity = 0;
      aiStarFlare.style.transform = 'scale(0) rotate(0deg)';
      aiFlashOverlay.style.opacity = 0;
      
      aiTagline.style.opacity = 0;
      aiTagline.style.transform = 'translateY(15px)';
      aiSubtitle.style.opacity = 0;
      aiSubtitle.style.transform = 'translateY(15px)';
    } 
    // 2. Apple outline glow, lens flare star grows (60 to 120)
    else if (localF >= 60 && localF < 120) {
      const starF = localF - 60;
      
      aiAppleOutline.style.opacity = 1;
      aiAppleOutline.style.transform = 'scale(1.0)';
      applePathEl.style.strokeDashoffset = '0';
      
      aiGoogleOutline.style.opacity = 0;
      aiGoogleOutline.style.transform = 'scale(0.8)';
      googlePathEl.style.strokeDashoffset = '100';
      
      const starT = clamp01(starF / 60);
      aiStarFlare.style.opacity = starT;
      aiStarFlare.style.transform = `scale(${lerp(0, 2.5, easeOutCubic(starT))}) rotate(${starT * 90}deg)`;
      
      aiFlashOverlay.style.opacity = 0;
      
      aiTagline.style.opacity = 0;
      aiTagline.style.transform = 'translateY(15px)';
      aiSubtitle.style.opacity = 0;
      aiSubtitle.style.transform = 'translateY(15px)';
    }
    // 3. Peak Star Flash & morph to Google G (120 to 150)
    else if (localF >= 120 && localF < 150) {
      const flashF = localF - 120;
      
      let flashOpacity = 0;
      if (flashF < 15) {
        flashOpacity = clamp01(flashF / 15);
      } else {
        flashOpacity = 1 - clamp01((flashF - 15) / 15);
      }
      aiFlashOverlay.style.opacity = flashOpacity;
      
      if (flashF < 15) {
        aiAppleOutline.style.opacity = 1;
        aiGoogleOutline.style.opacity = 0;
        googlePathEl.style.strokeDashoffset = '100';
      } else {
        aiAppleOutline.style.opacity = 0;
        aiGoogleOutline.style.opacity = 1;
        aiGoogleOutline.style.transform = 'scale(1.0)';
        googlePathEl.style.strokeDashoffset = '0';
      }
      
      const flareT = clamp01(flashF / 30);
      aiStarFlare.style.opacity = 1 - flareT;
      aiStarFlare.style.transform = `scale(${lerp(2.5, 0, flareT)}) rotate(${90 + flareT * 90}deg)`;
      
      aiTagline.style.opacity = 0;
      aiTagline.style.transform = 'translateY(15px)';
      aiSubtitle.style.opacity = 0;
      aiSubtitle.style.transform = 'translateY(15px)';
    }
    // 4. Google G glows on starry night, text reveals (150+)
    else if (localF >= 150) {
      aiAppleOutline.style.opacity = 0;
      aiGoogleOutline.style.opacity = 1;
      aiGoogleOutline.style.transform = 'scale(1.0)';
      googlePathEl.style.strokeDashoffset = '0';
      
      aiStarFlare.style.opacity = 0;
      aiFlashOverlay.style.opacity = 0;
      
      const textF = localF - 150;
      const textT = clamp01(textF / 40);
      aiTagline.style.opacity = textT;
      aiTagline.style.transform = `translateY(${lerp(15, 0, easeOutCubic(textT))}px)`;
      
      if (textF >= 20) {
        const subT = clamp01((textF - 20) / 40);
        aiSubtitle.style.opacity = subT;
        aiSubtitle.style.transform = `translateY(${lerp(15, 0, easeOutCubic(subT))}px)`;
      } else {
        aiSubtitle.style.opacity = 0;
        aiSubtitle.style.transform = 'translateY(15px)';
      }
    }
    
    // Outro fade out starts at frame 1760 (localF = 320 to 360)
    if (localF >= 320) {
      const fadeOut = clamp01((localF - 320) / 40);
      sceneAiPartnership.style.opacity = 1 - fadeOut;
    } else {
      sceneAiPartnership.style.opacity = 1;
    }
  }
}

// ═══════════════════════════════════════════════════════════
// PLAYBACK ENGINE
// ═══════════════════════════════════════════════════════════
function tick(timestamp) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  const elapsedMs = Math.min(timestamp - lastTimestamp, 100); // Protection
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

// URL Param Support
const urlParams = new URLSearchParams(window.location.search);
const frameParam = urlParams.get('frame');
if (frameParam !== null) {
  currentFrame = parseInt(frameParam, 10);
  isPlaying = false;
  btnPlay.textContent = 'Play';
  btnPlay.classList.remove('btn-primary');
  btnPlay.classList.add('btn-secondary');
}

// Boot
updateShowcase(currentFrame);
requestAnimationFrame(tick);
