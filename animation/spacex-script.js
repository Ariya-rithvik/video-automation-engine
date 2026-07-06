// ═══════════════════════════════════════════════════════════
// SPACEX — FALCON 9 LAUNCH & LANDING SHOWCASE — 45s ANIMATION
// ═══════════════════════════════════════════════════════════

const TOTAL_FRAMES = 1350; // 45s @ 30fps
const FPS = 30;

// Phase boundaries
const P1_START = 0;     // Mission Control (0s – 11s)
const P2_START = 330;   // Falcon 9 Launch (11s – 22s)
const P3_START = 660;   // Booster Landing (22s – 34s)
const P4_START = 1020;  // Brand Celebration (34s – 45s)

// Playback state
let currentFrame = 0;
let isPlaying = true;
let playSpeed = 1.0;
let lastTimestamp = 0;

// ── DOM References ──
const sceneMission = document.getElementById('scene-mission');
const sceneLaunch  = document.getElementById('scene-launch');
const sceneLanding = document.getElementById('scene-landing');
const sceneBrand   = document.getElementById('scene-brand');

// Scene 1: Mission Control
const mcPanel       = document.getElementById('mc-panel');
const mcCountdown   = document.getElementById('mc-countdown');
const mcWaveCanvas  = document.getElementById('mc-wave-canvas');
const wCtx          = mcWaveCanvas.getContext('2d');
const tlAlt         = document.getElementById('tl-alt');
const tlVel         = document.getElementById('tl-vel');
const tlRange       = document.getElementById('tl-range');
const tlMaxQ        = document.getElementById('tl-maxq');

const chkProp       = document.getElementById('chk-prop');
const chkGuid       = document.getElementById('chk-guid');
const chkRange      = document.getElementById('chk-range');
const chkWeather    = document.getElementById('chk-weather');
const chkGround     = document.getElementById('chk-ground');
const chkFlight     = document.getElementById('chk-flight');
const chkLaunch     = document.getElementById('chk-launch');

// Scene 2: Launch
const launchCanvas  = document.getElementById('launch-canvas');
const lCtx          = launchCanvas.getContext('2d');

// Scene 3: Landing
const landingCanvas = document.getElementById('landing-canvas');
const dCtx          = landingCanvas.getContext('2d');
const ltAlt         = document.getElementById('lt-alt');
const ltVel         = document.getElementById('lt-vel');
const ltFuel        = document.getElementById('lt-fuel');
const dsLabel       = document.getElementById('ds-label');
const landingTelem  = document.getElementById('landing-telemetry');

// Scene 4: Brand
const brandLogo     = document.getElementById('brand-logo');
const brandTagline  = document.getElementById('brand-tagline');
const brandSubtitle = document.getElementById('brand-subtitle');
const stat1         = document.getElementById('stat-1');
const stat2         = document.getElementById('stat-2');
const stat3         = document.getElementById('stat-3');
const stat4         = document.getElementById('stat-4');
const confettiCanvas = document.getElementById('confetti-canvas');
const cCtx           = confettiCanvas.getContext('2d');

// Global Controls
const btnPlay        = document.getElementById('btn-play');
const btnRestart     = document.getElementById('btn-restart');
const speedBtns      = document.querySelectorAll('.speed-btn');
const slider         = document.getElementById('timeline-slider');
const currentTimeEl  = document.getElementById('current-time');
const stepIndicators = document.querySelectorAll('.step-indicator');

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
function easeInOutQuad(x) {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

// ═══════════════════════════════════════════════════════════
// WAVEFORM DRAWING (oscilloscope-style telemetry)
// ═══════════════════════════════════════════════════════════
function drawWaveforms(frame, intensity) {
  wCtx.clearRect(0, 0, mcWaveCanvas.width, mcWaveCanvas.height);
  if (intensity <= 0) return;

  const w = mcWaveCanvas.width;
  const h = mcWaveCanvas.height;

  wCtx.beginPath();
  wCtx.strokeStyle = 'rgba(74, 222, 128, 0.4)';
  wCtx.lineWidth = 1.5;

  for (let x = 0; x < w; x++) {
    const freq = 0.05 + Math.sin(frame * 0.01) * 0.02;
    const amp = 12 * intensity;
    const y = h/2 + Math.sin(x * freq + frame * 0.15) * amp + Math.cos(x * 0.02 + frame * 0.08) * (amp * 0.4);
    if (x === 0) wCtx.moveTo(x, y);
    else wCtx.lineTo(x, y);
  }
  wCtx.stroke();
}

// ═══════════════════════════════════════════════════════════
// PARTICLES & FLAMES FOR LAUNCH
// ═══════════════════════════════════════════════════════════
let launchParticles = [];
function createLaunchSparks(x, y, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.PI/2 + (Math.random() - 0.5) * 1.2; // point downwards
    const speed = 4 + Math.random() * 12;
    launchParticles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 2 + Math.random() * 4,
      color: Math.random() > 0.5 ? '#ff6a00' : (Math.random() > 0.3 ? '#ffb700' : '#ff3c00'),
      life: 1.0,
      decay: 0.04 + Math.random() * 0.06
    });
  }
}

