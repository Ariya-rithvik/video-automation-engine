// ════════════════════════════════════════════════════════════════════
// iOS × FIFA WORLD CUP — 50s cinematic (Lock → Home → Gallery → Photo → Video)
// ════════════════════════════════════════════════════════════════════
const TOTAL_FRAMES = 1950, FPS = 30;
const P1 = 0, P2 = 280, P3 = 600, P4 = 900, P5 = 1140, P6 = 1440;   // phase starts

let currentFrame = 0, isPlaying = true, playSpeed = 1, lastTs = 0;

// ── DOM ──
const screenEl   = document.getElementById('screen');
const statusbar  = document.getElementById('statusbar');
const lock       = document.getElementById('lock');
const lockClock  = document.getElementById('lock-clockwrap');
const lockAct    = document.getElementById('lock-activity');
const lockHint   = document.getElementById('lock-hint');
const sphereTop  = document.getElementById('lock-sphere-top');
const sphereShadow = document.getElementById('lock-sphere-shadow');
const dynamicIsland = document.getElementById('dynamic-island');
const diContent  = document.getElementById('di-content');
const home       = document.getElementById('home');
const homeInner  = document.getElementById('home-inner');
const apps       = Array.from(document.querySelectorAll('#apps .app'));
const appPhotos  = document.getElementById('app-photos');
const dock       = document.getElementById('dock');
const photos     = document.getElementById('photos');
const phContent  = document.getElementById('ph-content');
const phGrid     = document.getElementById('ph-grid');
const thumbs     = Array.from(document.querySelectorAll('#ph-grid .thumb'));
const full       = document.getElementById('full');
const fullImg    = document.getElementById('full-img');
const fullCap    = document.getElementById('full-cap');
const fullPlay   = document.getElementById('full-play');
const confetti   = document.getElementById('confetti');
const cctx       = confetti.getContext('2d');
const videoScene = document.getElementById('videoScene');
const vid        = document.getElementById('finale-video');
const vidBar     = document.getElementById('vid-bar');
const cursor     = document.getElementById('cursor');
const flash      = document.getElementById('flash');
const teaserScene = document.getElementById('teaserScene');
const teaserText = document.getElementById('teaser-text-top');
const teaserCarousel = document.getElementById('teaser-carousel');
const teaserReveal = document.getElementById('teaser-reveal');

const btnPlay = document.getElementById('btn-play');
const btnRestart = document.getElementById('btn-restart');
const speedBtns = Array.from(document.querySelectorAll('.sp'));
const scrub = document.getElementById('scrub');
const tCur = document.getElementById('t-cur');
const steps = Array.from(document.querySelectorAll('.step'));

// ── helpers ──
const lerp = (a, b, t) => a + (b - a) * t;
const cl01 = (t) => Math.max(0, Math.min(1, t));
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const easeBack = (x) => { const c = 1.70158, c3 = c + 1; return 1 + c3 * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const rnd = (s) => { const x = Math.sin(s) * 10000; return x - Math.floor(x); };

function centerIn(el) {
  if (!screenEl || !el || !screenEl.getBoundingClientRect || !el.getBoundingClientRect) {
    return { x: 128, y: 276 }; // Safe fallback for Node tests
  }
  const s = screenEl.getBoundingClientRect(), r = el.getBoundingClientRect();
  return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2 };
}
function setCursor(x, y, vis, press) {
  cursor.style.left = x + 'px'; cursor.style.top = y + 'px';
  cursor.style.opacity = vis;
  cursor.style.transform = `translate(-50%,-50%) scale(${press ? 0.7 : 1})`;
}

function resetFrame() {
  [lock, home, photos, full, videoScene, teaserScene].forEach(s => { if (s) { s.style.opacity = 0; s.style.transform = ''; s.style.pointerEvents = 'none'; } });
  lock.style.transform = ''; homeInner.style.transform = ''; photos.style.transform = ''; full.style.transform = '';
  lockClock.style.transform = ''; 
  if (lockAct) { lockAct.style.transform = ''; lockAct.style.opacity = ''; }
  if (phContent) phContent.scrollTop = 0;
  apps.forEach(a => { a.style.opacity = ''; a.style.transform = ''; });
  thumbs.forEach(t => { t.style.opacity = ''; t.style.transform = ''; });
  appPhotos.style.transform = '';
  fullCap.style.opacity = ''; fullCap.style.transform = ''; fullPlay.style.opacity = '';
  fullImg.style.transform = '';
  cursor.style.opacity = 0;
  flash.style.opacity = 0;
  statusbar.style.opacity = 0;

  if (sphereTop) sphereTop.style.transform = '';
  if (sphereShadow) {
    sphereShadow.style.transform = '';
    sphereShadow.style.opacity = '';
    sphereShadow.style.filter = '';
  }
  if (dynamicIsland) {
    dynamicIsland.classList.remove('expanded');
    dynamicIsland.style.width = '';
    dynamicIsland.style.height = '';
    dynamicIsland.style.borderRadius = '';
  }
  if (diContent) {
    diContent.style.opacity = '';
    diContent.textContent = '';
  }
  if (teaserText) {
    teaserText.style.opacity = '';
    teaserText.style.transform = '';
  }
  if (teaserCarousel) {
    teaserCarousel.style.transform = '';
    teaserCarousel.style.display = '';
  }
  if (teaserReveal) {
    teaserReveal.classList.remove('active');
  }
}

