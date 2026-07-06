// Animation constants
const TOTAL_FRAMES = 1350; // 45 seconds @ 30fps
const FPS = 30;

// Frame boundaries for phases
const PHASE_START_1 = 0;    // DeepSeek Reasoning (0s - 9s / Frames 0-270)
const PHASE_START_2 = 270;  // Gemini Synthesizing (9s - 22s / Frames 270-660)
const PHASE_START_3 = 660;  // Autonomous QA Audit & Click (22s - 34s / Frames 660-1020)
const PHASE_START_4 = 1020; // Deployment Wave (34s - 45s / Frames 1020-1350)

// State variables
let currentFrame = 0;
let isPlaying = true;
let playSpeed = 1.0;
let lastTimestamp = 0;

// Caching variables for performance (prevents layout thrashing)
let lastSliceCount = -1;
let lastTaglineLength = -1;
let lastQALogCount = -1;
let isCodeCompiled = false;
let isToastActivated = false;

// DOM Elements
const viewport = document.querySelector('.showcase-viewport');
const zoomWrapper = document.getElementById('zoom-wrapper');
const phoneWrapper = document.getElementById('phone-mockup-wrapper');
const phoneScreenContent = document.getElementById('phone-screen-content');
const phoneShell = document.querySelector('.dashboard-workspace');

// Panels
const panelReasoning = document.getElementById('panel-reasoning');
const panelEditor = document.getElementById('phone-card-1');
const panelInspector = document.getElementById('panel-inspector');

// Text Elements
const taglineText = document.querySelector('.food-tagline');
const codeArea = document.getElementById('typing-code-area');
const qaLogStream = document.getElementById('qa-log-stream');

// Action Buttons
const btnGetStarted = document.getElementById('btn-get-started');
const btnDeployService = document.getElementById('btn-deploy-service');

// Glass Bubbles / Agent Nodes
const bubbleCalendar = document.getElementById('bubble-calendar'); // Director Node
const bubbleDownloads = document.getElementById('bubble-downloads'); // Developer Node
const bubbleCourse = document.getElementById('bubble-course'); // Inspector Node
const bubbleDecor = document.getElementById('bubble-decor');

// Connectors SVG Layer
const connectorsSvg = document.querySelector('.connectors-svg');
const pathCourse = document.getElementById('path-inspector');
const pathCalendar = document.getElementById('path-director');
const pathDownloads = document.getElementById('path-developer');

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
  canvas.width = 1024;
  canvas.height = 576;
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

// ── Syntax Highlighter ──
const fullCodeText = `const useWSStream = (url) => {
  const [data, setData] = useState(null);
  useEffect(() => {
    const ws = new WebSocket(url);
    ws.onmessage = (e) => setData(e.data);
    return () => ws.close();
  }, [url]);
  return data;
};`;

const cachedHighlightedCode = {};

function syntaxHighlight(text) {
  if (cachedHighlightedCode[text]) {
    return cachedHighlightedCode[text];
  }
  const highlighted = text
    .replace(/(const|return|new)/g, '<span class="code-keyword">$1</span>')
    .replace(/(useState|useEffect|setData|WebSocket|onmessage|close)/g, '<span class="code-func">$1</span>');
  cachedHighlightedCode[text] = highlighted;
  return highlighted;
}

// Pre-highlight full code text
const finalHighlightedHtml = syntaxHighlight(fullCodeText);

// ── QA Audit Logs list ──
const QA_LOGS = [
  { frame: 660, type: 'info', text: '> QA autonomous verification initialized...' },
  { frame: 710, type: 'success', text: '[✓] Syntax validation checks: PASSED' },
  { frame: 760, type: 'success', text: '[✓] Hook dependencies verified: OK' },
  { frame: 810, type: 'success', text: '[✓] Memory overhead profiling: STABLE (0.1% overhead)' },
  { frame: 860, type: 'success', text: '[✓] Payload compile footprint: 2.1kb' },
  { frame: 955, type: 'warn', text: '> Action: Deploy service request received.' },
  { frame: 1000, type: 'success', text: '> Status: Synchronizing bundles with CDN... SUCCESS' }
];

