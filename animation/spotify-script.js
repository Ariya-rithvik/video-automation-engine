// ═══════════════════════════════════════════════════════════
// SPOTIFY — PREMIUM BRAND SHOWCASE — 45s ANIMATION
// ═══════════════════════════════════════════════════════════

const TOTAL_FRAMES = 1350; // 45s @ 30fps
const FPS = 30;

// Phase boundaries
const P1_START = 0;     // Search & Play (0s – 11s)
const P2_START = 330;   // Audio Visualizer (11s – 22s)
const P3_START = 660;   // Spotify Wrapped (22s – 34s)
const P4_START = 1020;  // Brand Celebration (34s – 45s)

// Playback state
let currentFrame = 0;
let isPlaying = true;
let playSpeed = 1.0;
let lastTimestamp = 0;

// ── DOM References ──
const sceneSearch     = document.getElementById('scene-search');
const sceneVisualizer = document.getElementById('scene-visualizer');
const sceneWrapped    = document.getElementById('scene-wrapped');
const sceneBrand      = document.getElementById('scene-brand');

// Scene 1: Search & Play (Phone UI)
const phoneFrame      = document.getElementById('sp-phone-frame');
const searchBar       = document.getElementById('sp-search-bar');
const searchText      = document.getElementById('sp-search-text');
const searchCursor    = document.getElementById('sp-search-cursor');
const searchResults   = document.getElementById('sp-search-results');
const result1         = document.getElementById('sp-result-1');
const result2         = document.getElementById('sp-result-2'); // target song
const result3         = document.getElementById('sp-result-3');
const result4         = document.getElementById('sp-result-4');
const nowPlayingBar   = document.getElementById('sp-now-playing');
const phonePlayBtn    = document.getElementById('sp-play-btn');
const phonePlayIcon   = document.getElementById('sp-play-icon');
const npProgressFill  = document.getElementById('sp-np-progress-fill');
const phoneHeader     = document.getElementById('sp-header');

// Scene 2: Audio Visualizer
const visCanvas       = document.getElementById('visualizer-canvas');
const vCtx            = visCanvas.getContext('2d');
const vinylDisc       = document.getElementById('sp-vinyl');
const albumCenter     = document.getElementById('sp-album-center');
const visSongInfo     = document.getElementById('sp-vis-song-info');

// Scene 3: Spotify Wrapped
const wrappedBg       = document.getElementById('wrapped-bg');
const wrappedCards    = [
  document.getElementById('wrapped-card-1'),
  document.getElementById('wrapped-card-2'),
  document.getElementById('wrapped-card-3'),
  document.getElementById('wrapped-card-4'),
  document.getElementById('wrapped-card-5')
];
const wrapPlayCount   = document.getElementById('wrapped-play-count');
const wrapMinutes     = document.getElementById('wrapped-minutes');
const wrapTotalNum    = document.getElementById('wrapped-total-num');
const genreFills      = document.querySelectorAll('.genre-fill');
const genreBars       = document.querySelectorAll('.wrapped-genre-bar');

// Scene 4: Brand Celebration
const brandParticles  = document.getElementById('brand-particles');
const bpCtx           = brandParticles.getContext('2d');
const brandLogo       = document.getElementById('brand-sp-logo');
const brandTagline    = document.getElementById('brand-tagline');
const brandSubtitle   = document.getElementById('brand-subtitle');
const stats = [
  document.getElementById('stat-1'),
  document.getElementById('stat-2'),
  document.getElementById('stat-3'),
  document.getElementById('stat-4')
];

// Overlays
const virtualCursor   = document.getElementById('virtual-cursor');
const cursorRipple    = document.getElementById('cursor-ripple');
const confettiCanvas  = document.getElementById('confetti-canvas');
const cCtx            = confettiCanvas.getContext('2d');

// Global Controls
const btnPlay         = document.getElementById('btn-play');
const btnRestart      = document.getElementById('btn-restart');
const speedBtns       = document.querySelectorAll('.speed-btn');
const slider          = document.getElementById('timeline-slider');
const currentTimeEl   = document.getElementById('current-time');
const stepIndicators  = document.querySelectorAll('.step-indicator');