// ════════════════════════════ TIMELINE ════════════════════════════
function updateShowcase(frame) {
  resetFrame();
  scrub.value = Math.floor(frame);
  tCur.textContent = (frame / FPS).toFixed(2) + 's';
  steps.forEach((st, i) => {
    const a = +st.dataset.frame, b = steps[i + 1] ? +steps[i + 1].dataset.frame : TOTAL_FRAMES;
    st.classList.toggle('active', frame >= a && frame < b);
  });
  if (confetti.width !== screenEl.clientWidth) { confetti.width = screenEl.clientWidth; confetti.height = screenEl.clientHeight; }

  // keep video paused/reset unless we're in P5
  if ((frame < P5 || frame >= P6) && vid.pause && !vid.paused) { vid.pause(); }

  // ─── P1: LOCK ───
  if (frame < P2) {
    lock.style.opacity = 1;
    lock.style.pointerEvents = 'auto';
    lockClock.style.transform = `translateY(${Math.sin(frame * 0.04) * 2}px)`;

    // Spheres hover breathing
    const rawSin = Math.sin(frame * 0.05); // -1 to 1
    const hoverVal = lerp(-12, 0, (rawSin + 1) / 2); // oscillates between -12px and 0px
    if (sphereTop) sphereTop.style.transform = `translateY(${hoverVal}px)`;
    
    if (sphereShadow) {
      const t = cl01(Math.abs(hoverVal) / 12);
      const shadowScale = lerp(1.0, 1.25, t);
      const shadowOpacity = lerp(0.9, 0.25, t);
      const shadowBlur = lerp(4, 8, t);
      sphereShadow.style.transform = `scaleX(${shadowScale}) scaleY(${shadowScale * 0.8})`;
      sphereShadow.style.opacity = shadowOpacity;
      sphereShadow.style.filter = `blur(${shadowBlur}px)`;
    }

    const aT = cl01(frame / 28);
    if (lockAct) {
      lockAct.style.opacity = aT;
      lockAct.style.transform = `translateY(${lerp(-16, 0, easeOut(aT))}px)`;
    }
    lockHint.style.opacity = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(frame * 0.08));
  }

  // ─── P2: UNLOCK → HOME ───
  else if (frame < P3) {
    const f = frame - P2;
    // lock slides up + fades
    const lT = cl01(f / 45);
    if (lT < 1) { lock.style.opacity = 1 - lT; lock.style.transform = `translateY(${lerp(0, -560, easeOut(lT))}px)`; }
    if (f >= 6 && f <= 18) flash.style.opacity = 0.18 * Math.sin((f - 6) / 12 * Math.PI);

    // Dynamic Island face id scanner (frames 0 to 45 of phase 2)
    if (f >= 0 && f < 45) {
      if (dynamicIsland) dynamicIsland.classList.add('expanded');
      if (diContent) {
        diContent.style.opacity = 1;
        diContent.textContent = '🟢 Face ID';
      }
    } else {
      if (dynamicIsland) dynamicIsland.classList.remove('expanded');
    }

    // home in
    home.style.opacity = 1;
    home.style.pointerEvents = 'auto';
    statusbar.style.opacity = cl01((f - 12) / 30);
    const hT = cl01((f - 12) / 42);
    homeInner.style.opacity = hT;
    homeInner.style.transform = `scale(${lerp(1.06, 1, easeOut(hT))})`;
    if (f < 12) homeInner.style.opacity = 0;
    // apps stagger
    apps.forEach((a, i) => {
      const d = 40 + i * 5, t = cl01((f - d) / 26);
      a.style.opacity = f >= d ? t : 0;
      a.style.transform = `scale(${f >= d ? lerp(0.5, 1, easeBack(t)) : 0.5})`;
    });
    dock.style.opacity = cl01((f - 110) / 40);
    dock.style.transform = `translateY(${lerp(26, 0, easeOut(cl01((f - 110) / 40)))}px)`;
    // cursor → Photos, tap near the end
    if (f >= 232) {
      const c = centerIn(appPhotos);
      const mt = easeOut(cl01((f - 232) / 60));
      const x = lerp(128, c.x, mt), y = lerp(360, c.y, mt);
      const press = f >= 296;
      setCursor(x, y, 1, press);
      if (press) appPhotos.style.transform = 'scale(0.86)';
    }
  }

  // ─── P3: PHOTOS GALLERY ───
  else if (frame < P4) {
    const f = frame - P3;
    home.style.opacity = 1; homeInner.style.opacity = 1; // behind
    photos.style.opacity = 1;
    photos.style.pointerEvents = 'auto';
    const sT = cl01(f / 42);
    photos.style.transform = `translateY(${lerp(100, 0, easeOut(sT))}%)`;
    statusbar.style.opacity = sT;
    thumbs.forEach((t, i) => {
      const d = 44 + i * 8, tt = cl01((f - d) / 26);
      t.style.opacity = f >= d ? tt : 0;
      t.style.transform = `scale(${f >= d ? lerp(0.8, 1, easeBack(tt)) : 0.8})`;
    });
    
    // Auto-scroll to show Decades of Drama stories, then scroll back up for Messi selection
    let scrollVal = 0;
    if (f >= 60 && f < 110) {
      const t = (f - 60) / 50;
      scrollVal = lerp(0, 240, easeOut(t));
    } else if (f >= 110 && f < 160) {
      scrollVal = 240;
    } else if (f >= 160 && f < 200) {
      const t = (f - 160) / 40;
      scrollVal = lerp(240, 0, easeOut(t));
    }
    if (phContent) phContent.scrollTop = scrollVal;
    // cursor → first thumb (champions), tap
    if (f >= 205) {
      const c = centerIn(thumbs[0]);
      const mt = easeOut(cl01((f - 205) / 55));
      setCursor(lerp(128, c.x, mt), lerp(420, c.y, mt), 1, f >= 270);
      if (f >= 270) thumbs[0].style.transform = 'scale(0.92)';
    }
  }

  // ─── P4: PHOTO FULLSCREEN ───
  else if (frame < P5) {
    const f = frame - P4;
    photos.style.opacity = 1;            // under the opening photo
    full.style.opacity = 1;
    full.style.pointerEvents = 'auto';
    const zT = cl01(f / 38);
    full.style.transform = `scale(${lerp(0.86, 1, easeBack(zT))})`;
    full.style.opacity = zT;
    // slow Ken Burns on the photo
    fullImg.style.transform = `scale(${lerp(1.0, 1.1, cl01(f / 240))})`;
    drawConfetti(f);
    // caption + play button
    const cT = cl01((f - 26) / 30);
    fullCap.style.opacity = cT; fullCap.style.transform = `translateY(${lerp(20, 0, easeOut(cT))}px)`;
    fullPlay.style.opacity = cl01((f - 60) / 26);
    if (f >= 150) {
      const c = centerIn(fullPlay);
      const mt = easeOut(cl01((f - 150) / 55));
      setCursor(lerp(150, c.x, mt), lerp(470, c.y, mt), 1, f >= 212);
      if (f >= 212) fullPlay.style.transform = 'scale(0.94)';
    }
  }

  // ─── P5: VIDEO FINALE (real footage) ───
  else if (frame < P6) {
    const f = frame - P5, span = P6 - P5;
    videoScene.style.opacity = cl01(f / 22);
    videoScene.style.pointerEvents = 'auto';
    const dur = vid.duration && isFinite(vid.duration) ? vid.duration : 11.9;
    if (isPlaying) {
      if (vid.paused && vid.play) { const p = vid.play(); if (p && p.catch) p.catch(() => {}); }
    } else {
      if (vid.pause && !vid.paused) vid.pause();
      if (vid.currentTime !== undefined) {
        vid.currentTime = cl01(f / span) * dur;   // scrub-synced
      }
    }
    vidBar.style.width = (cl01((vid.currentTime || 0) / dur) * 100) + '%';
  }

  // ─── P6: 2026 WORLD CUP TEASER (3D Carousel) ───
  else {
    const f = frame - P6;
    if (teaserScene) {
      teaserScene.style.opacity = 1;
      teaserScene.style.pointerEvents = 'auto';
    }
    
    // 1. Top text fades in
    const textT = cl01(f / 30);
    if (teaserText) {
      teaserText.style.opacity = textT;
      teaserText.style.transform = `translateY(${lerp(-10, 0, easeOut(textT))}px)`;
    }
    
    // 2. 3D Carousel spin (720 degrees over 240 frames)
    const carouselT = cl01(f / 240);
    const angle = carouselT * 720;
    if (teaserCarousel) {
      teaserCarousel.style.transform = `rotateY(${angle}deg)`;
    }
    
    // Follow the spinning cards with the virtual cursor
    if (f < 240) {
      const rad = 50;
      const cx = 128, cy = 260;
      const cx_val = cx + Math.sin(f * 0.08) * rad;
      const cy_val = cy + Math.cos(f * 0.08) * rad * 0.35;
      setCursor(cx_val, cy_val, 0.75, false);
    } else {
      setCursor(128, 260, 0, false);
    }
    
    // 3. Carousel collapse merge (frames 240 - 280)
    if (f >= 240 && f < 280) {
      const collapseT = cl01((f - 240) / 40);
      const scaleVal = lerp(1, 0, easeOut(collapseT));
      if (teaserCarousel) {
        teaserCarousel.style.transform = `rotateY(${angle}deg) scale(${scaleVal})`;
      }
      
      // Screen flash
      if (f >= 270 && f <= 285) {
        flash.style.opacity = 0.8 * Math.sin((f - 270) / 15 * Math.PI);
      }
    }
    
    // 4. Reveal Trophy
    if (f >= 275) {
      if (teaserReveal) teaserReveal.classList.add('active');
      if (teaserCarousel) teaserCarousel.style.display = 'none';
      if (teaserText) teaserText.style.opacity = 0;
      
      // Run golden confetti particles over the trophy
      drawConfetti(f - 275);
    } else {
      if (teaserReveal) teaserReveal.classList.remove('active');
      if (teaserCarousel) teaserCarousel.style.display = '';
    }
    
    // 5. Outro fade-out (frames 450 - 510)
    if (f >= 450) {
      const outroT = cl01((f - 450) / 60);
      if (teaserScene) teaserScene.style.opacity = 1 - outroT;
    }
  }
}

