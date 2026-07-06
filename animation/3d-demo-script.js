// ══════════════════════════════════════════════════════════════════
// ADE ⚡ 3D Isometric & Kinetic Physics Demo Script
// ══════════════════════════════════════════════════════════════════

const FPS = 30;
const TOTAL_FRAMES = 900; // 30 seconds at 30 FPS

let currentFrame = 0;
let isPlaying = true;
let playSpeed = 1.0;
let lastTimestamp = 0;

// DOM Elements
const viewport = document.getElementById('viewport');
const cameraCanvas = document.getElementById('camera-canvas');
const phone3d = document.getElementById('phone-3d');
const glareLayer = document.getElementById('glare-layer');
const triggerBtn = document.getElementById('trigger-btn');
const appCard = document.getElementById('app-card');
const physicsCanvas = document.getElementById('physics-canvas');
const ctx = physicsCanvas.getContext('2d');

const virtualCursor = document.getElementById('virtual-cursor');
const cursorRipple = document.getElementById('cursor-ripple');
const holoPanel1 = document.getElementById('holo-panel-1');
const holoPanel2 = document.getElementById('holo-panel-2');

const btnPlay = document.getElementById('btn-play');
const btnRestart = document.getElementById('btn-restart');
const speedBtns = document.querySelectorAll('.speed-btn');
const slider = document.getElementById('timeline-slider');
const currentTimeEl = document.getElementById('current-time');
const stepIndicators = document.querySelectorAll('.step-indicator');

const btnExport = document.getElementById('btn-export');
const exportOverlay = document.getElementById('export-overlay');
const exportStatusTxt = document.getElementById('export-status-txt');
const exportProgressTxt = document.getElementById('export-progress-txt');

// Initialize Canvas Dimensions to match layout
physicsCanvas.width = 288;  // Matches screen width inside bezels
physicsCanvas.height = 598; // Matches screen height inside bezels