function createLaunchSmoke(x, y, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.PI + (Math.random() - 0.5) * Math.PI; // blow out left/right/up
    const speed = 2 + Math.random() * 6;
    launchParticles.push({
      x: x + (Math.random() - 0.5) * 30,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * 0.3 - 0.5,
      size: 15 + Math.random() * 25,
      color: 'rgba(100, 110, 130, 0.15)',
      life: 1.0,
      decay: 0.02 + Math.random() * 0.02,
      isSmoke: true
    });
  }
}

function updateAndDrawLaunchParticles(ctx) {
  for (let i = launchParticles.length - 1; i >= 0; i--) {
    const p = launchParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= p.decay;

    if (p.life <= 0) {
      launchParticles.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.beginPath();
    if (p.isSmoke) {
      ctx.arc(p.x, p.y, p.size * (1.5 - p.life * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = p.color;
    } else {
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = p.color;
    }
    ctx.fill();
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════
// ROCKET DRAWING HELPER
// ═══════════════════════════════════════════════════════════
function drawFalcon9(ctx, x, y, scale = 1.0, stageSeparated = false, tilt = 0, legsProgress = 0, finsProgress = 1.0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(scale, scale);

  // Falcon 9 dimensions
  const w = 14;
  const h1 = 120; // First stage
  const h2 = 50;  // Second stage & fairing

  if (!stageSeparated) {
    // Fairing / Nose cone
    ctx.beginPath();
    ctx.moveTo(-w/2, -h1 - h2);
    ctx.quadraticCurveTo(0, -h1 - h2 - 25, w/2, -h1 - h2);
    ctx.lineTo(w/2, -h1);
    ctx.lineTo(-w/2, -h1);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.stroke();

    // USA Flag / Logo details
    ctx.fillStyle = '#6080c0';
    ctx.fillRect(-2, -h1 - h2 + 25, 4, 3);
  }

  // Interstage (black ring)
  ctx.fillStyle = '#111116';
  ctx.fillRect(-w/2, -h1, w, 8);

  // First stage booster body
  ctx.beginPath();
  ctx.rect(-w/2, -h1 + 8, w, h1 - 8);
  ctx.fillStyle = '#eaeaea';
  ctx.fill();
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.stroke();

  // SpaceX lettering vertical
  ctx.save();
  ctx.fillStyle = '#222';
  ctx.font = 'bold 7px sans-serif';
  ctx.translate(0, -h1 + 40);
  ctx.rotate(Math.PI/2);
  ctx.fillText('SPACEX', 0, 2);
  ctx.restore();

  // Grid fins (deploying/deployed)
  if (finsProgress > 0) {
    ctx.fillStyle = '#111';
    const finW = 10 * finsProgress;
    ctx.fillRect(-w/2 - finW, -h1 + 15, finW, 4); // left fin
    ctx.fillRect(w/2, -h1 + 15, finW, 4);        // right fin
  }

  // Landing legs (deploying: 0 to 1)
  if (legsProgress > 0) {
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';

    // Left leg
    ctx.beginPath();
    ctx.moveTo(-w/2, -5);
    const legAngle = lerp(0, Math.PI/3, legsProgress);
    const legX = -w/2 - Math.sin(legAngle) * 35;
    const legY = -5 + Math.cos(legAngle) * 35;
    ctx.lineTo(legX, legY);
    ctx.stroke();

    // Left leg support strut
    ctx.beginPath();
    ctx.moveTo(-w/2, -25);
    ctx.lineTo(legX + Math.sin(legAngle)*10, legY - Math.cos(legAngle)*10);
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Right leg
    ctx.beginPath();
    ctx.moveTo(w/2, -5);
    const rLegX = w/2 + Math.sin(legAngle) * 35;
    const rLegY = -5 + Math.cos(legAngle) * 35;
    ctx.lineTo(rLegX, rLegY);
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Right leg support strut
    ctx.beginPath();
    ctx.moveTo(w/2, -25);
    ctx.lineTo(rLegX - Math.sin(legAngle)*10, rLegY - Math.cos(legAngle)*10);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // Engines nozzle clustering at bottom
  ctx.fillStyle = '#222';
  ctx.fillRect(-w/2 + 2, 0, 3, 5);
  ctx.fillRect(-1.5, 0, 3, 5);
  ctx.fillRect(w/2 - 5, 0, 3, 5);

  ctx.restore();
}

// ═══════════════════════════════════════════════════════════
// CONFETTI SYSTEM (SpaceX themed blue/white/silver)
// ═══════════════════════════════════════════════════════════
const CONFETTI_COUNT = 100;
const confettiSeeds = [];
const confettiColors = ['#00a8e8', '#ffffff', '#a1a1a6', '#004c80', '#00d4ff'];

for (let i = 0; i < CONFETTI_COUNT; i++) {
  const angle = (1.2 + Math.abs(Math.sin(i * 32.1)) * 0.6) * Math.PI;
  const speed = 5 + Math.abs(Math.cos(i * 45.4)) * 13;
  confettiSeeds.push({
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: 4 + Math.abs(Math.sin(i * 12.3)) * 6,
    color: confettiColors[i % confettiColors.length],
    rotSpeed: -10 + Math.abs(Math.cos(i * 6.3)) * 20,
    rotOffset: Math.random() * 360,
    isStar: Math.random() > 0.5
  });
}

function drawStar(ctx, cx, cy, r, rot) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawConfetti(t) {
  cCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  if (t <= 0) return;
  const gravity = 0.3, startX = 512, startY = 240, groundY = 520;

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
          cx = startX + s.vx * tc + s.vx * 0.6 * tp;
          cy = groundY + (-vyc * 0.3) * tp + 0.5 * gravity * tp * tp;
          if (cy > groundY) cy = groundY;
        }
      }
    }

    let opacity = Math.max(0, 1 - t / 150);
    if (opacity <= 0) continue;

    const rot = (s.rotOffset + t * s.rotSpeed) * Math.PI / 180;
    cCtx.fillStyle = s.color;
    cCtx.globalAlpha = opacity;

    if (s.isStar) {
      drawStar(cCtx, cx, cy, s.size * 0.7, rot);
    } else {
      cCtx.save();
      cCtx.translate(cx, cy);
      cCtx.rotate(rot);
      cCtx.fillRect(-s.size/2, -s.size/2, s.size, s.size);
      cCtx.restore();
    }
  }
  cCtx.globalAlpha = 1.0;
}

// ═══════════════════════════════════════════════════════════
// SCENE ACTIVATION
// ═══════════════════════════════════════════════════════════
function activateScene(activeScene) {
  const scenes = [sceneMission, sceneLaunch, sceneLanding, sceneBrand];
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
// MAIN SHOWCASE UPDATE FUNCTION
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
  // PHASE 1: Mission Control Console (0 – 330)
  // ─────────────────────────────────────────────────
  if (frame >= P1_START && frame < P2_START) {
    activateScene(sceneMission);
    cCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    lCtx.clearRect(0, 0, 1024, 576);
    dCtx.clearRect(0, 0, 1024, 576);

    const localF = frame - P1_START;

    // Panel fade & entry scale
    const entryT = clamp01(localF / 25);
    mcPanel.style.opacity = easeOutCubic(entryT);
    mcPanel.style.transform = `scale(${lerp(0.96, 1.0, easeOutCubic(entryT))})`;

    // Oscilloscope intensity
    const oscInt = clamp01(localF / 30);
    drawWaveforms(localF, oscInt);

    // Checklist poll ticks (GO status)
    chkProp.classList.toggle('checked', localF >= 40);
    chkProp.querySelector('.mc-check-dot').textContent = localF >= 40 ? '✓' : '';
    chkGuid.classList.toggle('checked', localF >= 65);
    chkGuid.querySelector('.mc-check-dot').textContent = localF >= 65 ? '✓' : '';
    chkRange.classList.toggle('checked', localF >= 90);
    chkRange.querySelector('.mc-check-dot').textContent = localF >= 90 ? '✓' : '';
    chkWeather.classList.toggle('checked', localF >= 115);
    chkWeather.querySelector('.mc-check-dot').textContent = localF >= 115 ? '✓' : '';
    chkGround.classList.toggle('checked', localF >= 140);
    chkGround.querySelector('.mc-check-dot').textContent = localF >= 140 ? '✓' : '';
    chkFlight.classList.toggle('checked', localF >= 165);
    chkFlight.querySelector('.mc-check-dot').textContent = localF >= 165 ? '✓' : '';
    chkLaunch.classList.toggle('checked', localF >= 190);
    chkLaunch.querySelector('.mc-check-dot').textContent = localF >= 190 ? '✓' : '';

    // Countdown Logic (T-10 to T-0)
    if (localF >= 190 && localF <= 300) {
      const countdownProgress = (localF - 190) / 110;
      const countSeconds = Math.max(0, Math.ceil(10 * (1 - countdownProgress)));
      mcCountdown.textContent = `T-${countSeconds}`;
      mcCountdown.classList.remove('go');
      mcCountdown.style.transform = 'scale(1.0)';
    } else if (localF > 300) {
      mcCountdown.textContent = 'LIFTOFF';
      mcCountdown.classList.add('go');
      // Gentle pulsing on Liftoff label
      const pulse = 1 + Math.sin(localF * 0.3) * 0.04;
      mcCountdown.style.transform = `scale(${pulse})`;
    } else {
      mcCountdown.textContent = 'T-10';
      mcCountdown.classList.remove('go');
      mcCountdown.style.transform = 'scale(1.0)';
    }

    // Telemetry updates
    if (localF >= 300) {
      tlAlt.textContent = '0.0 km';
      tlVel.textContent = '350 km/h';
      tlRange.textContent = '0.0 km';
      tlMaxQ.textContent = '—';
    } else {
      tlAlt.textContent = '0.0 km';
      tlVel.textContent = '0 km/h';
      tlRange.textContent = '0.0 km';
      tlMaxQ.textContent = '—';
    }

    // Screen fade out for transition
    if (localF >= 310) {
      const fadeOut = clamp01((localF - 310) / 20);
      sceneMission.style.opacity = 1 - fadeOut;
    } else {
      sceneMission.style.opacity = 1;
    }
  }

  // ─────────────────────────────────────────────────
  // PHASE 2: Falcon 9 Launch (330 – 660)
  // ─────────────────────────────────────────────────
  if (frame >= P2_START && frame < P3_START) {
    activateScene(sceneLaunch);
    dCtx.clearRect(0, 0, 1024, 576);
    cCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

    const localF = frame - P2_START;
    lCtx.clearRect(0, 0, 1024, 576);

    // Consolidated fade in/out scene opacity
    let sceneOpacity = 1;
    if (localF < 20) {
      sceneOpacity = clamp01(localF / 20);
    } else if (localF >= 310) {
      sceneOpacity = 1 - clamp01((localF - 310) / 20);
    }
    sceneLaunch.style.opacity = sceneOpacity;

    const startLiftoffFrame = 50;
    const endAscentFrame = 270;
    let rocketY = 460;
    let rocketX = 512;
    let scale = 1.0;
    let separated = false;
    let flameSize = 0;

    // Pad / Ground drawing
    let scrollY = 0;

    if (localF < startLiftoffFrame) {
      // Pre-launch hold down
      rocketY = 460;
      // Ignition flame start
      if (localF >= 30) {
        flameSize = clamp01((localF - 30) / 20);
        createLaunchSparks(512, 460, 2);
        createLaunchSmoke(512, 465, 3);
      }
    } else if (localF >= startLiftoffFrame && localF < endAscentFrame) {
      // Ascent phase
      const ascentT = (localF - startLiftoffFrame) / (endAscentFrame - startLiftoffFrame);
      const easeAscent = easeOutCubic(ascentT);
      rocketY = 460 - easeAscent * 600;
      scrollY = easeAscent * 250;
      scale = lerp(1.0, 0.45, easeAscent);
      flameSize = 1.0;

      // Thrust vibrations
      rocketX = 512 + (Math.random() - 0.5) * 1.8;

      // Emit continuous thrust flame particles
      createLaunchSparks(rocketX, rocketY, 4);
      createLaunchSmoke(rocketX, rocketY + 10, 2);
    } else {
      // Post separation high-altitude climb
      separated = true;
      const climbT = (localF - endAscentFrame) / 60;
      rocketY = -140 - climbT * 200;
      scale = 0.35;
      flameSize = 0.6;
      rocketX = 512;

      // Small second stage flames
      createLaunchSparks(512, rocketY, 2);
      createLaunchSmoke(512, rocketY + 8, 1);
    }

    // Draw Ground and Pad (scrolling away)
    lCtx.save();
    lCtx.translate(0, scrollY);
    // Draw sky gradient underlay
    const skyGrad = lCtx.createLinearGradient(0, 0, 0, 576);
    skyGrad.addColorStop(0, '#02030a');
    skyGrad.addColorStop(1, '#0e1630');
    lCtx.fillStyle = skyGrad;
    lCtx.fillRect(0, -scrollY, 1024, 576);

    // Draw simple stars in upper sky
    lCtx.fillStyle = 'rgba(255,255,255,0.4)';
    for (let i = 0; i < 40; i++) {
      const sx = (i * 277) % 1024;
      const sy = ((i * 133) % 450) - scrollY;
      if (sy < 450) lCtx.fillRect(sx, sy, 1.2, 1.2);
    }

    // Ground plane
    lCtx.fillStyle = '#060812';
    lCtx.fillRect(0, 480, 1024, 150);
    lCtx.strokeStyle = 'rgba(255,255,255,0.08)';
    lCtx.lineWidth = 2;
    lCtx.beginPath();
    lCtx.moveTo(0, 480);
    lCtx.lineTo(1024, 480);
    lCtx.stroke();

    // Launch tower structure
    lCtx.fillStyle = '#1e293b';
    lCtx.fillRect(430, 180, 20, 300);
    lCtx.strokeStyle = '#475569';
    lCtx.lineWidth = 1;
    for (let ty = 180; ty < 480; ty += 30) {
      lCtx.strokeRect(430, ty, 20, 30);
      lCtx.beginPath();
      lCtx.moveTo(430, ty); lCtx.lineTo(450, ty + 30);
      lCtx.moveTo(450, ty); lCtx.lineTo(430, ty + 30);
      lCtx.stroke();
    }
    lCtx.restore();

    // Draw active launch particles
    updateAndDrawLaunchParticles(lCtx);

    // Draw Engine Flame Glow
    if (flameSize > 0 && rocketY > -100) {
      lCtx.save();
      const flameGrad = lCtx.createRadialGradient(rocketX, rocketY + 8, 2, rocketX, rocketY + 45 * flameSize, 35 * flameSize);
      flameGrad.addColorStop(0, '#ffffff');
      flameGrad.addColorStop(0.2, '#ffaa00');
      flameGrad.addColorStop(0.5, 'rgba(255,60,0,0.8)');
      flameGrad.addColorStop(1, 'rgba(255,0,0,0)');
      lCtx.fillStyle = flameGrad;
      lCtx.beginPath();
      lCtx.arc(rocketX, rocketY + 15 * flameSize, 35 * flameSize, 0, Math.PI * 2);
      lCtx.fill();
      lCtx.restore();
    }

    // Draw Falcon 9 Rocket
    if (rocketY > -100) {
      drawFalcon9(lCtx, rocketX, rocketY, scale, separated, 0, 0, 0);
    }

    // Stage separation camera flash effect
    if (localF >= 270 && localF <= 276) {
      lCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      lCtx.fillRect(0, 0, 1024, 576);
    }

    // Fade out is handled by consolidated opacity logic at top of Phase 2
  }

  // ─────────────────────────────────────────────────
  // PHASE 3: Booster Landing (660 – 1020)
  // ─────────────────────────────────────────────────
  if (frame >= P3_START && frame < P4_START) {
    activateScene(sceneLanding);
    lCtx.clearRect(0, 0, 1024, 576);
    cCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

    const localF = frame - P3_START;
    dCtx.clearRect(0, 0, 1024, 576);

    // Consolidated fade in/out scene opacity
    let sceneOpacity = 1;
    if (localF < 20) {
      sceneOpacity = clamp01(localF / 20);
    } else if (localF >= 340) {
      sceneOpacity = 1 - clamp01((localF - 340) / 20);
    }
    sceneLanding.style.opacity = sceneOpacity;
    landingTelem.style.opacity = sceneOpacity;
    dsLabel.style.opacity = sceneOpacity * 0.25;

    // Dynamic landing flight path
    // Descent starts at top of screen (y = -100) and touchdowns at y = 445 on the droneship
    const totalDescentDuration = 270; // touchdown at local frame 270
    let boosterY = -100;
    let boosterX = 512;
    let tilt = -0.15;
    let legs = 0;
    let fins = 1.0;
    let flameIntensity = 0.0;
    let landingBurnActive = false;
    let touchdownState = false;

    // Telemetry stats
    let currentAltVal = 80.0;
    let currentVelVal = 2100;
    let currentFuelVal = 38;

    if (localF < 90) {
      // Entry Guidance phase
      const t = localF / 90;
      const easeT = easeOutCubic(t);
      boosterY = lerp(-100, 100, easeT);
      boosterX = lerp(450, 480, easeT);
      tilt = lerp(-0.25, -0.1, easeT);
      flameIntensity = t < 0.3 ? 0 : lerp(0, 0.4, (t-0.3)/0.7); // minor retro thruster adjustments
      currentAltVal = lerp(80.0, 45.0, t);
      currentVelVal = lerp(2100, 1500, t);
      currentFuelVal = lerp(38, 35, t);
    } else if (localF >= 90 && localF < 200) {
      // Grid Fin Steering & Deceleration Coast
      const t = (localF - 90) / 110;
      const easeT = easeInOutQuad(t);
      boosterY = lerp(100, 260, easeT);
      boosterX = lerp(480, 506, easeT);
      tilt = lerp(-0.1, -0.02, easeT);
      flameIntensity = 0.0; // engine cutoff for coasting
      currentAltVal = lerp(45.0, 12.0, t);
      currentVelVal = lerp(1500, 450, t);
      currentFuelVal = 35;
    } else if (localF >= 200 && localF < 270) {
      // Landing Burn (single-engine retro burn)
      landingBurnActive = true;
      const t = (localF - 200) / 70;
      const easeT = easeOutCubic(t);
      boosterY = lerp(260, 442, easeT); // lands perfectly at 442
      boosterX = lerp(506, 512, easeT);
      tilt = lerp(-0.02, 0, easeT);

      // Deploy landing legs in final moments of landing burn (t from 0.4 to 0.9)
      if (t >= 0.4) {
        legs = clamp01((t - 0.4) / 0.5);
      }

      flameIntensity = 1.2;
      currentAltVal = lerp(12.0, 0.02, t);
      currentVelVal = lerp(450, 5, t);
      currentFuelVal = lerp(35, 12, t);

      createLaunchSparks(boosterX, boosterY, 4);
    } else {
      // Touchdown complete
      touchdownState = true;
      boosterY = 442;
      boosterX = 512;
      tilt = 0;
      legs = 1.0;
      flameIntensity = 0.0;

      currentAltVal = 0.0;
      currentVelVal = 0;
      currentFuelVal = 12;

      // Dust burst on immediate touchdown frame 270
      const landingDelta = localF - 270;
      if (landingDelta < 25) {
        createLaunchSmoke(512, 442, 3);
      }
    }

    // Telemetry updates
    ltAlt.textContent = `${currentAltVal.toFixed(1)} km`;
    ltVel.textContent = `${Math.round(currentVelVal)} m/s`;
    ltFuel.textContent = `${Math.round(currentFuelVal)}%`;

    // Draw Space Sky gradient
    const skyGrad = dCtx.createLinearGradient(0, 0, 0, 576);
    skyGrad.addColorStop(0, '#000003');
    skyGrad.addColorStop(1, '#08081a');
    dCtx.fillStyle = skyGrad;
    dCtx.fillRect(0, 0, 1024, 576);

    // Draw Ocean Waves
    dCtx.fillStyle = '#04060f';
    dCtx.fillRect(0, 450, 1024, 126);
    dCtx.beginPath();
    dCtx.strokeStyle = 'rgba(255,255,255,0.06)';
    dCtx.lineWidth = 1;
    for (let ox = 0; ox < 1024; ox += 120) {
      dCtx.arc(ox + 60, 450, 6, 0, Math.PI, false);
    }
    dCtx.stroke();

    // Draw Droneship "Of Course I Still Love You"
    dCtx.save();
    dCtx.shadowBlur = 10;
    dCtx.shadowColor = 'rgba(0,168,232,0.15)';
    // Base platform
    dCtx.fillStyle = '#1e293b';
    dCtx.fillRect(400, 444, 224, 16);
    dCtx.strokeStyle = '#475569';
    dCtx.strokeRect(400, 444, 224, 16);

    // Yellow target circle
    dCtx.strokeStyle = '#eab308';
    dCtx.lineWidth = 3;
    dCtx.beginPath();
    dCtx.arc(512, 444, 35, 0, Math.PI, true);
    dCtx.stroke();

    // Center X
    dCtx.font = 'bold 10px monospace';
    dCtx.fillStyle = '#eab308';
    dCtx.textAlign = 'center';
    dCtx.fillText('X', 512, 441);
    dCtx.restore();

    // Update particles
    updateAndDrawLaunchParticles(dCtx);

    // Draw engine thrust flame
    if (flameIntensity > 0) {
      dCtx.save();
      const fireGrad = dCtx.createRadialGradient(boosterX, boosterY, 1, boosterX, boosterY + 50 * flameIntensity, 30 * flameIntensity);
      fireGrad.addColorStop(0, '#ffffff');
      fireGrad.addColorStop(0.3, '#ffcc00');
      fireGrad.addColorStop(0.6, 'rgba(255,80,0,0.8)');
      fireGrad.addColorStop(1, 'rgba(0,0,0,0)');
      dCtx.fillStyle = fireGrad;
      dCtx.beginPath();
      dCtx.arc(boosterX, boosterY + 20, 30 * flameIntensity, 0, Math.PI * 2);
      dCtx.fill();
      dCtx.restore();
    }

    // Draw landing booster
    drawFalcon9(dCtx, boosterX, boosterY, 0.75, true, tilt, legs, fins);

    // Fade out is handled by consolidated opacity logic at top of Phase 3
  }

  // ─────────────────────────────────────────────────
  // PHASE 4: Brand Celebration (1020 – 1350)
  // ─────────────────────────────────────────────────
  if (frame >= P4_START) {
    activateScene(sceneBrand);
    lCtx.clearRect(0, 0, 1024, 576);
    dCtx.clearRect(0, 0, 1024, 576);

    const localF = frame - P4_START;

    // Logo reveal
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

    // Star Confetti Burst
    const confettiT = localF - 60;
    if (confettiT > 0) {
      drawConfetti(confettiT);
    } else {
      cCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }
  }
}

// ═══════════════════════════════════════════════════════════
// PLAYBACK CONTROL ENGINE
// ═══════════════════════════════════════════════════════════
function tick(timestamp) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  const elapsedMs = Math.min(timestamp - lastTimestamp, 100); // Tab-switch protector
  lastTimestamp = timestamp;

  if (isPlaying) {
    currentFrame += (elapsedMs / 1000) * FPS * playSpeed;
    if (currentFrame >= TOTAL_FRAMES) currentFrame = 0;
    updateShowcase(currentFrame);
  }
  requestAnimationFrame(tick);
}

// ── Event Listeners ──
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
