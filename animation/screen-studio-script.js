// ══════════════════════════════════════════════════════════════════
// Screen Studio — Apple Intelligence Rewriter Showcase Script
// ══════════════════════════════════════════════════════════════════

const TOTAL_FRAMES = 900;
const FPS = 30;

// Phase keyframes
const P1_START = 0;   // Draft stage & Play button click
const P2_START = 120; // Text selection drag
const P3_START = 300; // Zoom-in & Sparkle appear
const P4_START = 420; // Click Sparkle & AI rewrite
const P5_START = 780; // Success & Zoom out

let currentFrame = 0;
let isPlaying = true;
let playSpeed = 1.0;
let lastTimestamp = 0;

// DOM Elements
const stage = document.getElementById('stage');
const viewport = document.getElementById('viewport');
const cameraCanvas = document.getElementById('camera-canvas');
const macWindow = document.getElementById('mac-window');
const aiEdgeGlow = document.getElementById('ai-edge-glow');
const aiScreenGlow = document.getElementById('ai-screen-glow');
const textEditor = document.getElementById('text-editor');
const aiSparkleBtn = document.getElementById('ai-sparkle-btn');
const playDemoBtn = document.getElementById('play-demo-btn');
const virtualCursor = document.getElementById('virtual-cursor');
const cursorRipple = document.getElementById('cursor-ripple');
const confettiCanvas = document.getElementById('confetti-canvas');
const cCtx = confettiCanvas.getContext('2d');

const btnPlay = document.getElementById('btn-play');
const btnRestart = document.getElementById('btn-restart');
const speedBtns = document.querySelectorAll('.speed-btn');
const slider = document.getElementById('timeline-slider');
const currentTimeEl = document.getElementById('current-time');
const stepIndicators = document.querySelectorAll('.step-indicator');

// Text Drafts
const origText = "Hey team, this project is taking way too long and I'm annoyed. We need to hurry up and finish by Friday or we're screwed. Let me know what you're doing.";

const newText = `Hi team,

I wanted to check in on our progress. Let's ensure we are aligned to meet our Friday deadline. Please provide a brief update on your current tasks.

Thank you.`;

// Coordinates cache
let coords = {};

