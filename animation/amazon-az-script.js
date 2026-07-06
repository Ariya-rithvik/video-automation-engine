// ═══════════════════════════════════════════════════════════
// AMAZON A-TO-Z UNIVERSE — 45s COSMIC ANIMATION TIMELINE
// ═══════════════════════════════════════════════════════════

const TOTAL_FRAMES = 1350; // 45s @ 30fps
const FPS = 30;

// Phase boundaries
const P1 = 0;     // The Spark (0s – 9s)
const P2 = 270;   // Ecosystem Carousel (9s – 22s)
const P3 = 660;   // Convergence River (22s – 34s)
const P4 = 1020;  // Brand Supernova (34s – 45s)

let currentFrame = 0;
let isPlaying = true;
let playSpeed = 1.0;
let lastTimestamp = 0;

// ── DOM References ──
const sceneSpark     = document.getElementById('scene-spark');
const sceneEcosystem = document.getElementById('scene-ecosystem');
const sceneRiver     = document.getElementById('scene-river');
const sceneSupernova = document.getElementById('scene-supernova');

// Spark scene
const sparkCenter    = document.getElementById('spark-center');
const smilePath      = document.getElementById('smile-path');
const smileArrowhead = document.getElementById('smile-arrowhead');
const letterA        = document.getElementById('letter-a');
const letterZ        = document.getElementById('letter-z');
const portalWrapper  = document.getElementById('portal-wrapper');

// Ecosystem
const orbAlexa = document.getElementById('orb-alexa');
const orbVideo = document.getElementById('orb-video');
const orbAws   = document.getElementById('orb-aws');
const orbKindle = document.getElementById('orb-kindle');
const orbShop  = document.getElementById('orb-shop');
const allOrbs = [orbAlexa, orbVideo, orbAws, orbKindle, orbShop];
const tunnelRings = document.getElementById('tunnel-rings');

// River
const counterBlock = document.getElementById('counter-block');
const counterProductsNum = document.getElementById('counter-products-num');
const counterMembersNum  = document.getElementById('counter-members-num');
const convergencePoint   = document.getElementById('convergence-point');

// Supernova
const shockwave    = document.getElementById('shockwave');
const brandBlock   = document.getElementById('brand-block');
const snLogo       = document.getElementById('sn-logo');
const snSmile      = document.getElementById('sn-smile');
const snTagline    = document.getElementById('sn-tagline');
const snSubtitle   = document.getElementById('sn-subtitle');
const snStat1      = document.getElementById('sn-stat-1');
const snStat2      = document.getElementById('sn-stat-2');
const snStat3      = document.getElementById('sn-stat-3');

// Overlays
const celebrationToast = document.getElementById('celebration-toast');
const confettiCanvas   = document.getElementById('confetti-canvas');
const confCtx          = confettiCanvas.getContext('2d');
const particleCanvas   = document.getElementById('particle-canvas');
const pCtx             = particleCanvas.getContext('2d');

// Controls
const btnPlay        = document.getElementById('btn-play');
const btnRestart     = document.getElementById('btn-restart');
const speedBtns      = document.querySelectorAll('.speed-btn');
const slider         = document.getElementById('timeline-slider');
const currentTimeEl  = document.getElementById('current-time');
const stepIndicators = document.querySelectorAll('.step-indicator');

// ── Canvas sizes ──
function resizeCanvases() {
  particleCanvas.width = confettiCanvas.width = 1024;
  particleCanvas.height = confettiCanvas.height = 576;
}
resizeCanvases();
window.addEventListener('resize', resizeCanvases);

// ── SVG Path Length ──
let smilePathLength = 0;
try { smilePathLength = smilePath.getTotalLength(); } catch(e) { smilePathLength = 340; }
smilePath.style.strokeDasharray = smilePathLength;
smilePath.style.strokeDashoffset = smilePathLength;