// ── deterministic golden confetti ──
function drawConfetti(f) {
  const w = confetti.width, h = confetti.height;
  cctx.clearRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    const s = i * 4.3 + 7.1;
    const sp = 1.6 + rnd(s + 1) * 2.4, amp = 12 + rnd(s + 2) * 24, fr = 0.03 + rnd(s + 3) * 0.05;
    const sw = 4 + rnd(s + 4) * 5, sh = 3 + rnd(s + 5) * 4, spin = 0.04 + rnd(s + 6) * 0.08, cs = rnd(s + 7);
    const y = (sp * f) % (h + 40) - 20;
    const x = (rnd(s) * w + Math.sin(s + f * fr) * amp + w) % w;
    let col = '#ffd700';
    if (cs < 0.3) col = '#b07d12'; else if (cs < 0.6) col = '#fff0a8'; else if (cs < 0.8) col = '#f1c40f';
    cctx.save(); cctx.translate(x, y); cctx.rotate(f * spin + s); cctx.fillStyle = col;
    cctx.fillRect(-sw / 2, -sh / 2, sw, sh); cctx.restore();
  }
}

// ════════════════════════════ ENGINE ════════════════════════════
function tick(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min(ts - lastTs, 100); lastTs = ts;
  if (isPlaying) {
    currentFrame += (dt / 1000) * FPS * playSpeed;
    if (currentFrame >= TOTAL_FRAMES) { currentFrame = 0; vid.pause(); vid.currentTime = 0; }
    updateShowcase(currentFrame);
  }
  requestAnimationFrame(tick);
}