// Helper Easing Functions
const lerp = (a, b, t) => (1 - t) * a + t * b;
const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
const easeInOutQuad = (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
const easeOutBack = (x) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

// ─── Deterministic Physics Simulation (idempotent, fully scrub-syncable) ───
function getPhysicsFrameState(frame) {
  const launchFrame = 420; // Frame when cursor click impacts button
  const numParticles = 70;
  let particles = [];

  // Seeded pseudo-random generator to ensure identical velocities on every scrub
  function seededRandom(seed) {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }

  // Populate initial particles
  let seed = 1.0;
  for (let i = 0; i < numParticles; i++) {
    const angle = (i / numParticles) * Math.PI * 2 + (seededRandom(seed++) - 0.5) * 0.4;
    const speed = 3.5 + seededRandom(seed++) * 13;
    const colorHue = Math.floor(seededRandom(seed++) * 360);
    particles.push({
      x: 144, // Bezel center (288 / 2)
      y: 350, // Card trigger button center (approx)
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 6, // Upward burst offset
      radius: 3.5 + (i % 4),
      color: `hsla(${colorHue}, 90%, 65%, 0.85)`
    });
  }

  const gravity = 0.38;
  const bounce = 0.74;
  const drag = 0.982;

  // Run simulation ticks deterministically up to the current frame
  const physicsTicks = Math.max(0, frame - launchFrame);
  for (let step = 0; step < physicsTicks; step++) {
    particles.forEach(p => {
      p.vy += gravity;
      p.vx *= drag;
      p.vy *= drag;
      p.x += p.vx;
      p.y += p.vy;

      // Elastic wall collision left
      if (p.x - p.radius < 0) {
        p.x = p.radius;
        p.vx = -p.vx * bounce;
      } 
      // Elastic wall collision right
      else if (p.x + p.radius > 288) {
        p.x = 288 - p.radius;
        p.vx = -p.vx * bounce;
      }

      // Elastic wall collision top
      if (p.y - p.radius < 0) {
        p.y = p.radius;
        p.vy = -p.vy * bounce;
      } 
      // Elastic wall collision bottom
      else if (p.y + p.radius > 598) {
        p.y = 598 - p.radius;
        p.vy = -p.vy * bounce;
        p.vx *= 0.96; // Ground friction
      }
    });
  }

  return particles;
}

// ─── The Main Update Showcase Loop ───
function updateShowcase(frame) {
  slider.value = Math.floor(frame);
  currentTimeEl.textContent = `${(frame / FPS).toFixed(2)}s`;

  // Step Indicators Highlight logic
  stepIndicators.forEach((ind) => {
    const start = parseInt(ind.dataset.frame, 10);
    const idx = Array.from(stepIndicators).indexOf(ind);
    const next = stepIndicators[idx + 1] ? parseInt(stepIndicators[idx + 1].dataset.frame, 10) : TOTAL_FRAMES;
    ind.classList.toggle('active', frame >= start && frame < next);
  });

  let scale = 1.0;
  let tx = 0, ty = 0;
  let rx = 0, ry = 0, rz = 0;
  let glareX = 50, glareY = 50;
  let cursorOpacity = 0;
  let clickWaveActive = false;
  let phoneSeparated = false;

  // Clear Canvas
  ctx.clearRect(0, 0, 288, 598);

  // 1. PHASE 1: 3D Isometric Rotation Orbit (Frames 0 - 300)
  if (frame >= 0 && frame < 300) {
    const t = frame / 300;
    const easedT = easeInOutQuad(t);
    
    // Slow cinematic 3D rotating orbit
    rx = lerp(20, 0, easedT);
    ry = lerp(-25, 0, easedT);
    rz = lerp(5, 0, easedT);

    // Glare moves relative to rotation
    glareX = 50 + ry * 1.5;
    glareY = 50 + rx * 1.5;
    
    scale = 1.0;
    virtualCursor.style.display = 'none';
  }

  // 2. PHASE 2: Physics Click Demonstration (Frames 300 - 600)
  else if (frame >= 300 && frame < 600) {
    virtualCursor.style.display = 'block';
    
    // Phone stays flat front-facing
    rx = 0; ry = 0; rz = 0;
    glareX = 50; glareY = 50;

    const localT = (frame - 300) / 300;
    
    // Virtual cursor travels from bottom right, hovers button, clicks, then leaves
    let curX = 900;
    let curY = 500;
    cursorOpacity = 1.0;

    const buttonCenter = { x: 512, y: 312 }; // Canvas center coordinates mapped to viewport stage

    if (localT < 0.35) {
      // Travel to button
      const tTravel = easeInOutQuad(localT / 0.35);
      curX = lerp(900, buttonCenter.x, tTravel);
      curY = lerp(500, buttonCenter.y, tTravel);
    } 
    else if (localT >= 0.35 && localT < 0.45) {
      // Hover at button, then click at 0.40 (frame 420)
      curX = buttonCenter.x;
      curY = buttonCenter.y;
      
      const clickMoment = 420;
      if (frame >= clickMoment && frame < clickMoment + 8) {
        // Squish button scale
        triggerBtn.style.transform = 'scale(0.92)';
        appCard.style.transform = 'translateZ(10px) scale(0.96)';
        if (frame === clickMoment) clickWaveActive = true;
      } else {
        triggerBtn.style.transform = '';
        appCard.style.transform = '';
      }
    } 
    else {
      // Travel away and fade
      const tLeave = easeInOutQuad((localT - 0.45) / 0.55);
      curX = lerp(buttonCenter.x, 100, tLeave);
      curY = lerp(buttonCenter.y, 450, tLeave);
      cursorOpacity = lerp(1.0, 0.0, tLeave);
    }

    virtualCursor.style.left = `${curX}px`;
    virtualCursor.style.top = `${curY}px`;
    virtualCursor.style.opacity = cursorOpacity;

    // Draw Exploded Vector Physics
    if (frame >= 420) {
      const particles = getPhysicsFrameState(frame);
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.shadowBlur = 0; // reset
      });
    }
  }

  // 3. PHASE 3: Holographic Layer Separation (Frames 600 - 900)
  else if (frame >= 600 && frame <= 900) {
    virtualCursor.style.display = 'none';
    const localT = (frame - 600) / 300;
    const easedT = easeInOutQuad(localT);

    // Tilt phone dramatically in 3D
    rx = lerp(0, 30, easedT);
    ry = lerp(0, -35, easedT);
    rz = lerp(0, 10, easedT);

    // Add slow orbit oscillation at the end
    if (localT > 0.5) {
      const osc = Math.sin((frame - 750) * 0.04);
      ry += osc * 4;
      rx += osc * 2;
    }

    glareX = 50 + ry * 1.2;
    glareY = 50 + rx * 1.2;

    // Trigger holographic pop-out separation via class
    phoneSeparated = true;
    
    // Float in holographic backdrop panels
    const panelOpacity = clamp((localT - 0.2) / 0.5, 0, 1);
    const panelSlide = lerp(-30, 0, easeOutBack(clamp((localT - 0.2) / 0.5, 0, 1)));
    
    holoPanel1.style.opacity = panelOpacity;
    holoPanel1.style.transform = `translateX(${panelSlide}px) translateZ(40px)`;
    
    holoPanel2.style.opacity = panelOpacity;
    holoPanel2.style.transform = `translateX(${-panelSlide}px) translateZ(40px)`;

    // Keep particles moving in physics simulation
    const particles = getPhysicsFrameState(frame);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  }

  // If outside separation phase, hide holographic panels
  if (!phoneSeparated) {
    holoPanel1.style.opacity = 0;
    holoPanel2.style.opacity = 0;
  }

  // Apply transforms
  phone3d.className = `phone-3d ${phoneSeparated ? 'separated' : ''}`;
  phone3d.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`;
  glareLayer.style.backgroundPosition = `${glareX}% ${glareY}%`;
  cursorRipple.classList.toggle('click-wave', clickWaveActive);
}

// ─── Playback Engine Loop ───
function tick(ts) {
  if (!lastTimestamp) lastTimestamp = ts;
  const elapsed = Math.min(ts - lastTimestamp, 100);
  lastTimestamp = ts;

  if (isPlaying) {
    currentFrame += (elapsed / 1000) * FPS * playSpeed;
    if (currentFrame >= TOTAL_FRAMES) {
      currentFrame = 0;
    }
    updateShowcase(currentFrame);
  }
  requestAnimationFrame(tick);
}

// Controls Event Listeners
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

speedBtns.forEach(btn => btn.addEventListener('click', () => {
  speedBtns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  playSpeed = parseFloat(btn.dataset.speed);
}));

slider.addEventListener('input', e => {
  currentFrame = parseInt(e.target.value, 10);
  updateShowcase(currentFrame);
  if (isPlaying) {
    isPlaying = false;
    btnPlay.textContent = 'Play';
    btnPlay.classList.remove('btn-primary');
    btnPlay.classList.add('btn-secondary');
  }
});

// ─── Export to MP4 API Call (The backend recorder pipeline integration) ───
btnExport.addEventListener('click', async () => {
  if (btnExport.classList.contains('disabled')) return;
  
  // Pause animation playback during compile request
  isPlaying = false;
  btnPlay.textContent = 'Play';
  btnPlay.classList.remove('btn-primary');
  btnPlay.classList.add('btn-secondary');

  btnExport.classList.add('disabled');
  exportOverlay.classList.add('visible');
  exportStatusTxt.textContent = "Launching Headless Render Node...";
  exportProgressTxt.textContent = "0% completed";
  
  const currentUrl = window.location.origin + window.location.pathname;

  try {
    const response = await fetch('/api/v1/animation/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: currentUrl,
        totalFrames: 900,
        fps: 30
      })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Export service responded with error");
    }

    // Since headless rendering takes ~10-15s, let's increment a progress counter
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += Math.floor(Math.random() * 6) + 2;
      if (progress >= 96) {
        clearInterval(progressInterval);
      } else {
        exportStatusTxt.textContent = "Capturing 3D Frames & Compiling...";
        exportProgressTxt.textContent = `${progress}% completed`;
      }
    }, 450);

    const result = await response.json();
    clearInterval(progressInterval);

    if (result.success && result.streamUrl) {
      exportStatusTxt.textContent = "✅ Compilation Complete! Downloading...";
      exportProgressTxt.textContent = "100% completed";
      
      // Trigger download using hidden anchor
      const downloadLink = document.createElement('a');
      downloadLink.href = result.streamUrl;
      downloadLink.download = `3d-kinetic-export-${Date.now()}.mp4`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } else {
      throw new Error(result.error || "Failed to produce polished MP4");
    }
  } catch (err) {
    exportStatusTxt.textContent = "❌ Export Process Failed";
    exportProgressTxt.textContent = err.message;
    console.error('[ExportError]', err);
  } finally {
    // Hide overlay after delay
    setTimeout(() => {
      exportOverlay.classList.remove('visible');
      btnExport.classList.remove('disabled');
    }, 4500);
  }
});

// Boot Initializer
window.addEventListener('load', () => {
  updateShowcase(0);
  requestAnimationFrame(tick);
});