// ── Deterministic Confetti Seed System ──
const CONFETTI_COUNT = 100;
const confettiSeeds = [];
const confettiColors = ['#10b981', '#06b6d4', '#a855f7', '#ffffff', '#34d399', '#38bdf8'];
const codeSparks = ['{ }', '✓', '0', '1', '</>', '+=', 'ws'];

for (let i = 0; i < CONFETTI_COUNT; i++) {
  const angle = (1.35 + Math.abs(Math.sin(i * 432.1)) * 0.3) * Math.PI;
  const speed = 5 + Math.abs(Math.cos(i * 123.4)) * 14;
  confettiSeeds.push({
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: 7 + Math.abs(Math.sin(i * 987.6)) * 6,
    color: confettiColors[i % confettiColors.length],
    sparkType: codeSparks[i % codeSparks.length],
    rotSpeed: -8 + Math.abs(Math.cos(i * 654.3)) * 16,
    rotOffset: Math.abs(Math.sin(i * 321.0)) * 360
  });
}

function drawDeterministicConfetti(t) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (t <= 0) return;

  const gravity = 0.35;
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
    
    if (i % 3 === 0) {
      ctx.font = `bold ${seed.size + 4}px 'JetBrains Mono', monospace`;
      ctx.fillText(seed.sparkType, -seed.size / 2, 0);
    } else {
      ctx.fillRect(-seed.size / 2, -seed.size / 2, seed.size, seed.size);
    }
    ctx.restore();
  }
}