// ── controls ──
btnPlay.addEventListener('click', () => {
  isPlaying = !isPlaying;
  btnPlay.textContent = isPlaying ? 'Pause' : 'Play';
  btnPlay.classList.toggle('primary', isPlaying);
  if (!isPlaying && !vid.paused) vid.pause();
});
btnRestart.addEventListener('click', () => {
  currentFrame = 0; vid.pause(); vid.currentTime = 0; updateShowcase(0);
  isPlaying = true; btnPlay.textContent = 'Pause'; btnPlay.classList.add('primary');
});
speedBtns.forEach(b => b.addEventListener('click', () => {
  speedBtns.forEach(x => x.classList.remove('active')); b.classList.add('active');
  playSpeed = parseFloat(b.dataset.speed);
}));
scrub.addEventListener('input', e => {
  currentFrame = parseInt(e.target.value, 10);
  isPlaying = false; btnPlay.textContent = 'Play'; btnPlay.classList.remove('primary');
  updateShowcase(currentFrame);
});
steps.forEach(st => st.addEventListener('click', () => {
  currentFrame = parseInt(st.dataset.frame, 10);
  isPlaying = false; btnPlay.textContent = 'Play'; btnPlay.classList.remove('primary');
  updateShowcase(currentFrame);
}));

// boot
updateShowcase(0);
requestAnimationFrame(tick);
