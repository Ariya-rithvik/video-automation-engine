// ═══════════════════════════════════════════════════════════
// AMAZON PRIME CYBER-GRID — 45s CYBERPUNK SHOWCASE TIMELINE
// ═══════════════════════════════════════════════════════════

const TOTAL_FRAMES = 1350; // 45s @ 30fps
const FPS = 30;

// Phase Boundaries
const P1 = 0;     // STREET_GRID (0s - 12s)
const P2 = 360;   // DRONE_DESCENT (12s - 25s)
const P3 = 750;   // HOLOGRAM_LOCKER (25s - 37s)
const P4 = 1110;  // SKYLINE_REVEAL (37s - 45s)

let currentFrame = 0;
let isPlaying = true;
let playSpeed = 1.0;
let lastTimestamp = 0;

// ── DOM References ──
const sceneStreet   = document.getElementById('scene-street');
const sceneDrone    = document.getElementById('scene-drone');
const sceneLocker   = document.getElementById('scene-locker');
const sceneSkyline  = document.getElementById('scene-skyline');

// Street elements
const farSkyline    = document.getElementById('skyline-far');
const midSkyline    = document.getElementById('skyline-mid');
const signVideo     = document.getElementById('sign-video');
const signAws       = document.getElementById('sign-aws');
const signKindle    = document.getElementById('sign-kindle');

// Drone elements
const cyberDrone    = document.getElementById('cyber-drone');
const dronePackage  = document.getElementById('drone-package');
const podPlatform   = document.getElementById('pod-platform');

// Locker elements
const lockerWrapper = document.getElementById('locker-wrapper');
const doorL         = document.getElementById('door-l');
const doorR         = document.getElementById('door-r');
const holoPackage   = document.getElementById('holo-package');
const holoCone      = document.getElementById('holo-cone');

// Skyline elements
const skylineBrand  = document.getElementById('skyline-brand');

// HUD & Canvas
const cyberToast    = document.getElementById('cyber-toast');
const canvas        = document.getElementById('cyber-canvas');
const ctx           = canvas.getContext('2d');

// Controls
const btnPlay       = document.getElementById('btn-play');
const btnRestart    = document.getElementById('btn-restart');
const freqBtns      = document.querySelectorAll('.freq-btn');
const slider        = document.getElementById('timeline-slider');
const timeLabel     = document.getElementById('time-current');
const consoleNodes  = document.querySelectorAll('.console-node');

// ── Resize Canvas ──
function initCanvasSize() {
  canvas.width = 1024;
  canvas.height = 576;
}
initCanvasSize();

// ── Easing & Helpers ──
const lerp = (a, b, t) => (1 - t) * a + t * b;
const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutElastic = x => {
  if (x === 0 || x === 1) return x;
  return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
};
const easeOutBack = x => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