// ── Canvas Sizing ──
function resizeCanvas() {
  visCanvas.width = 1024; visCanvas.height = 576;
  brandParticles.width = 1024; brandParticles.height = 576;
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

// ═══════════════════════════════════════════════════════════
// SCENE 2: MUSIC EQUALIZER DRAWING
// ═══════════════════════════════════════════════════════════
function drawEqualizer(frame) {
  vCtx.clearRect(0, 0, 1024, 576);

  const numBars = 55;
  const barWidth = 6;
  const barGap = 5;
  const totalWidth = numBars * (barWidth + barGap);
  const startX = (1024 - totalWidth) / 2;
  const baselineY = 460;

  // Draw bars
  for (let i = 0; i < numBars; i++) {
    const x = startX + i * (barWidth + barGap);

    // Height calculation using multiple sine wave components for rhythmic look
    const dCenter = Math.abs(i - numBars / 2) / (numBars / 2); // 0 to 1
    const factor1 = Math.sin(frame * 0.15 + i * 0.25) * 60;
    const factor2 = Math.cos(frame * 0.08 - i * 0.1) * 40;
    const factor3 = Math.sin(frame * 0.3 + i * 0.5) * 20;

    // Outer bars are shorter, middle bars fluctuate higher
    const baseHeight = (1 - dCenter) * 140 + 20;
    let height = baseHeight + factor1 + factor2 + factor3;
    height = Math.max(10, Math.min(260, height));

    // Fill with vertical gradient (Spotify Green to Dark Green)
    const barGrad = vCtx.createLinearGradient(x, baselineY - height, x, baselineY);
    barGrad.addColorStop(0, '#1ed760');
    barGrad.addColorStop(0.5, '#1db954');
    barGrad.addColorStop(1, '#0c3e1b');

    vCtx.fillStyle = barGrad;

    // Draw rounded rect
    vCtx.beginPath();
    vCtx.roundRect(x, baselineY - height, barWidth, height, 3);
    vCtx.fill();
  }

  // Draw reflection waves (subtle)
  vCtx.globalAlpha = 0.15;
  for (let i = 0; i < numBars; i++) {
    const x = startX + i * (barWidth + barGap);
    const dCenter = Math.abs(i - numBars / 2) / (numBars / 2);
    const height = (Math.sin(frame * 0.15 + i * 0.25) * 60 + Math.cos(frame * 0.08 - i * 0.1) * 40 + (1 - dCenter) * 140) * 0.3;
    vCtx.fillStyle = '#1db954';
    vCtx.beginPath();
    vCtx.roundRect(x, baselineY + 2, barWidth, Math.max(3, height), 2);
    vCtx.fill();
  }
  vCtx.globalAlpha = 1.0;
}

// ═══════════════════════════════════════════════════════════
// FLOATING BRAND PARTICLES (Floating music notes & bubbles)
// ═══════════════════════════════════════════════════════════
const NOTE_COUNT = 30;
const notes = [];
for (let i = 0; i < NOTE_COUNT; i++) {
  notes.push({
    x: Math.random() * 1024,
    y: 576 + Math.random() * 200,
    speed: 1 + Math.random() * 3,
    size: 6 + Math.random() * 14,
    rot: Math.random() * Math.PI,
    rotSpeed: (Math.random() - 0.5) * 0.05,
    osc: Math.random() * Math.PI,
    oscSpeed: 0.02 + Math.random() * 0.04,
    oscAmp: 10 + Math.random() * 20,
    color: Math.random() > 0.4 ? '#1db954' : 'rgba(255,255,255,0.2)',
    isNote: Math.random() > 0.4
  });
}

function drawBrandParticles(frame) {
  bpCtx.clearRect(0, 0, 1024, 576);

  for (let i = 0; i < NOTE_COUNT; i++) {
    const n = notes[i];
    n.y -= n.speed;
    n.osc += n.oscSpeed;
    const drawX = n.x + Math.sin(n.osc) * n.oscAmp;

    // Reset bubble if it goes off screen
    if (n.y < -40) {
      n.y = 600;
      n.x = Math.random() * 1024;
    }

    bpCtx.save();
    bpCtx.fillStyle = n.color;
    bpCtx.globalAlpha = 0.35;
    bpCtx.translate(drawX, n.y);
    bpCtx.rotate(n.rot += n.rotSpeed);

    if (n.isNote) {
      // Draw simplified eighth note
      bpCtx.beginPath();
      bpCtx.arc(-6, 8, 5, 0, Math.PI * 2);
      bpCtx.arc(6, 4, 5, 0, Math.PI * 2);
      bpCtx.fill();
      bpCtx.fillRect(-2, -8, 3, 16);
      bpCtx.fillRect(10, -12, 3, 16);
      bpCtx.fillRect(-2, -12, 15, 4);
    } else {
      // Draw soundwave bubble
      bpCtx.beginPath();
      bpCtx.arc(0, 0, n.size, 0, Math.PI * 2);
      bpCtx.fill();
    }

    bpCtx.restore();
  }
}

// ═══════════════════════════════════════════════════════════
// CONFETTI SYSTEM
// ═══════════════════════════════════════════════════════════
const CONFETTI_COUNT = 100;
const confettiSeeds = [];
const confettiColors = ['#1DB954', '#1ed760', '#ffffff', '#191414', '#0d5b24'];

for (let i = 0; i < CONFETTI_COUNT; i++) {
  const angle = (1.25 + Math.abs(Math.sin(i * 32.1)) * 0.5) * Math.PI;
  const speed = 4 + Math.abs(Math.cos(i * 45.4)) * 14;
  confettiSeeds.push({
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: 4 + Math.abs(Math.sin(i * 12.3)) * 6,
    color: confettiColors[i % confettiColors.length],
    rotSpeed: -10 + Math.abs(Math.cos(i * 6.3)) * 20,
    rotOffset: Math.random() * 360
  });
}

function drawConfetti(t) {
  cCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  if (t <= 0) return;
  const gravity = 0.35, startX = 512, startY = 240, groundY = 520;

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
          cy = groundY + (-vyc * 0.35) * tp + 0.5 * gravity * tp * tp;
          if (cy > groundY) cy = groundY;
        }
      }
    }

    let opacity = Math.max(0, 1 - t / 140);
    if (opacity <= 0) continue;

    const rot = (s.rotOffset + t * s.rotSpeed) * Math.PI / 180;
    cCtx.save();
    cCtx.translate(cx, cy);
    cCtx.rotate(rot);
    cCtx.fillStyle = s.color;
    cCtx.globalAlpha = opacity;
    cCtx.fillRect(-s.size/2, -s.size/2, s.size, s.size);
    cCtx.restore();
  }
  cCtx.globalAlpha = 1.0;
}