// Helpers
const lerp = (a, b, t) => (1 - t) * a + t * b;
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const easeInOutQuad = (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
const easeOutBack = (x) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

function centerIn(el) {
  if (!el || !viewport) return { x: 512, y: 288 };
  const s = viewport.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return {
    x: r.left - s.left + r.width / 2,
    y: r.top - s.top + r.height / 2
  };
}

// Coordinate Mapping for Canvas Zoom
function localToScreen(pt, scale, tx, ty) {
  const cx = 512, cy = 288;
  return {
    x: cx + (pt.x - cx + tx) * scale,
    y: cy + (pt.y - cy + ty) * scale
  };
}

// Initialize character spans for selection
function initTextSpans() {
  textEditor.innerHTML = origText.split('').map((char, index) => {
    if (char === '\n') return '<br>';
    return `<span id="c-${index}">${char}</span>`;
  }).join('');
}

// Update coordinates cache
function updateCoords() {
  const prevTransform = cameraCanvas.style.transform;
  cameraCanvas.style.transform = 'none';
  
  // Force a reflow
  const firstSpan = document.getElementById('c-0');
  const lastSpan = document.getElementById('c-' + (origText.length - 1));
  
  coords.play = centerIn(playDemoBtn);
  coords.startSel = firstSpan ? centerIn(firstSpan) : { x: 236, y: 278 };
  coords.endSel = lastSpan ? centerIn(lastSpan) : { x: 620, y: 310 };
  coords.sparkle = centerIn(aiSparkleBtn);
  
  cameraCanvas.style.transform = prevTransform;
}

// Set cursor style & positions
function setCursor(x, y, opacity, clickActive) {
  virtualCursor.style.left = `${x}px`;
  virtualCursor.style.top = `${y}px`;
  virtualCursor.style.opacity = opacity;
  virtualCursor.style.transform = `translate(-50%, -50%) scale(${clickActive ? 0.8 : 1.0})`;
}

// ══════════════════════════════════════════════════════════════════
// CONFETTI CELEBRATION
// ══════════════════════════════════════════════════════════════════
const CONFETTI_COUNT = 70;
const confettiSeeds = [];
const confettiColors = ['#a855f7', '#ec4899', '#3b82f6', '#f59e0b', '#10b981'];

for (let i = 0; i < CONFETTI_COUNT; i++) {
  const angle = (1.2 + Math.abs(Math.sin(i * 324.5)) * 0.6) * Math.PI;
  const speed = 3 + Math.abs(Math.cos(i * 87.2)) * 12;
  confettiSeeds.push({
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: 4 + Math.abs(Math.sin(i * 129.4)) * 6,
    color: confettiColors[i % confettiColors.length],
    rotSpeed: -5 + Math.abs(Math.cos(i * 543.2)) * 10,
    rotOffset: Math.abs(Math.sin(i * 92.1)) * 360
  });
}

function drawConfetti(t) {
  confettiCanvas.width = viewport.clientWidth;
  confettiCanvas.height = viewport.clientHeight;
  const w = confettiCanvas.width, h = confettiCanvas.height;
  cCtx.clearRect(0, 0, w, h);
  if (t <= 0) return;

  const gravity = 0.22, startX = 512, startY = 180, groundY = h + 20;
  for (let i = 0; i < CONFETTI_COUNT; i++) {
    const s = confettiSeeds[i];
    let dx = s.vx * t, dy = s.vy * t + 0.5 * gravity * t * t;
    let cx = startX + dx, cy = startY + dy;
    
    let opacity = 1.0;
    if (t > 40) opacity = Math.max(0, 1 - (t - 40) / 40);
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

// ══════════════════════════════════════════════════════════════════
// MAIN TIMELINE UPDATE
// ══════════════════════════════════════════════════════════════════
function updateShowcase(frame) {
  slider.value = Math.floor(frame);
  currentTimeEl.textContent = `${(frame / FPS).toFixed(2)}s`;
  
  // Steps active indicators
  stepIndicators.forEach((ind) => {
    const start = parseInt(ind.dataset.frame, 10);
    const idx = Array.from(stepIndicators).indexOf(ind);
    const next = stepIndicators[idx + 1] ? parseInt(stepIndicators[idx + 1].dataset.frame, 10) : TOTAL_FRAMES;
    ind.classList.toggle('active', frame >= start && frame < next);
  });

  // Calculate coordinates if they aren't initialized
  if (!coords.play) {
    updateCoords();
  }

  // Camera Zoom Variables (Computed globally for smooth transition)
  let scale = 1.0;
  let tx = 0;
  let ty = 0;

  if (frame >= 240 && frame < 300) {
    const zoomT = (frame - 240) / 60;
    const ease = easeInOutQuad(zoomT);
    scale = lerp(1.0, 1.45, ease);
    tx = lerp(0, -28, ease);
    ty = lerp(0, 50, ease);
  } else if (frame >= 300 && frame < 780) {
    scale = 1.45;
    tx = -28;
    ty = 50;
  } else if (frame >= 780 && frame < 840) {
    const zoomOutT = (frame - 780) / 60;
    const ease = easeInOutQuad(zoomOutT);
    scale = lerp(1.45, 1.0, ease);
    tx = lerp(-28, 0, ease);
    ty = lerp(50, 0, ease);
  } else {
    scale = 1.0;
    tx = 0;
    ty = 0;
  }

  // AI Glow states
  let edgeGlowOpacity = 0;
  let screenGlowOpacity = 0;
  let sparkleBtnVisible = false;

  // Reset elements default
  playDemoBtn.style.opacity = '1';
  playDemoBtn.style.transform = 'scale(1)';
  aiSparkleBtn.classList.remove('visible');
  macWindow.style.boxShadow = '';
  cCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

  // ── PHASE 1: Draft & Select (0 – 240 / Zoom-in starts at 240) ──
  if (frame < P3_START) {
    initTextSpans();
    virtualCursor.style.display = 'block';
    
    // Play button fades/clicks
    if (frame < 50) {
      playDemoBtn.style.opacity = '1';
      // Cursor moves to Play Demo
      const moveT = clamp01(frame / 30);
      setCursor(
        lerp(800, coords.play.x, easeInOutQuad(moveT)),
        lerp(500, coords.play.y, easeInOutQuad(moveT)),
        1.0,
        frame >= 30 && frame <= 42
      );
      if (frame >= 30 && frame < 40) cursorRipple.classList.add('click-wave');
      else cursorRipple.classList.remove('click-wave');
    } else {
      // Play button shrinks away
      const playOutT = clamp01((frame - 50) / 15);
      playDemoBtn.style.opacity = (1 - playOutT).toString();
      playDemoBtn.style.transform = `scale(${lerp(1, 0.6, playOutT)})`;
      
      // Cursor moves to start selection (55 - 110)
      if (frame < 120) {
        const moveT = clamp01((frame - 55) / 55);
        setCursor(
          lerp(coords.play.x, coords.startSel.x, easeInOutQuad(moveT)),
          lerp(coords.play.y, coords.startSel.y, easeInOutQuad(moveT)),
          1.0,
          false
        );
      }
    }

    // Drag select animation (120 - 200)
    if (frame >= 120 && frame < 240) {
      const selT = clamp01((frame - 120) / 80);
      const selChars = Math.floor(selT * origText.length);
      
      // Select inline elements
      for (let i = 0; i < origText.length; i++) {
        const span = document.getElementById(`c-${i}`);
        if (span) {
          span.classList.toggle('selected', i < selChars);
        }
      }

      // Cursor moves to end of selection
      setCursor(
        lerp(coords.startSel.x, coords.endSel.x, selT),
        lerp(coords.startSel.y, coords.endSel.y, selT),
        1.0,
        false
      );
    }

    // Zoom-in starts but selection completed (240 - 300)
    if (frame >= 240) {
      // All text stays selected
      for (let i = 0; i < origText.length; i++) {
        const span = document.getElementById(`c-${i}`);
        if (span) span.classList.add('selected');
      }
      // Pinned cursor tracks selection end point as it zooms
      const cursorScreen = localToScreen(coords.endSel, scale, tx, ty);
      setCursor(cursorScreen.x, cursorScreen.y, 1.0, false);
    }
  }

  // ── PHASE 2: Sparkle Button & Hover (300 – 420) ──
  else if (frame >= P3_START && frame < P4_START) {
    virtualCursor.style.display = 'block';
    
    // Selection stays active
    initTextSpans();
    for (let i = 0; i < origText.length; i++) {
      const span = document.getElementById(`c-${i}`);
      if (span) span.classList.add('selected');
    }

    playDemoBtn.style.opacity = '0';

    // Sparkle Button scale-up (300 - 330)
    if (frame >= 300) {
      sparkleBtnVisible = true;
      aiSparkleBtn.classList.add('visible');
      
      // Cursor moves to sparkle button
      const moveT = clamp01((frame - 300) / 60);
      const cursorLocal = {
        x: lerp(coords.endSel.x, coords.sparkle.x, easeInOutQuad(moveT)),
        y: lerp(coords.endSel.y, coords.sparkle.y, easeInOutQuad(moveT))
      };
      
      // Translate local coordinate to current zoom screen position
      const cursorScreen = localToScreen(cursorLocal, scale, tx, ty);
      setCursor(cursorScreen.x, cursorScreen.y, 1.0, frame >= 360 && frame <= 372);
      
      if (frame >= 360 && frame < 370) cursorRipple.classList.add('click-wave');
      else cursorRipple.classList.remove('click-wave');
    }

    // Cursor fades out after click (380 - 410)
    if (frame >= 380) {
      const fadeT = clamp01((frame - 380) / 30);
      virtualCursor.style.opacity = (1 - fadeT).toString();
    }
  }

  // ── PHASE 3 & 4: Apple Intelligence Edge Glow & Typewriter Rewrite (420 – 780) ──
  else if (frame >= P4_START && frame < P5_START) {
    virtualCursor.style.display = 'none';
    playDemoBtn.style.opacity = '0';
    
    // Edge & Screen Glow sweeps
    edgeGlowOpacity = clamp01((frame - 420) / 20);
    screenGlowOpacity = edgeGlowOpacity * 0.7;
    macWindow.classList.add('ai-active');

    // Selection highlight fades (420 - 460)
    const highlightFadeT = clamp01((frame - 420) / 40);
    const highlightOpacity = 0.4 * (1 - highlightFadeT);

    // Sparkle button fades out
    aiSparkleBtn.classList.remove('visible');

    // Rewrite states
    if (frame < 460) {
      // Keep original text with fading selection highlight background
      textEditor.innerHTML = origText.split('').map((char, index) => {
        return `<span style="background-color: rgba(59, 130, 246, ${highlightOpacity})">${char}</span>`;
      }).join('');
    } else {
      // Typewriter new text (460 - 740)
      const typeT = clamp01((frame - 460) / 270);
      const charCount = Math.floor(typeT * newText.length);
      const currentTextSlice = newText.substring(0, charCount);
      
      // Render typed chars with Apple Intelligence shine glow
      textEditor.innerHTML = currentTextSlice.split('').map((char, index) => {
        if (char === '\n') return '<br>';
        // Give the last 8 typed characters a glowing class
        const isGlow = index >= charCount - 8;
        return `<span class="${isGlow ? 'ai-glow-text' : ''}">${char}</span>`;
      }).join('');

      // Confetti triggers once typewriter is complete (740+)
      if (frame >= 740) {
        drawConfetti(frame - 740);
      }
    }
  }

  // ── PHASE 5: Refined State & Zoom Out (780 – 900) ──
  else {
    virtualCursor.style.display = 'none';
    playDemoBtn.style.opacity = '0';

    // Glow fades out
    edgeGlowOpacity = 1 - clamp01((frame - 780) / 60);
    screenGlowOpacity = edgeGlowOpacity * 0.7;

    // Keep final rewritten text fully rendered
    textEditor.innerHTML = newText.split('\n').join('<br>');

    // Continue confetti fall
    drawConfetti(frame - 740);
  }

  // Apply transforms
  cameraCanvas.style.transform = `scale(${scale}) translate(${tx}px, ${ty}px)`;
  aiEdgeGlow.style.opacity = edgeGlowOpacity.toString();
  aiScreenGlow.style.opacity = screenGlowOpacity.toString();
}

// ══════════════════════════════════════════════════════════════════
// PLAYBACK CONTROLS
// ══════════════════════════════════════════════════════════════════
function tick(ts) {
  if (!lastTimestamp) lastTimestamp = ts;
  const elapsed = Math.min(ts - lastTimestamp, 100);
  lastTimestamp = ts;

  if (isPlaying) {
    currentFrame += (elapsed / 1000) * FPS * playSpeed;
    if (currentFrame >= TOTAL_FRAMES) {
      currentFrame = 0;
      updateCoords(); // Recalculate coordinates just in case size changed
    }
    updateShowcase(currentFrame);
  }
  requestAnimationFrame(tick);
}

// Button Events
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

stepIndicators.forEach(ind => ind.addEventListener('click', () => {
  currentFrame = parseInt(ind.dataset.frame, 10);
  updateShowcase(currentFrame);
  if (isPlaying) {
    isPlaying = false;
    btnPlay.textContent = 'Play';
    btnPlay.classList.remove('btn-primary');
    btnPlay.classList.add('btn-secondary');
  }
}));

// Play Demo Button direct trigger
playDemoBtn.addEventListener('click', () => {
  currentFrame = 40; // Trigger selection phase immediately
  updateShowcase(40);
});

// URL frame capture support
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
window.addEventListener('load', () => {
  initTextSpans();
  // Delay slightly to ensure browser renders initial page layout before caching coordinates
  setTimeout(() => {
    updateCoords();
    updateShowcase(currentFrame);
  }, 100);
});

// Run animation frame loop
requestAnimationFrame(tick);