// ── Background Scanlines & Noise ──
function drawScanlines(frame) {
  // Clear canvas with subtle grid glow
  ctx.clearRect(0, 0, 1024, 576);

  // Digital scanline effect
  ctx.strokeStyle = 'rgba(0, 212, 255, 0.03)';
  ctx.lineWidth = 1;
  for (let y = 0; y < 576; y += 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  // Scanning laser swipe
  const laserY = (frame * 3) % 1200 - 300;
  if (laserY >= 0 && laserY <= 576) {
    const grad = ctx.createLinearGradient(0, laserY - 30, 0, laserY + 30);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(0.5, 'rgba(0, 212, 255, 0.07)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, laserY - 30, 1024, 60);
  }
}

// ── Hologram Particle System ──
const particles = [];
const particleCount = 120;
for (let i = 0; i < particleCount; i++) {
  particles.push({
    x: Math.random() * 1024,
    y: Math.random() * 576,
    vy: -0.5 - Math.random() * 1.5,
    size: 1 + Math.random() * 2,
    color: Math.random() > 0.5 ? '#00d4ff' : '#ff9900',
    alpha: 0.2 + Math.random() * 0.6
  });
}

function drawHoloParticles(frame, activeYStart = 0, activeYEnd = 576, targetX = null) {
  for (const p of particles) {
    p.y += p.vy;
    if (p.y < activeYStart) {
      p.y = activeYEnd;
      p.x = targetX ? targetX + (Math.random() - 0.5) * 80 : Math.random() * 1024;
    }

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.alpha * (0.6 + 0.4 * Math.sin(frame * 0.04 + p.x));
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ── Active Scene Configurator ──
function activateScene(activeSceneName) {
  sceneStreet.classList.toggle('active', activeSceneName === 'street');
  sceneDrone.classList.toggle('active', activeSceneName === 'drone');
  sceneLocker.classList.toggle('active', activeSceneName === 'locker');
  sceneSkyline.classList.toggle('active', activeSceneName === 'skyline');
}

// ═══════════════════════════════════════════════════════════
// MAIN RENDER TIMELINE
// ═══════════════════════════════════════════════════════════
function renderTimeline(frame) {
  // Update control inputs
  slider.value = Math.floor(frame);
  timeLabel.textContent = `${(frame / FPS).toFixed(2)}s`;

  consoleNodes.forEach((node, idx) => {
    const start = parseInt(node.dataset.frame, 10);
    const end = consoleNodes[idx + 1] ? parseInt(consoleNodes[idx + 1].dataset.frame, 10) : TOTAL_FRAMES;
    node.classList.toggle('active', frame >= start && frame < end);
  });

  drawScanlines(frame);
  cyberToast.classList.remove('active');

  // ─────────────────────────────────────────────────
  // PHASE 1: STREET_GRID (0s - 12s)
  // ─────────────────────────────────────────────────
  if (frame >= P1 && frame < P2) {
    activateScene('street');

    // Parallax scrolling
    const scrollOffset = frame * 0.8;
    farSkyline.style.backgroundPositionX = `-${scrollOffset * 0.3}px`;
    midSkyline.style.backgroundPositionX = `-${scrollOffset * 0.6}px`;

    // Staggered signs flicker entry
    const entryT = frame / P2;
    signVideo.style.opacity = frame >= 30 ? 1 : 0;
    signVideo.style.transform = `scale(${frame >= 30 ? lerp(0.8, 1, clamp((frame-30)/30, 0, 1)) : 0})`;
    
    signAws.style.opacity = frame >= 90 ? 1 : 0;
    signAws.style.transform = `scale(${frame >= 90 ? lerp(0.8, 1, clamp((frame-90)/30, 0, 1)) : 0})`;

    signKindle.style.opacity = frame >= 180 ? 1 : 0;
    signKindle.style.transform = `scale(${frame >= 180 ? lerp(0.8, 1, clamp((frame-180)/30, 0, 1)) : 0})`;

    // Random Cyber Sign flicker effect
    [signVideo, signAws, signKindle].forEach(sign => {
      const flicker = sign.querySelector('.flicker-overlay');
      if (Math.random() > 0.96) {
        flicker.style.opacity = '0.7';
        setTimeout(() => flicker.style.opacity = '0', 80);
      }
    });

    drawHoloParticles(frame, 0, 576);
  }

  // ─────────────────────────────────────────────────
  // PHASE 2: DRONE_DESCENT (12s - 25s)
  // ─────────────────────────────────────────────────
  else if (frame >= P2 && frame < P3) {
    activateScene('drone');

    const dt = (frame - P2) / (P3 - P2);
    
    // Toast notification
    if (frame >= 390 && frame < 550) {
      cyberToast.classList.add('active');
    }

    // Drone flight path (descends and hovers)
    const startY = -120;
    const hoverY = 180;
    const droneY = lerp(startY, hoverY, easeInOutCubic(clamp(dt * 1.3, 0, 1)));
    
    // Hover sway math
    const swayX = Math.sin((frame - P2) * 0.05) * 15;
    const swayY = Math.cos((frame - P2) * 0.06) * 6;

    cyberDrone.style.top = `${droneY + swayY}px`;
    cyberDrone.style.left = `${432 + swayX}px`;

    // Package drop telemetry
    if (dt >= 0.8) {
      const dropT = clamp((dt - 0.8) / 0.18, 0, 1);
      // package moves down out of claws to the platform
      dronePackage.style.transform = `translateY(${lerp(0, 130, dropT)}px) rotateX(-15deg) rotateY(20deg)`;
      if (dt >= 0.98) {
        dronePackage.style.opacity = 1 - (dt - 0.98)/0.02; // fades out as scene transitions
      }
    } else {
      dronePackage.style.transform = 'translateY(0) rotateX(-15deg) rotateY(20deg)';
      dronePackage.style.opacity = '1';
    }

    // Platform scanning beam pulses
    const pulseScale = 1 + 0.1 * Math.sin(frame * 0.08);
    podPlatform.querySelector('.platform-scanner-beam').style.transform = `rotateX(-65deg) translateZ(50px) scaleX(${pulseScale})`;

    // Emit particles directly from drone thruster rotors
    drawHoloParticles(frame, 0, 576, 512 + swayX);
  }

  // ─────────────────────────────────────────────────
  // PHASE 3: HOLOGRAM_LOCKER (25s - 37s)
  // ─────────────────────────────────────────────────
  else if (frame >= P3 && frame < P4) {
    activateScene('locker');

    const lt = (frame - P3) / (P4 - P3);

    // Locker door opening angles
    const doorOpenT = clamp(lt * 2.5, 0, 1); // doors open quickly at start
    const doorAngle = lerp(0, 115, easeInOutCubic(doorOpenT));
    doorL.style.transform = `rotateY(-${doorAngle}deg)`;
    doorR.style.transform = `rotateY(${doorAngle}deg)`;

    // Inside locker light flare
    const coreGlow = lockerWrapper.querySelector('.locker-core-glow');
    coreGlow.style.opacity = doorOpenT;

    // Hologram Projection Cone fades in
    if (lt >= 0.2) {
      const coneT = clamp((lt - 0.2) * 2, 0, 1);
      holoCone.style.opacity = coneT;
    } else {
      holoCone.style.opacity = '0';
    }

    // Holographic Package floats & spins
    if (lt >= 0.3) {
      const packT = clamp((lt - 0.3) * 1.8, 0, 1);
      const floatSway = Math.sin(frame * 0.04) * 8;
      const spinAngle = (frame - P3) * 1.5;

      holoPackage.style.opacity = packT;
      // package ascends out of the locker and rotates
      holoPackage.style.transform = `translateY(${lerp(30, -50, easeOutBack(packT)) + floatSway}px) rotateY(${spinAngle}deg) rotateX(20deg) scale(${lerp(0.5, 1, packT)})`;
    } else {
      holoPackage.style.opacity = '0';
    }

    drawHoloParticles(frame, 100, 480, 512);
  }

  // ─────────────────────────────────────────────────
  // PHASE 4: SKYLINE_REVEAL (37s - 45s)
  // ─────────────────────────────────────────────────
  else if (frame >= P4) {
    activateScene('skyline');

    const st = (frame - P4) / (TOTAL_FRAMES - P4);

    // Brand Block entry
    skylineBrand.style.opacity = st;
    const scaleVal = lerp(0.85, 1, easeOutElastic(clamp(st * 1.5, 0, 1)));
    skylineBrand.style.transform = `scale(${scaleVal})`;

    // Arrow SVG tracing
    const arrowPath = skylineBrand.querySelector('.sky-arrow-path');
    const pathLen = arrowPath.getTotalLength ? arrowPath.getTotalLength() : 340;
    arrowPath.style.strokeDasharray = pathLen;
    
    const traceT = clamp((st - 0.2) * 2, 0, 1);
    arrowPath.style.strokeDashoffset = pathLen * (1 - easeInOutCubic(traceT));

    // Stats Grid fade entries
    const cards = skylineBrand.querySelectorAll('.holo-stat-card');
    cards.forEach((card, idx) => {
      const cardF = P4 + 40 + idx * 20;
      if (frame >= cardF) {
        const ct = clamp((frame - cardF) / 20, 0, 1);
        card.style.opacity = ct;
        card.style.transform = `translateY(${lerp(15, 0, easeOutBack(ct))}px)`;
      } else {
        card.style.opacity = '0';
        card.style.transform = 'translateY(15px)';
      }
    });

    drawHoloParticles(frame, 0, 576);
  }
}

// ═══════════════════════════════════════════════════════════
// ANIMATION ENGINE LOOP (with tab inactive freeze protection)
// ═══════════════════════════════════════════════════════════
function animateTick(timestamp) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  const elapsedMs = Math.min(timestamp - lastTimestamp, 100); // CAP TIME STEP
  lastTimestamp = timestamp;

  if (isPlaying) {
    currentFrame += (elapsedMs / 1000) * FPS * playSpeed;
    if (currentFrame >= TOTAL_FRAMES) {
      currentFrame = 0;
    }
    renderTimeline(currentFrame);
  }
  requestAnimationFrame(animateTick);
}

// ── Control Event Handlers ──
btnPlay.addEventListener('click', () => {
  isPlaying = !isPlaying;
  btnPlay.textContent = isPlaying ? 'PAUSE_SYSTEM' : 'RUN_SYSTEM';
  btnPlay.classList.toggle('btn-action', isPlaying);
  btnPlay.classList.toggle('btn-secondary', !isPlaying);
});

btnRestart.addEventListener('click', () => {
  currentFrame = 0;
  renderTimeline(0);
  if (!isPlaying) {
    isPlaying = true;
    btnPlay.textContent = 'PAUSE_SYSTEM';
    btnPlay.classList.remove('btn-secondary');
    btnPlay.classList.add('btn-action');
  }
});

freqBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    freqBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    playSpeed = parseFloat(btn.dataset.speed);
  });
});

slider.addEventListener('input', (e) => {
  currentFrame = parseInt(e.target.value, 10);
  renderTimeline(currentFrame);
  if (isPlaying) {
    isPlaying = false;
    btnPlay.textContent = 'RUN_SYSTEM';
    btnPlay.classList.remove('btn-action');
    btnPlay.classList.add('btn-secondary');
  }
});

consoleNodes.forEach(node => {
  node.addEventListener('click', () => {
    currentFrame = parseInt(node.dataset.frame, 10);
    renderTimeline(currentFrame);
    if (isPlaying) {
      isPlaying = false;
      btnPlay.textContent = 'RUN_SYSTEM';
      btnPlay.classList.remove('btn-action');
      btnPlay.classList.add('btn-secondary');
    }
  });
});

// URL frame parameter support for testing
const urlParams = new URLSearchParams(window.location.search);
const frameParam = urlParams.get('frame');
if (frameParam !== null) {
  currentFrame = parseInt(frameParam, 10);
  isPlaying = false;
  btnPlay.textContent = 'RUN_SYSTEM';
  btnPlay.classList.remove('btn-action');
  btnPlay.classList.add('btn-secondary');
}

// ── Boot ──
renderTimeline(currentFrame);
requestAnimationFrame(animateTick);