// ── Tunnel rings generation ──
(function createTunnelRings() {
  tunnelRings.innerHTML = '';
  for (let i = 0; i < 12; i++) {
    const ring = document.createElement('div');
    const size = 500 - i * 35;
    ring.style.cssText = `
      position:absolute; top:50%; left:50%;
      width:${size}px; height:${size}px;
      border:1.2px solid rgba(255,153,0,${0.04 + i*0.015});
      border-radius:50%;
      transform:translate(-50%,-50%) translateZ(${-i * 60}px);
      box-shadow: inset 0 0 ${10 + i*3}px rgba(0,212,255,${0.02 + i*0.005});
    `;
    tunnelRings.appendChild(ring);
  }
})();

// ── Easing Functions ──
function lerp(a, b, t) { return (1 - t) * a + t * b; }
function clamp01(t) { return Math.max(0, Math.min(1, t)); }
function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }
function easeInCubic(x) { return x * x * x; }
function easeInOutQuad(x) { return x < 0.5 ? 2*x*x : 1 - Math.pow(-2*x+2, 2)/2; }
function easeOutBack(x) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x-1, 3) + c1 * Math.pow(x-1, 2);
}
function easeOutQuint(x) { return 1 - Math.pow(1-x, 5); }
function easeOutElastic(x) {
  if (x === 0 || x === 1) return x;
  return Math.pow(2, -10*x) * Math.sin((x*10-0.75)*(2*Math.PI)/3) + 1;
}

// ── Orb Positions (orbital layout around center) ──
const ORB_POSITIONS = [
  { cx: 140, cy: 120 },  // Alexa — top left
  { cx: 820, cy: 100 },  // Video — top right
  { cx: 512, cy: 80 },   // AWS — top center
  { cx: 180, cy: 430 },  // Kindle — bottom left
  { cx: 830, cy: 410 },  // Shopping — bottom right
];

// ── Background Particle System ──
const BG_PARTICLES = [];
const BG_PARTICLE_COUNT = 80;
for (let i = 0; i < BG_PARTICLE_COUNT; i++) {
  BG_PARTICLES.push({
    x: Math.random() * 1024,
    y: Math.random() * 576,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    r: 0.5 + Math.random() * 1.5,
    alpha: 0.15 + Math.random() * 0.35,
    color: Math.random() > 0.5 ? '#ff9900' : '#00d4ff',
  });
}

function drawBgParticles(frame, mode) {
  for (const p of BG_PARTICLES) {
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0) p.x = 1024;
    if (p.x > 1024) p.x = 0;
    if (p.y < 0) p.y = 576;
    if (p.y > 576) p.y = 0;

    pCtx.beginPath();
    pCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    pCtx.fillStyle = p.color;
    pCtx.globalAlpha = p.alpha * (0.6 + 0.4 * Math.sin(frame * 0.02 + p.x));
    pCtx.fill();
  }
  pCtx.globalAlpha = 1;
}

// ── River Particle System ──
const RIVER_PARTICLES = [];
const RIVER_COUNT = 200;
const RIVER_ICONS = ['📦', '▶', '☁', '📚', '🛒', '✦', '◆'];
for (let i = 0; i < RIVER_COUNT; i++) {
  RIVER_PARTICLES.push({
    x: Math.random() * 1200 - 100,
    y: Math.random() * 576,
    speed: 0.5 + Math.random() * 2.5,
    size: 2 + Math.random() * 4,
    color: ['#ff9900','#00d4ff','#ffcc00','#fff','#00d4ff'][i % 5],
    waveAmp: 10 + Math.random() * 40,
    waveFreq: 0.01 + Math.random() * 0.03,
    phase: Math.random() * Math.PI * 2,
  });
}