// ── Main Update Frame Call ──
function updateShowcase(frame) {
  // Debug: Draw a solid red box on the canvas
  ctx.fillStyle = 'red';
  ctx.fillRect(10, 10, 200, 200);

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
  // PHASE 1: DeepSeek Reasoning (Frames 0 to 270 / 0s - 9s)
  // -------------------------------------------------------------
  if (frame >= PHASE_START_1 && frame < PHASE_START_2) {
    // Reset flags
    isCodeCompiled = false;
    isToastActivated = false;

    // Reset zoom wrapper & blur effects
    zoomWrapper.style.transform = `scale(1) translate3d(0, 0, 0)`;
    panelReasoning.style.filter = 'none';
    panelReasoning.style.opacity = '1';
    panelEditor.style.filter = 'none';
    panelEditor.style.opacity = '1';
    panelInspector.style.filter = 'none';
    panelInspector.style.opacity = '1';

    // Highlight active Agent Node (Director active, others dimmed)
    bubbleCalendar.style.opacity = 1;
    bubbleCalendar.style.transform = `translate3d(0, ${globalFloat}px, 60px) scale(1)`;
    bubbleDownloads.style.opacity = 0.3;
    bubbleDownloads.style.transform = 'translate3d(0, 0, 0) scale(0.95)';
    bubbleCourse.style.opacity = 0.3;
    bubbleCourse.style.transform = 'translate3d(0, 0, 0) scale(0.95)';
    bubbleDecor.style.opacity = 0;

    connectorsSvg.style.opacity = 1;
    pathCalendar.style.strokeDashoffset = 0;
    pathDownloads.style.strokeDashoffset = 800;
    pathCourse.style.strokeDashoffset = 800;

    celebrationToast.classList.remove('active');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    virtualCursor.style.display = 'none';
    cursorRipple.classList.remove('click-wave');
    btnGetStarted.classList.remove('clicked');
    btnDeployService.classList.remove('clicked');

    // Dashboard rests straight
    phoneWrapper.style.transform = `translate3d(0, ${globalFloat}px, 0) rotateY(0deg) rotateX(0deg)`;

    // Code area reset
    if (lastSliceCount !== 0) {
      codeArea.innerHTML = '// Waiting for Director handoff...';
      lastSliceCount = 0;
    }

    // QA log reset
    if (lastQALogCount !== 0) {
      qaLogStream.innerHTML = '<div class="qa-log-row">&gt; Diagnostics system initialized. Waiting...</div>';
      lastQALogCount = 0;
    }

    // Typewriter prompt: DeepSeek Reasoning Logs
    const promptString = `[thinking]\n> Request: WebSocket sync hook\n> Evaluating synchronization patterns...\n> Selecting hook: useWSStream.js\n> Defining state hooks to prevent reflows...\n> Validating clean-up closure...\n> Handoff code structure to Developer...\n[/thinking]`;
    if (frame >= 30) {
      const typeProgress = Math.min(1, (frame - 30) / 200); // types over 6.6 seconds
      const charCount = Math.floor(typeProgress * promptString.length);
      if (charCount !== lastTaglineLength) {
        taglineText.textContent = promptString.substring(0, charCount);
        lastTaglineLength = charCount;
      }
    } else {
      if (lastTaglineLength !== 0) {
        taglineText.textContent = '';
        lastTaglineLength = 0;
      }
    }
  }

  // -------------------------------------------------------------
  // PHASE 2: Gemini Synthesizing (Frames 270 to 660 / 9s - 22s)
  // -------------------------------------------------------------
  if (frame >= PHASE_START_2 && frame < PHASE_START_3) {
    celebrationToast.classList.remove('active');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    virtualCursor.style.display = 'none';
    cursorRipple.classList.remove('click-wave');
    btnGetStarted.classList.remove('clicked');
    btnDeployService.classList.remove('clicked');
    
    if (lastQALogCount !== 0) {
      qaLogStream.innerHTML = '<div class="qa-log-row">&gt; Diagnostics system initialized. Waiting...</div>';
      lastQALogCount = 0;
    }

    // Lock reasoning prompt
    const promptString = `[thinking]\n> Request: WebSocket sync hook\n> Evaluating synchronization patterns...\n> Selecting hook: useWSStream.js\n> Defining state hooks to prevent reflows...\n> Validating clean-up closure...\n> Handoff code structure to Developer...\n[/thinking]`;
    if (lastTaglineLength !== promptString.length) {
      taglineText.textContent = promptString;
      lastTaglineLength = promptString.length;
    }

    // Highlight Developer Node (Developer active, Director & QA dimmed)
    bubbleCalendar.style.opacity = 0.35;
    bubbleCalendar.style.transform = 'scale(0.95)';
    bubbleDownloads.style.opacity = 1;
    bubbleDownloads.style.transform = `translate3d(0, ${globalFloat}px, 60px) scale(1)`;
    bubbleCourse.style.opacity = 0.35;
    bubbleCourse.style.transform = 'scale(0.95)';
    bubbleDecor.style.opacity = 0.4;
    bubbleDecor.style.transform = `scale(${1.0 + Math.sin(frame / 15) * 0.1})`;

    pathCalendar.style.strokeDashoffset = 800;
    pathDownloads.style.strokeDashoffset = 0;
    pathCourse.style.strokeDashoffset = 800;

    // Interactive 3D tilt of the entire dashboard workspace
    const tiltProg = Math.min(1, (frame - PHASE_START_2) / 80);
    const rotateY = lerp(0, -10, tiltProg);
    const rotateX = lerp(0, 5, tiltProg);
    const tx = lerp(0, -20, tiltProg);

    phoneWrapper.style.transform = `translate3d(${tx}px, ${globalFloat}px, 0) rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;

    // Typewrite the React Hook Code block (Frames 320 to 600)
    if (frame >= 320) {
      const compileProg = Math.min(1, (frame - 320) / 240); // 8 seconds typing
      const sliceCount = Math.floor(compileProg * fullCodeText.length);
      if (sliceCount !== lastSliceCount) {
        codeArea.innerHTML = syntaxHighlight(fullCodeText.substring(0, sliceCount));
        lastSliceCount = sliceCount;
      }
    } else {
      if (lastSliceCount !== 0) {
        codeArea.innerHTML = '// Waiting for Director handoff...';
        lastSliceCount = 0;
      }
    }
  }

  // -------------------------------------------------------------
  // PHASE 3: Autonomous QA Audit & Click (Frames 660 to 1020 / 22s - 34s)
  // -------------------------------------------------------------
  if (frame >= PHASE_START_3 && frame < PHASE_START_4) {
    celebrationToast.classList.remove('active');
    isToastActivated = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Lock code editor to fully compiled
    if (lastSliceCount !== fullCodeText.length) {
      codeArea.innerHTML = finalHighlightedHtml;
      lastSliceCount = fullCodeText.length;
    }

    // Highlight Inspector Node (Inspector active, Director & Dev dimmed)
    bubbleCalendar.style.opacity = 0.35;
    bubbleCalendar.style.transform = 'scale(0.95)';
    bubbleDownloads.style.opacity = 0.35;
    bubbleDownloads.style.transform = 'scale(0.95)';
    bubbleCourse.style.opacity = 1;
    bubbleCourse.style.transform = `translate3d(0, ${globalFloat}px, 60px) scale(1.05)`;
    bubbleDecor.style.opacity = 0.4;

    pathCalendar.style.strokeDashoffset = 800;
    pathDownloads.style.strokeDashoffset = 800;
    pathCourse.style.strokeDashoffset = 0;

    // Shift dashboard slightly right and tilt forward
    phoneWrapper.style.transform = `translate3d(10px, ${globalFloat}px, 0) rotateY(-6deg) rotateX(6deg)`;

    // Render QA Logs dynamically from array based on frame threshold (caching)
    const activeLogs = QA_LOGS.filter(log => frame >= log.frame);
    if (activeLogs.length !== lastQALogCount) {
      let logHtml = '';
      activeLogs.forEach(log => {
        logHtml += `<div class="qa-log-row ${log.type}">${log.text}</div>`;
      });
      qaLogStream.innerHTML = logHtml;
      lastQALogCount = activeLogs.length;
    }

    // Dual Cursor Click Sequence
    // Target 1: Compile Code Button (x=640, y=460) between frames 880 and 930
    // Target 2: Verify & Deploy Button (x=890, y=460) between frames 930 and 1010
    let cx, cy;
    
    if (frame >= 870) {
      virtualCursor.style.display = 'block';
      
      if (frame < 910) {
        // Move to Target 1
        const t = (frame - 870) / 40;
        cx = lerp(950, 640, easeOutCubic(t));
        cy = lerp(500, 460, easeOutCubic(t));
        cursorRipple.classList.remove('click-wave');
        btnGetStarted.classList.remove('clicked');
      } else if (frame < 920) {
        // Click Hold Target 1
        cx = 640;
        cy = 460;
        btnGetStarted.classList.add('clicked');
        cursorRipple.classList.add('click-wave');
      } else if (frame < 930) {
        // Release Target 1 & Start moving to Target 2
        const t = (frame - 920) / 10;
        cx = lerp(640, 700, easeOutCubic(t));
        cy = lerp(460, 460, easeOutCubic(t));
        btnGetStarted.classList.remove('clicked');
        cursorRipple.classList.remove('click-wave');
      } else if (frame < 970) {
        // Move to Target 2
        const t = (frame - 930) / 40;
        cx = lerp(700, 890, easeOutCubic(t));
        cy = lerp(460, 460, easeOutCubic(t));
        btnDeployService.classList.remove('clicked');
        cursorRipple.classList.remove('click-wave');
      } else if (frame < 985) {
        // Click Hold Target 2
        cx = 890;
        cy = 460;
        btnDeployService.classList.add('clicked');
        cursorRipple.classList.add('click-wave');
      } else {
        // Release Target 2 & Retract
        const t = Math.min(1, (frame - 985) / 25);
        cx = lerp(890, 950, easeOutCubic(t));
        cy = lerp(460, 500, easeOutCubic(t));
        btnDeployService.classList.remove('clicked');
        cursorRipple.classList.remove('click-wave');
      }
      virtualCursor.style.transform = `translate3d(${cx}px, ${cy}px, 200px)`;
    } else {
      virtualCursor.style.display = 'none';
    }
  }

  // -------------------------------------------------------------
  // PHASE 4: Deployment Wave (Frames 1020 to 1350 / 34s - 45s)
  // -------------------------------------------------------------
  if (frame >= PHASE_START_4) {
    virtualCursor.style.display = 'none';
    cursorRipple.classList.remove('click-wave');
    btnGetStarted.classList.remove('clicked');
    btnDeployService.classList.remove('clicked');

    // Lock code editor and QA log streams
    if (!isCodeCompiled) {
      codeArea.innerHTML = finalHighlightedHtml;
      
      let logHtml = '';
      QA_LOGS.forEach(log => {
        logHtml += `<div class="qa-log-row ${log.type}">${log.text}</div>`;
      });
      qaLogStream.innerHTML = logHtml;
      lastQALogCount = QA_LOGS.length;
      isCodeCompiled = true;
    }

    // Zoom in on Panel 2 (the Code synthesis editor) - scale 1.55x
    const zoomProg = Math.min(1, (frame - PHASE_START_4) / 40); // 1.3 seconds zoom
    const zScale = lerp(1, 1.55, easeOutCubic(zoomProg));
    const zTx = lerp(0, -40, easeOutCubic(zoomProg));
    const zTy = lerp(0, -60, easeOutCubic(zoomProg));

    zoomWrapper.style.transform = `scale(${zScale}) translate3d(${zTx}px, ${zTy}px, 0)`;

    // Blur out and fade surrounding panels
    const blurVal = lerp(0, 10, easeOutCubic(zoomProg));
    const bgOpacity = lerp(1, 0.15, easeOutCubic(zoomProg));

    panelReasoning.style.filter = `blur(${blurVal}px)`;
    panelReasoning.style.opacity = bgOpacity;
    panelInspector.style.filter = `blur(${blurVal}px)`;
    panelInspector.style.opacity = bgOpacity;

    // Orbit nodes fade away
    bubbleCalendar.style.opacity = 0;
    bubbleDownloads.style.opacity = 0;
    bubbleCourse.style.opacity = 0;
    bubbleDecor.style.opacity = 0;
    connectorsSvg.style.opacity = 0;

    // Panel Editor remains sharp and pops forward
    panelEditor.style.filter = 'none';
    panelEditor.style.opacity = '1';
    panelEditor.style.transform = `translate3d(0, ${globalFloat * 0.4}px, 80px) rotateY(0deg) rotateX(0deg)`;

    // Show toast banner exactly once
    if (!isToastActivated) {
      celebrationToast.classList.add('active');
      isToastActivated = true;
    }

    // Fire Confetti Pop relative to zoomed panel center
    const confettiFrame = frame - (PHASE_START_4 + 10);
    if (confettiFrame > 0) {
      drawDeterministicConfetti(confettiFrame);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  // Debug: Draw a solid blue circle in the center of the canvas
  ctx.fillStyle = 'blue';
  ctx.beginPath();
  ctx.arc(512, 288, 50, 0, 2 * Math.PI);
  ctx.fill();

  // Test canvas pixel readback
  ctx.fillStyle = 'blue';
  ctx.fillRect(0, 0, 10, 10);
  const imgData = ctx.getImageData(0, 0, 10, 10);
  document.querySelector('.telemetry-badge').textContent = `CPU: 1.2% | Canvas: ${imgData.data[2]}`;
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
const urlParams = new URLSearchParams(window.location.search);
const frameParam = urlParams.get('frame');
if (frameParam !== null) {
  currentFrame = parseInt(frameParam, 10);
  isPlaying = false;
  btnPlay.textContent = 'Play';
  btnPlay.classList.remove('btn-primary');
  btnPlay.classList.add('btn-secondary');
}

updateShowcase(currentFrame);
requestAnimationFrame(tick);