// ═══════════════════════════════════════════════════════════
// ACTIVE SCENE MANAGER
// ═══════════════════════════════════════════════════════════
function activateScene(activeScene) {
  const scenes = [sceneSearch, sceneVisualizer, sceneWrapped, sceneBrand];
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
// MAIN ANIMATION TELEMETRY LOOP
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

  // Reset overlays by default
  virtualCursor.style.display = 'none';
  cursorRipple.classList.remove('click-wave');

  // ─────────────────────────────────────────────────
  // PHASE 1: Search & Play (0 – 330)
  // ─────────────────────────────────────────────────
  if (frame >= P1_START && frame < P2_START) {
    activateScene(sceneSearch);
    cCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    vCtx.clearRect(0, 0, 1024, 576);

    const localF = frame - P1_START;

    // Phone scale & entry translation
    const entryT = clamp01(localF / 25);
    phoneFrame.style.opacity = easeOutCubic(entryT);
    phoneFrame.style.transform = `translateY(${lerp(30, 0, easeOutCubic(entryT))}px) scale(${lerp(0.95, 1.0, easeOutCubic(entryT))})`;

    // Header and search bar fade in
    if (localF >= 20) {
      const headerT = clamp01((localF - 20) / 15);
      phoneHeader.style.opacity = headerT;
      searchBar.style.opacity = headerT;
    } else {
      phoneHeader.style.opacity = 0;
      searchBar.style.opacity = 0;
    }

    // typing sequence simulation
    const searchString = "Bohemian Rhapsody";
    if (localF >= 45 && localF < 130) {
      virtualCursor.style.display = 'block';
      // cursor enters search bar
      const enterT = clamp01((localF - 45) / 15);
      const cx = lerp(600, 512, easeOutCubic(enterT));
      const cy = lerp(100, 150, easeOutCubic(enterT));
      virtualCursor.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;

      // blinking cursor
      searchCursor.style.opacity = Math.floor(localF / 6) % 2 ? 1 : 0;

      // simulate typing text
      const typeProgress = clamp01((localF - 65) / 55);
      const numChars = Math.floor(typeProgress * searchString.length);
      searchText.textContent = searchString.substring(0, numChars);
      searchText.style.color = '#121212';
    } else if (localF >= 130) {
      searchText.textContent = searchString;
      searchText.style.color = '#121212';
      searchCursor.style.display = 'none';
    } else {
      searchText.textContent = "What do you want to listen to?";
      searchText.style.color = '#b3b3b3';
      searchCursor.style.display = 'inline-block';
    }

    // Results items fade in staggered
    const items = [result1, result2, result3, result4];
    items.forEach((item, i) => {
      const startF = 135 + i * 12;
      if (localF >= startF) {
        const itemT = clamp01((localF - startF) / 15);
        item.style.opacity = easeOutCubic(itemT);
        item.style.transform = `translateY(${lerp(10, 0, easeOutCubic(itemT))}px)`;
      } else {
        item.style.opacity = 0;
        item.style.transform = 'translateY(10px)';
      }
    });

    // Select Bohemian Rhapsody song (result-2)
    if (localF >= 190 && localF < 240) {
      virtualCursor.style.display = 'block';
      const selectT = clamp01((localF - 190) / 15);
      const cx = lerp(512, 490, easeOutCubic(selectT));
      const cy = lerp(150, 260, easeOutCubic(selectT));
      virtualCursor.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    }

    // Click effect on result item
    if (localF >= 205 && localF < 212) {
      cursorRipple.classList.add('click-wave');
      result2.classList.add('selected');
    } else if (localF >= 212) {
      cursorRipple.classList.remove('click-wave');
    }
    result2.classList.toggle('selected', localF >= 205);

    // Slide up Now Playing bar after click
    if (localF >= 225) {
      const npT = clamp01((localF - 225) / 20);
      nowPlayingBar.style.opacity = easeOutCubic(npT);
      nowPlayingBar.style.transform = `translateY(${lerp(20, 0, easeOutCubic(npT))}px)`;
    } else {
      nowPlayingBar.style.opacity = 0;
      nowPlayingBar.style.transform = 'translateY(20px)';
    }

    // Move cursor to click Play on NP bar
    if (localF >= 250 && localF < 300) {
      virtualCursor.style.display = 'block';
      const playT = clamp01((localF - 250) / 15);
      const cx = lerp(490, 615, easeOutCubic(playT));
      const cy = lerp(260, 442, easeOutCubic(playT));
      virtualCursor.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    }

    // Play click event (toggle SVG play icon to pause icon)
    if (localF >= 265 && localF < 272) {
      cursorRipple.classList.add('click-wave');
    }
    if (localF >= 265) {
      // Show pause icon
      phonePlayIcon.innerHTML = `<rect x="7" y="6" width="3" height="12" rx="1"/><rect x="14" y="6" width="3" height="12" rx="1"/>`;
      // Animate progress fill
      const progressT = clamp01((localF - 265) / 65);
      npProgressFill.style.width = `${progressT * 100}%`;
    } else {
      // Show play icon
      phonePlayIcon.innerHTML = `<polygon points="8,5 19,12 8,19"/>`;
      npProgressFill.style.width = '0%';
    }

    // Scene transition: fade out (brightness)
    if (localF >= 310) {
      const fadeOut = clamp01((localF - 310) / 20);
      sceneSearch.style.filter = `brightness(${1 - fadeOut})`;
    } else {
      sceneSearch.style.filter = 'brightness(1)';
    }
  }

  // ─────────────────────────────────────────────────
  // PHASE 2: Audio Visualizer (330 – 660)
  // ─────────────────────────────────────────────────
  if (frame >= P2_START && frame < P3_START) {
    activateScene(sceneVisualizer);
    cCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

    const localF = frame - P2_START;

    // Fade in visualizer scene
    if (localF < 20) {
      const fadeIn = clamp01(localF / 20);
      sceneVisualizer.style.opacity = fadeIn;
    } else {
      sceneVisualizer.style.opacity = 1;
    }

    // Album art expand and bounce
    const albumT = clamp01(localF / 30);
    const albumScale = easeOutBackScale(albumT, 0.7, 1.0);
    albumCenter.style.opacity = easeOutCubic(albumT);
    albumCenter.style.transform = `scale(${albumScale})`;

    // Vinyl record slides out
    if (localF >= 20) {
      const vinylT = clamp01((localF - 20) / 35);
      const shiftX = lerp(0, 110, easeOutCubic(vinylT));
      vinylDisc.style.opacity = easeOutCubic(vinylT);
      // Continuous slow rotation + slide X
      vinylDisc.style.transform = `translateX(${shiftX}px) rotate(${localF * 1.5}deg)`;
    } else {
      vinylDisc.style.opacity = 0;
      vinylDisc.style.transform = 'translateX(0) rotate(0)';
    }

    // Song info fade in
    if (localF >= 40) {
      const infoT = clamp01((localF - 40) / 20);
      visSongInfo.style.opacity = infoT;
    } else {
      visSongInfo.style.opacity = 0;
    }

    // Draw active dynamic equalizer waves
    drawEqualizer(localF);

    // Scene transition: fade out
    if (localF >= 310) {
      const fadeOut = clamp01((localF - 310) / 20);
      sceneVisualizer.style.opacity = 1 - fadeOut;
    }
  }

  // ─────────────────────────────────────────────────
  // PHASE 3: Spotify Wrapped Experience (660 – 1020)
  // ─────────────────────────────────────────────────
  if (frame >= P3_START && frame < P4_START) {
    activateScene(sceneWrapped);
    cCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    vCtx.clearRect(0, 0, 1024, 576);

    const localF = frame - P3_START;

    // Fade in scene
    if (localF < 20) {
      const fadeIn = clamp01(localF / 20);
      sceneWrapped.style.opacity = fadeIn;
    } else {
      sceneWrapped.style.opacity = 1;
    }

    // 5 cards, shown sequentially (approx. 72 frames each)
    const cardDuration = 72;
    const activeIndex = Math.min(4, Math.floor(localF / cardDuration));

    wrappedCards.forEach((card, idx) => {
      if (idx === activeIndex) {
        card.style.display = 'flex';
        // Fade in animation inside the card
        const cardLocalF = localF - idx * cardDuration;
        const cardT = clamp01(cardLocalF / 20);
        card.style.opacity = easeOutCubic(cardT);
        card.style.transform = `translateY(${lerp(15, 0, easeOutCubic(cardT))}px)`;

        // Trigger card-specific internal calculations
        if (idx === 1) {
          // Card 2: Top Artist plays countup (0 to 482)
          const playsT = clamp01(cardLocalF / 45);
          const currentPlays = Math.round(easeOutCubic(playsT) * 482);
          wrapPlayCount.textContent = `${currentPlays} plays`;
        }
        else if (idx === 2) {
          // Card 3: Top Song minutes countup (0 to 1280)
          const minsT = clamp01(cardLocalF / 45);
          const currentMins = Math.round(easeOutCubic(minsT) * 1280);
          wrapMinutes.textContent = `${currentMins.toLocaleString()} minutes`;
        }
        else if (idx === 3) {
          // Card 4: Total Minutes countup (0 to 42915) & Genre bars expansion
          const totalT = clamp01(cardLocalF / 50);
          const currentTotal = Math.round(easeOutCubic(totalT) * 42915);
          wrapTotalNum.textContent = currentTotal.toLocaleString();

          // Animate genre charts
          genreBars.forEach((bar, bIdx) => {
            const barDelay = 15 + bIdx * 8;
            if (cardLocalF >= barDelay) {
              const fill = bar.querySelector('.genre-fill');
              const finalW = fill.getAttribute('data-width');
              const fillT = clamp01((cardLocalF - barDelay) / 30);
              fill.style.width = `${easeOutCubic(fillT) * finalW}px`;
              bar.style.opacity = easeOutCubic(fillT);
              bar.style.transform = `translateX(${lerp(-20, 0, easeOutCubic(fillT))}px)`;
            } else {
              bar.querySelector('.genre-fill').style.width = '0%';
              bar.style.opacity = 0;
              bar.style.transform = 'translateX(-20px)';
            }
          });
        }
        else if (idx === 4) {
          // Card 5: Bouncing emoji personality
          const bounce = Math.sin(cardLocalF * 0.15) * 8;
          const emojiEl = card.querySelector('.wrapped-personality-emoji');
          emojiEl.style.transform = `translateY(${bounce}px)`;
        }
      } else {
        card.style.display = 'none';
        card.style.opacity = 0;
      }
    });

    // Scene transition: fade out
    if (localF >= 340) {
      const fadeOut = clamp01((localF - 340) / 20);
      sceneWrapped.style.opacity = 1 - fadeOut;
    }
  }

  // ─────────────────────────────────────────────────
  // PHASE 4: Brand Celebration (1020 – 1350)
  // ─────────────────────────────────────────────────
  if (frame >= P4_START) {
    activateScene(sceneBrand);
    vCtx.clearRect(0, 0, 1024, 576);

    const localF = frame - P4_START;

    // Spotify circle logo rotates and scales in
    if (localF >= 0) {
      const t = clamp01(localF / 25);
      brandLogo.style.opacity = easeOutCubic(t);
      const scale = easeOutBackScale(t, 0.7, 1.0);
      brandLogo.style.transform = `scale(${scale}) rotate(${lerp(-45, 0, easeOutCubic(t))}deg)`;
    }

    // Tagline reveal
    if (localF >= 25) {
      const t = clamp01((localF - 25) / 20);
      brandTagline.style.opacity = easeOutCubic(t);
      brandTagline.style.transform = `translateY(${lerp(15, 0, easeOutCubic(t))}px)`;
    } else {
      brandTagline.style.opacity = 0;
      brandTagline.style.transform = 'translateY(15px)';
    }

    // Subtitle reveal
    if (localF >= 45) {
      const t = clamp01((localF - 45) / 20);
      brandSubtitle.style.opacity = easeOutCubic(t);
      brandSubtitle.style.transform = `translateY(${lerp(15, 0, easeOutCubic(t))}px)`;
    } else {
      brandSubtitle.style.opacity = 0;
      brandSubtitle.style.transform = 'translateY(15px)';
    }

    // Stats staggered rise
    stats.forEach((st, i) => {
      const delay = 65 + i * 15;
      if (localF >= delay) {
        const t = clamp01((localF - delay) / 20);
        st.style.opacity = easeOutCubic(t);
        st.style.transform = `translateY(${lerp(20, 0, easeOutCubic(t))}px)`;
      } else {
        st.style.opacity = 0;
        st.style.transform = 'translateY(20px)';
      }
    });

    // Brand background particles
    drawBrandParticles(localF);

    // Confetti Burst
    const confettiT = localF - 60;
    if (confettiT > 0) {
      drawConfetti(confettiT);
    } else {
      cCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }
  }
}

// ── Backing scale helper ──
function easeOutBackScale(x, start, end) {
  return lerp(start, end, easeOutBack(x));
}

// ═══════════════════════════════════════════════════════════
// PLAYBACK CONTROL ENGINE
// ═══════════════════════════════════════════════════════════
function tick(timestamp) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  const elapsedMs = Math.min(timestamp - lastTimestamp, 100); // Tab protector
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