function drawRiverParticles(frame, convergenceT) {
  const cx = 512, cy = 480; // convergence target
  for (const p of RIVER_PARTICLES) {
    // Base flow: left to right with sine wave
    let px = (p.x + frame * p.speed * 0.8) % 1200 - 100;
    let py = p.y + Math.sin(frame * p.waveFreq + p.phase) * p.waveAmp;

    // As convergenceT increases, particles are pulled toward singularity
    if (convergenceT > 0) {
      px = lerp(px, cx, convergenceT * convergenceT * 0.8);
      py = lerp(py, cy, convergenceT * convergenceT * 0.8);
    }

    const alpha = convergenceT > 0.8 ? lerp(1, 0, (convergenceT - 0.8) / 0.2) : 1;

    pCtx.beginPath();
    pCtx.arc(px, py, p.size * (1 - convergenceT * 0.5), 0, Math.PI * 2);
    pCtx.fillStyle = p.color;
    pCtx.globalAlpha = 0.5 * alpha;
    pCtx.fill();

    // Small trail
    pCtx.beginPath();
    pCtx.moveTo(px, py);
    pCtx.lineTo(px - p.speed * 8, py);
    pCtx.strokeStyle = p.color;
    pCtx.globalAlpha = 0.15 * alpha;
    pCtx.lineWidth = p.size * 0.6;
    pCtx.stroke();
  }
  pCtx.globalAlpha = 1;
}

// ── Confetti Seeds ──
const CONFETTI_COUNT = 120;
const confettiSeeds = [];
const confettiColors = ['#ff9900','#00d4ff','#ffcc00','#fff','#ff6600','#00a8e8'];
for (let i = 0; i < CONFETTI_COUNT; i++) {
  const angle = (0.8 + Math.abs(Math.sin(i*77.7)) * 0.8) * Math.PI;
  const speed = 3 + Math.abs(Math.cos(i*33.3)) * 14;
  confettiSeeds.push({
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: 4 + Math.abs(Math.sin(i*12.1)) * 7,
    color: confettiColors[i % confettiColors.length],
    rotSpeed: -6 + Math.abs(Math.cos(i*55.5)) * 12,
    rotOffset: Math.abs(Math.sin(i*9.9)) * 360,
  });
}

function drawConfetti(t) {
  confCtx.clearRect(0, 0, 1024, 576);
  if (t <= 0) return;
  const gravity = 0.3, sx = 512, sy = 250;
  for (let i = 0; i < CONFETTI_COUNT; i++) {
    const s = confettiSeeds[i];
    let dx = s.vx * t, dy = s.vy * t + 0.5 * gravity * t * t;
    let cx = sx + dx, cy = sy + dy;
    if (cy > 560) cy = 560;
    let alpha = t > 40 ? Math.max(0, 1 - (t-40)/30) : 1;
    if (alpha <= 0) continue;
    const rot = (s.rotOffset + t * s.rotSpeed) * Math.PI / 180;
    confCtx.save();
    confCtx.translate(cx, cy);
    confCtx.rotate(rot);
    confCtx.fillStyle = s.color;
    confCtx.globalAlpha = alpha;
    confCtx.fillRect(-s.size/2, -s.size/2, s.size, s.size);
    confCtx.restore();
  }
}

// ── Scene Activator ──
function activateScene(name) {
  sceneSpark.classList.toggle('active', name === 'spark');
  sceneEcosystem.classList.toggle('active', name === 'ecosystem');
  sceneRiver.classList.toggle('active', name === 'river');
  sceneSupernova.classList.toggle('active', name === 'supernova');
}

// ── Format number with suffix ──
function formatNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(0) + 'M+';
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K+';
  return Math.floor(n).toString();
}

// Caching
let lastProducts = '', lastMembers = '';

// ═══════════════════════════════════════════════════════════
// MAIN RENDER
// ═══════════════════════════════════════════════════════════
function updateShowcase(frame) {
  slider.value = Math.floor(frame);
  currentTimeEl.textContent = `${(frame / FPS).toFixed(2)}s`;

  stepIndicators.forEach((ind, idx) => {
    const start = parseInt(ind.dataset.frame, 10);
    const next = stepIndicators[idx + 1] ? parseInt(stepIndicators[idx + 1].dataset.frame, 10) : TOTAL_FRAMES;
    ind.classList.toggle('active', frame >= start && frame < next);
  });

  // Clear particle canvas
  pCtx.clearRect(0, 0, 1024, 576);
  confCtx.clearRect(0, 0, 1024, 576);
  celebrationToast.classList.remove('active');

  // ─────────────────────────────────────────────────
  // PHASE 1: The Spark (0 – 270 / 0s – 9s)
  // ─────────────────────────────────────────────────
  if (frame >= P1 && frame < P2) {
    activateScene('spark');
    drawBgParticles(frame, 'spark');

    // Smile arrow tracing (frames 30 - 120)
    const traceT = clamp01((frame - 30) / 90);
    const offset = smilePathLength * (1 - easeInOutQuad(traceT));
    smilePath.style.strokeDashoffset = offset;

    // Arrowhead appears (frame 115)
    if (frame >= 115) {
      const ahT = clamp01((frame - 115) / 10);
      smileArrowhead.setAttribute('opacity', ahT);
    } else {
      smileArrowhead.setAttribute('opacity', '0');
    }

    // A and Z letters fade in (frame 60 - 100)
    if (frame >= 60) {
      const ltT = clamp01((frame - 60) / 40);
      letterA.style.opacity = ltT;
      letterA.style.transform = `translateY(-50%) translateX(${lerp(-30, 0, easeOutCubic(ltT))}px)`;
      letterZ.style.opacity = ltT;
      letterZ.style.transform = `translateY(-50%) translateX(${lerp(30, 0, easeOutCubic(ltT))}px)`;
    } else {
      letterA.style.opacity = '0';
      letterZ.style.opacity = '0';
    }

    // Spark center floats gently
    const bob = Math.sin(frame / 14 * Math.PI) * 4;
    sparkCenter.style.transform = `translateY(${bob}px)`;

    // Portal wormhole appears (frame 160 - 260)
    if (frame >= 160) {
      const portalT = clamp01((frame - 160) / 60);
      portalWrapper.style.opacity = portalT;
      portalWrapper.style.transform = `translate(-50%, -50%) scale(${lerp(0, 1.0, easeOutBack(portalT))})`;

      // Smile and letters fade out as portal takes over
      if (frame >= 200) {
        const fadeT = clamp01((frame - 200) / 50);
        sparkCenter.style.opacity = 1 - fadeT;
      }

      // Portal zoom in (frame 230 - 270)
      if (frame >= 230) {
        const zoomT = clamp01((frame - 230) / 40);
        portalWrapper.style.transform = `translate(-50%, -50%) scale(${lerp(1.0, 8.0, easeInCubic(zoomT))})`;
        portalWrapper.style.opacity = 1 - zoomT;
      }
    } else {
      portalWrapper.style.opacity = '0';
      portalWrapper.style.transform = 'translate(-50%, -50%) scale(0)';
      sparkCenter.style.opacity = '1';
    }
  }

  // ─────────────────────────────────────────────────
  // PHASE 2: Ecosystem Carousel (270 – 660 / 9s – 22s)
  // ─────────────────────────────────────────────────
  else if (frame >= P2 && frame < P3) {
    activateScene('ecosystem');
    drawBgParticles(frame, 'ecosystem');

    // Tunnel rings rotation
    const tunnelRotZ = (frame - P2) * 0.3;
    tunnelRings.style.transform = `rotateZ(${tunnelRotZ}deg)`;
    const tunnelPulse = 0.85 + 0.15 * Math.sin(frame * 0.04);
    tunnelRings.style.opacity = tunnelPulse;

    // Staggered orb entrances
    const orbEntryFrames = [300, 360, 420, 480, 540];
    allOrbs.forEach((orb, i) => {
      const entryF = orbEntryFrames[i];
      const pos = ORB_POSITIONS[i];

      if (frame >= entryF) {
        const t = clamp01((frame - entryF) / 40);
        const scale = lerp(0.3, 1.0, easeOutBack(t));
        const alpha = t;

        // Orbital floating offset
        const floatX = Math.sin((frame - entryF) * 0.015 + i * 1.2) * 12;
        const floatY = Math.cos((frame - entryF) * 0.02 + i * 0.8) * 8;

        orb.style.opacity = alpha;
        orb.style.transform = `scale(${scale})`;
        orb.style.left = `${pos.cx + floatX - 45}px`;
        orb.style.top = `${pos.cy + floatY - 45}px`;
      } else {
        orb.style.opacity = '0';
        orb.style.transform = 'scale(0.3)';
        orb.style.left = `${pos.cx - 45}px`;
        orb.style.top = `${pos.cy - 45}px`;
      }

      // Orb exit: shrink out near end of phase (frame 620 - 660)
      if (frame >= 620) {
        const exitT = clamp01((frame - 620) / 40);
        orb.style.opacity = 1 - exitT;
        orb.style.transform = `scale(${lerp(1.0, 0.2, exitT)})`;
      }
    });

    // Draw data stream lines connecting orbs on the particle canvas
    if (frame >= 420 && frame < 620) {
      const streamAlpha = frame < 600 ? 0.3 : 0.3 * (1 - (frame - 600) / 20);
      pCtx.strokeStyle = '#ff9900';
      pCtx.lineWidth = 1.5;
      pCtx.globalAlpha = streamAlpha;
      
      // Draw flowing dotted lines between orbs
      const dashOffset = frame * 2;
      pCtx.setLineDash([4, 8]);
      pCtx.lineDashOffset = -dashOffset;
      
      for (let i = 0; i < ORB_POSITIONS.length - 1; i++) {
        const a = ORB_POSITIONS[i], b = ORB_POSITIONS[i+1];
        pCtx.beginPath();
        pCtx.moveTo(a.cx, a.cy);
        const mx = (a.cx + b.cx) / 2, my = (a.cy + b.cy) / 2 - 30;
        pCtx.quadraticCurveTo(mx, my, b.cx, b.cy);
        pCtx.stroke();
      }
      // Connect last to first
      const first = ORB_POSITIONS[0], last = ORB_POSITIONS[ORB_POSITIONS.length-1];
      pCtx.beginPath();
      pCtx.moveTo(last.cx, last.cy);
      pCtx.quadraticCurveTo(512, 288, first.cx, first.cy);
      pCtx.stroke();
      
      pCtx.setLineDash([]);
      pCtx.globalAlpha = 1;
    }
  }

  // ─────────────────────────────────────────────────
  // PHASE 3: Convergence River (660 – 1020 / 22s – 34s)
  // ─────────────────────────────────────────────────
  else if (frame >= P3 && frame < P4) {
    activateScene('river');

    const phaseLen = P4 - P3;
    const phaseT = (frame - P3) / phaseLen;

    // Convergence pull (ramps up in last 40% of phase)
    const convergePull = phaseT > 0.6 ? (phaseT - 0.6) / 0.4 : 0;

    drawRiverParticles(frame, convergePull);

    // Counter block appearance (frame 700 - 720)
    if (frame >= 700) {
      const cT = clamp01((frame - 700) / 25);
      counterBlock.querySelector('#counter-products').style.opacity = cT;
      counterBlock.querySelector('#counter-products').style.transform = `translateY(${lerp(20, 0, easeOutCubic(cT))}px)`;
    }
    if (frame >= 730) {
      const cT = clamp01((frame - 730) / 25);
      counterBlock.querySelector('#counter-members').style.opacity = cT;
      counterBlock.querySelector('#counter-members').style.transform = `translateY(${lerp(20, 0, easeOutCubic(cT))}px)`;
    }

    // Counter values tick up
    if (frame >= 700) {
      const countT = clamp01((frame - 700) / 250);
      const products = Math.floor(easeOutQuint(countT) * 350000000);
      const members  = Math.floor(easeOutQuint(countT) * 200000000);
      const pStr = formatNum(products);
      const mStr = formatNum(members);
      if (pStr !== lastProducts) { counterProductsNum.textContent = pStr; lastProducts = pStr; }
      if (mStr !== lastMembers) { counterMembersNum.textContent = mStr; lastMembers = mStr; }
    }

    // Convergence singularity point grows (frame 900 - 1020)
    if (frame >= 900) {
      const sT = clamp01((frame - 900) / 80);
      convergencePoint.style.transform = `translateX(-50%) scale(${lerp(0, 2.5, easeOutCubic(sT))})`;

      // Counters fade
      if (frame >= 960) {
        const fT = clamp01((frame - 960) / 40);
        counterBlock.style.opacity = 1 - fT;
      }
    } else {
      convergencePoint.style.transform = 'translateX(-50%) scale(0)';
    }
  }

  // ─────────────────────────────────────────────────
  // PHASE 4: Brand Supernova (1020 – 1350 / 34s – 45s)
  // ─────────────────────────────────────────────────
  else if (frame >= P4) {
    activateScene('supernova');

    // Shockwave ring expansion (1020 - 1060)
    if (frame < 1060) {
      const swT = clamp01((frame - 1020) / 40);
      const swScale = lerp(0, 60, easeOutCubic(swT));
      shockwave.style.transform = `translate(-50%, -50%) scale(${swScale})`;
      shockwave.style.opacity = 1 - swT;
    } else {
      shockwave.style.opacity = '0';
    }

    // Logo entrance (frame 1050)
    if (frame >= 1050) {
      const logoT = clamp01((frame - 1050) / 30);
      brandBlock.style.opacity = '1';
      brandBlock.style.transform = 'scale(1)';
      snLogo.style.opacity = logoT;
      snLogo.style.transform = `scale(${lerp(0.5, 1.0, easeOutElastic(logoT))})`;
    } else {
      brandBlock.style.opacity = '0';
      snLogo.style.opacity = '0';
    }

    // Smile arrow swoops in (frame 1080)
    if (frame >= 1080) {
      const smT = clamp01((frame - 1080) / 25);
      snSmile.style.opacity = smT;
      snSmile.style.transform = `translateX(${lerp(-60, 0, easeOutCubic(smT))}px)`;
    } else {
      snSmile.style.opacity = '0';
      snSmile.style.transform = 'translateX(-60px)';
    }

    // Tagline (frame 1110)
    if (frame >= 1110) {
      const tT = clamp01((frame - 1110) / 25);
      snTagline.style.opacity = tT;
      snTagline.style.transform = `translateY(${lerp(15, 0, easeOutCubic(tT))}px)`;
    } else {
      snTagline.style.opacity = '0';
      snTagline.style.transform = 'translateY(15px)';
    }

    // Subtitle (frame 1130)
    if (frame >= 1130) {
      const sT = clamp01((frame - 1130) / 20);
      snSubtitle.style.opacity = sT;
      snSubtitle.style.transform = `translateY(${lerp(10, 0, easeOutCubic(sT))}px)`;
    } else {
      snSubtitle.style.opacity = '0';
      snSubtitle.style.transform = 'translateY(10px)';
    }

    // Stats cards staggered (1160, 1185, 1210)
    [snStat1, snStat2, snStat3].forEach((el, i) => {
      const sf = 1160 + i * 25;
      if (frame >= sf) {
        const t = clamp01((frame - sf) / 25);
        el.style.opacity = t;
        el.style.transform = `translateY(${lerp(20, 0, easeOutCubic(t))}px)`;
      } else {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
      }
    });

    // Toast (frame 1140)
    if (frame >= 1140) {
      celebrationToast.classList.add('active');
    }

    // Confetti blast (frame 1100)
    const confT = frame - 1100;
    if (confT > 0) {
      drawConfetti(confT);
    }

    // Background star particles
    drawBgParticles(frame, 'supernova');
  }
}

// ═══════════════════════════════════════════════════════════
// PLAYBACK ENGINE (with freeze protection)
// ═══════════════════════════════════════════════════════════
function tick(timestamp) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  const elapsedMs = Math.min(timestamp - lastTimestamp, 100); // FREEZE PROTECTOR
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
  lastProducts = ''; lastMembers = '';
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
  lastProducts = ''; lastMembers = '';
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
    lastProducts = ''; lastMembers = '';
    updateShowcase(currentFrame);
    if (isPlaying) {
      isPlaying = false;
      btnPlay.textContent = 'Play';
      btnPlay.classList.remove('btn-primary');
      btnPlay.classList.add('btn-secondary');
    }
  });
});

// URL frame support
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
