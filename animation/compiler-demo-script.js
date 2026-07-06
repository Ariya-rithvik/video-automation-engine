// ══════════════════════════════════════════════════════════════════
// ADE — Metadata Timeline Compiler Engine script
// ══════════════════════════════════════════════════════════════════

const FPS = 30;
let TOTAL_FRAMES = 300; // Recalculated dynamically based on JSON

let currentFrame = 0;
let isPlaying = true;
let playSpeed = 1.0;
let lastTimestamp = 0;

// DOM Elements
const viewport = document.getElementById('viewport');
const cameraCanvas = document.getElementById('camera-canvas');
const spotifyWindow = document.getElementById('spotify-window');
const searchBarText = document.getElementById('search-bar-text');
const searchResults = document.getElementById('search-results');
const nowPlayingBar = document.getElementById('now-playing');
const playBtn = document.getElementById('play-btn');
const audioBars = document.getElementById('audio-bars');
const virtualCursor = document.getElementById('virtual-cursor');
const cursorRipple = document.getElementById('cursor-ripple');

const btnPlay = document.getElementById('btn-play');
const btnRestart = document.getElementById('btn-restart');
const speedBtns = document.querySelectorAll('.speed-btn');
const slider = document.getElementById('timeline-slider');
const durationLabel = document.getElementById('duration-label');
const currentTimeEl = document.getElementById('current-time');
const stepProgressContainer = document.getElementById('steps-progress');

const jsonEditor = document.getElementById('json-editor');
const btnCompile = document.getElementById('btn-compile');
const errorConsole = document.getElementById('error-console');
const zoomValueEl = document.getElementById('zoom-value');

const btnExport = document.getElementById('btn-export');
const exportOverlay = document.getElementById('export-overlay');
const exportStatusTxt = document.getElementById('export-status-txt');
const exportProgressTxt = document.getElementById('export-progress-txt');

// Timeline Engine Instance
let currentTimeline = [];
let coordsCache = {};
let currentNarration = null;
let narrationBlocks = [];
const captionContainer = document.getElementById('caption-container');

// Helpers
const lerp = (a, b, t) => (1 - t) * a + t * b;
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const easeInOutQuad = (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);

function centerIn(el) {
  if (!el || !viewport) return { x: 270, y: 180 };
  const s = viewport.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return {
    x: r.left - s.left + r.width / 2,
    y: r.top - s.top + r.height / 2
  };
}

function localToScreen(pt, scale, tx, ty) {
  const cx = 270, cy = 180; // Viewport center (540 / 2, 360 / 2)
  return {
    x: cx + (pt.x - cx + tx) * scale,
    y: cy + (pt.y - cy + ty) * scale
  };
}

// Reset mock UI states
function resetMockUI() {
  searchBarText.textContent = "Search artist, song...";
  searchBarText.classList.remove('active');
  searchResults.classList.remove('visible');
  nowPlayingBar.classList.remove('visible');
  playBtn.textContent = "▶";
  audioBars.classList.remove('active');
}

// Measure coordinates by temporarily resetting transforms
function measureCoordinates() {
  // Store original states
  const prevCanvasTransform = cameraCanvas.style.transform;
  const prevNpTransform = nowPlayingBar.style.transform;
  const prevNpClassList = nowPlayingBar.classList.contains('visible');
  const prevSrClassList = searchResults.classList.contains('visible');
  
  // Disable active transforms temporarily to measure static layout
  cameraCanvas.style.transform = 'none';
  nowPlayingBar.style.transform = 'none';
  
  // Temporarily force fully active layout states so we get exact centers
  nowPlayingBar.classList.add('visible');
  searchResults.classList.add('visible');
  
  // Force browser reflow to apply layout changes
  void nowPlayingBar.offsetHeight;
  void searchResults.offsetHeight;

  coordsCache = {
    playBtn: centerIn(playBtn),
    searchBar: centerIn(document.getElementById('search-bar')),
    albumCard: centerIn(document.getElementById('album-card')),
    nowPlaying: centerIn(nowPlayingBar),
    start: { x: 420, y: 320 } // Bottom right start
  };

  // Restore previous states
  cameraCanvas.style.transform = prevCanvasTransform;
  nowPlayingBar.style.transform = prevNpTransform;
  if (!prevNpClassList) nowPlayingBar.classList.remove('visible');
  if (!prevSrClassList) searchResults.classList.remove('visible');
}

// Build timeline step markers in the console bar
function buildStepIndicators(timeline) {
  stepProgressContainer.innerHTML = '';
  timeline.forEach((step, idx) => {
    const indicator = document.createElement('div');
    indicator.className = `step-indicator ${idx === 0 ? 'active' : ''}`;
    indicator.dataset.frame = step.startFrame;
    indicator.innerHTML = `
      <span class="step-num">${idx + 1}</span>
      <span class="step-txt">${step.description || step.action}</span>
    `;
    indicator.addEventListener('click', () => {
      currentFrame = step.startFrame;
      updateShowcase(currentFrame);
      if (isPlaying) {
        isPlaying = false;
        btnPlay.textContent = 'Play';
        btnPlay.classList.remove('btn-primary');
        btnPlay.classList.add('btn-secondary');
      }
    });
    stepProgressContainer.appendChild(indicator);
  });
}

// Helper: group narration words into sentences/phrases based on gaps and punctuation
function groupNarrationWords(words) {
  if (!words || words.length === 0) return [];
  const blocks = [];
  let currentBlock = [];
  
  words.forEach((word, idx) => {
    currentBlock.push(word);
    const nextWord = words[idx + 1];
    let shouldSplit = false;
    
    if (nextWord) {
      // Split if the time gap between words is greater than 0.45 seconds
      const gap = nextWord.start - word.end;
      if (gap > 0.45) {
        shouldSplit = true;
      }
    }
    
    // Split if word ends with sentence-ending punctuation
    if (word.text.endsWith('.') || word.text.endsWith('!') || word.text.endsWith('?')) {
      shouldSplit = true;
    }
    
    // Split if the block reaches a maximum of 7 words to keep it simple and clean
    if (currentBlock.length >= 7) {
      shouldSplit = true;
    }
    
    if (shouldSplit || !nextWord) {
      blocks.push(currentBlock);
      currentBlock = [];
    }
  });
  return blocks;
}

// Compile JSON text into frame events
function compileJSON() {
  try {
    const rawData = JSON.parse(jsonEditor.value);
    if (!rawData.timeline || !Array.isArray(rawData.timeline)) {
      throw new Error("Missing timeline array under root.");
    }
    
    // Sort timeline by time
    const events = rawData.timeline.map(e => ({
      ...e,
      timeVal: parseFloat(e.time)
    })).sort((a, b) => a.timeVal - b.timeVal);

    if (events.length === 0) {
      throw new Error("Timeline events cannot be empty.");
    }

    // Assign frame bounds
    currentTimeline = events.map((event, idx) => {
      const startFrame = Math.round(event.timeVal * FPS);
      const nextEvent = events[idx + 1];
      const endFrame = nextEvent ? Math.round(nextEvent.timeVal * FPS) : Math.round((event.timeVal + 2.0) * FPS); // Default last step runs 2s
      return { ...event, startFrame, endFrame };
    });

    currentNarration = rawData.narration || null;
    if (currentNarration && currentNarration.words && Array.isArray(currentNarration.words)) {
      narrationBlocks = groupNarrationWords(currentNarration.words);
    } else {
      narrationBlocks = [];
    }

    TOTAL_FRAMES = currentTimeline[currentTimeline.length - 1].endFrame;
    slider.max = TOTAL_FRAMES;
    durationLabel.textContent = `${(TOTAL_FRAMES / FPS).toFixed(2)}s`;

    measureCoordinates();
    buildStepIndicators(currentTimeline);
    
    errorConsole.textContent = "Console: Compiled Successfully!";
    errorConsole.classList.remove('error');
    
    currentFrame = 0;
    resetMockUI();
    updateShowcase(0);
  } catch (err) {
    errorConsole.textContent = `Error: ${err.message}`;
    errorConsole.classList.add('error');
  }
}

// Set cursor screen coords
function setCursor(x, y, opacity, clickActive) {
  virtualCursor.style.left = `${x}px`;
  virtualCursor.style.top = `${y}px`;
  virtualCursor.style.opacity = opacity;
  virtualCursor.style.transform = `translate(-50%, -50%) scale(${clickActive ? 0.75 : 1.0})`;
}

// ══════════════════════════════════════════════════════════════════
// THE MAIN COMPILED UPDATE ENGINE
// ══════════════════════════════════════════════════════════════════
function updateShowcase(frame) {
  slider.value = Math.floor(frame);
  currentTimeEl.textContent = `${(frame / FPS).toFixed(2)}s`;

  // Find active indicator step
  const indicators = document.querySelectorAll('.step-indicator');
  indicators.forEach((ind) => {
    const start = parseInt(ind.dataset.frame, 10);
    const idx = Array.from(indicators).indexOf(ind);
    const next = indicators[idx + 1] ? parseInt(indicators[idx + 1].dataset.frame, 10) : TOTAL_FRAMES;
    ind.classList.toggle('active', frame >= start && frame < next);
  });

  // Calculate coordinates if not measured yet
  if (!coordsCache.playBtn) {
    measureCoordinates();
  }

  // 1. Compute Global Camera Zoom State (Zoom calculations mapped globally)
  let scale = 1.0;
  let tx = 0;
  let ty = 0;

  // Scan current timeline to see when zoom occurs
  const zoomInEvent = currentTimeline.find(ev => ev.action === 'zoom_to');
  const zoomOutEvent = currentTimeline.find(ev => ev.action === 'zoom_out');

  const zoomStart = zoomInEvent ? zoomInEvent.startFrame : -1;
  const zoomFull = zoomInEvent ? zoomInEvent.endFrame : -1;
  const zoomOutStart = zoomOutEvent ? zoomOutEvent.startFrame : -1;
  const zoomOutEnd = zoomOutEvent ? zoomOutEvent.endFrame : -1;

  if (zoomStart !== -1 && frame >= zoomStart && frame < zoomFull) {
    const t = (frame - zoomStart) / (zoomFull - zoomStart);
    scale = lerp(1.0, zoomInEvent.scale || 1.4, easeInOutQuad(t));
    // Center calculation relative to zoom target coordinates
    const targetLocal = coordsCache.nowPlaying || { x: 270, y: 320 };
    tx = lerp(0, 270 - targetLocal.x, easeInOutQuad(t));
    ty = lerp(0, 180 - targetLocal.y, easeInOutQuad(t));
  } else if (zoomFull !== -1 && frame >= zoomFull && (zoomOutStart === -1 || frame < zoomOutStart)) {
    scale = zoomInEvent.scale || 1.4;
    const targetLocal = coordsCache.nowPlaying || { x: 270, y: 320 };
    tx = 270 - targetLocal.x;
    ty = 180 - targetLocal.y;
  } else if (zoomOutStart !== -1 && frame >= zoomOutStart && frame < zoomOutEnd) {
    const t = (frame - zoomOutStart) / (zoomOutEnd - zoomOutStart);
    const targetLocal = coordsCache.nowPlaying || { x: 270, y: 320 };
    scale = lerp(zoomInEvent.scale || 1.4, 1.0, easeInOutQuad(t));
    tx = lerp(270 - targetLocal.x, 0, easeInOutQuad(t));
    ty = lerp(180 - targetLocal.y, 0, easeInOutQuad(t));
  } else {
    scale = 1.0;
    tx = 0;
    ty = 0;
  }

  // Update zoom label display
  zoomValueEl.textContent = `Zoom: ${Math.round(scale * 100)}%`;

  // 2. Resolve Mock UI States Dynamically based on active frame boundary
  // Determine if specific triggers should be active
  let showResults = false;
  let showNowPlaying = false;
  let playActive = false;

  currentTimeline.forEach(event => {
    if (frame >= event.startFrame) {
      if (event.trigger === 'show_element(#now-playing)') {
        showResults = true;
        showNowPlaying = true;
      }
      if (event.trigger === 'play_music') {
        showResults = true;
        showNowPlaying = true;
        playActive = true;
      }
    }
    // Also, if frame is during or after typing event
    if (event.action === 'typewrite' && frame >= event.startFrame) {
      const typeT = clamp01((frame - event.startFrame) / (event.endFrame - event.startFrame));
      const chars = Math.floor(typeT * event.text.length);
      searchBarText.textContent = event.text.substring(0, chars);
      searchBarText.classList.add('active');
    }
  });

  searchResults.classList.toggle('visible', showResults);
  nowPlayingBar.classList.toggle('visible', showNowPlaying);
  playBtn.textContent = playActive ? "❚❚" : "▶";
  audioBars.classList.toggle('active', playActive);

  // Equalizer loop updates
  if (playActive) {
    const bars = audioBars.querySelectorAll('.v-bar');
    bars.forEach((bar, idx) => {
      // Dynamic random breathing
      const height = 4 + Math.abs(Math.sin(frame * 0.2 + idx * 0.5)) * 12;
      bar.style.height = `${height}px`;
    });
  }

  // 3. Resolve Cursor travel positions
  let cursorOpacity = 0;
  let clickWaveActive = false;
  virtualCursor.style.display = 'block';

  // Find active cursor event
  const currentEvent = currentTimeline.find(ev => frame >= ev.startFrame && frame < ev.endFrame);

  if (currentEvent) {
    const t = (frame - currentEvent.startFrame) / (currentEvent.endFrame - currentEvent.startFrame);
    
    // Resolve cursor coords
    if (currentEvent.action === 'move_cursor' || currentEvent.action === 'click') {
      cursorOpacity = 1.0;
      
      // Determine start position of cursor
      let startPos = coordsCache.start;
      const prevIdx = currentTimeline.indexOf(currentEvent) - 1;
      if (prevIdx >= 0) {
        const prevEvent = currentTimeline[prevIdx];
        if (prevEvent.target === '#search-bar') startPos = coordsCache.searchBar;
        if (prevEvent.target === '#album-card') startPos = coordsCache.albumCard;
        if (prevEvent.target === '#play-btn') startPos = coordsCache.playBtn;
      }

      // Determine end target coords
      let targetPos = coordsCache.start;
      if (currentEvent.target === '#search-bar') targetPos = coordsCache.searchBar;
      if (currentEvent.target === '#album-card') targetPos = coordsCache.albumCard;
      if (currentEvent.target === '#play-btn') targetPos = coordsCache.playBtn;

      // Linear or eased interpolation
      const ease = easeOutCubic(t);
      const cursorLocal = {
        x: lerp(startPos.x, targetPos.x, ease),
        y: lerp(startPos.y, targetPos.y, ease)
      };

      // Map local to zoom screen position
      const screenPos = localToScreen(cursorLocal, scale, tx, ty);

      // Handle clicking wave
      let isClicking = false;
      if (currentEvent.action === 'click' && t >= 0.8 && t <= 0.95) {
        isClicking = true;
        clickWaveActive = true;
      }

      setCursor(screenPos.x, screenPos.y, cursorOpacity, isClicking);
    } else {
      // Stay put at last target during typing or zoom
      let targetPos = coordsCache.start;
      const prevEvents = currentTimeline.slice(0, currentTimeline.indexOf(currentEvent));
      const lastCursorEvent = prevEvents.reverse().find(e => e.action === 'move_cursor' || e.action === 'click');
      
      if (lastCursorEvent) {
        if (lastCursorEvent.target === '#search-bar') targetPos = coordsCache.searchBar;
        if (lastCursorEvent.target === '#album-card') targetPos = coordsCache.albumCard;
        if (lastCursorEvent.target === '#play-btn') targetPos = coordsCache.playBtn;
      }

      const screenPos = localToScreen(targetPos, scale, tx, ty);
      cursorOpacity = lastCursorEvent ? 1.0 : 0;
      setCursor(screenPos.x, screenPos.y, cursorOpacity, false);
    }
  }

  cursorRipple.classList.toggle('click-wave', clickWaveActive);

  // Update subtitle word highlights
  updateCaptions(frame / FPS);

  // Apply transforms
  cameraCanvas.style.transform = `scale(${scale}) translate(${tx}px, ${ty}px)`;
}

// Update simple, high-contrast captions
function updateCaptions(time) {
  if (!captionContainer) return;
  
  if (!narrationBlocks || narrationBlocks.length === 0) {
    captionContainer.innerHTML = '';
    return;
  }

  // Find the active block that contains the current time
  const activeBlock = narrationBlocks.find(block => {
    const start = block[0].start;
    const end = block[block.length - 1].end;
    return time >= start && time <= end;
  });

  if (!activeBlock) {
    captionContainer.innerHTML = '';
    return;
  }

  // Render all words in this active block
  captionContainer.innerHTML = activeBlock.map(w => {
    const isActive = (time >= w.start && time < w.end);
    return `<span class="caption-word ${isActive ? 'active' : ''}">${w.text}</span>`;
  }).join(' ');
}

// ══════════════════════════════════════════════════════════════════
// ENGINE LOOPS
// ══════════════════════════════════════════════════════════════════
function tick(ts) {
  if (!lastTimestamp) lastTimestamp = ts;
  const elapsed = Math.min(ts - lastTimestamp, 100);
  lastTimestamp = ts;

  if (isPlaying) {
    currentFrame += (elapsed / 1000) * FPS * playSpeed;
    if (currentFrame >= TOTAL_FRAMES) {
      currentFrame = 0;
      resetMockUI();
    }
    updateShowcase(currentFrame);
  }
  requestAnimationFrame(tick);
}

// Controls
btnPlay.addEventListener('click', () => {
  isPlaying = !isPlaying;
  btnPlay.textContent = isPlaying ? 'Pause' : 'Play';
  btnPlay.classList.toggle('btn-primary', isPlaying);
  btnPlay.classList.toggle('btn-secondary', !isPlaying);
});

btnRestart.addEventListener('click', () => {
  currentFrame = 0;
  resetMockUI();
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

btnCompile.addEventListener('click', () => {
  compileJSON();
});

// Export to MP4 API integration
btnExport.addEventListener('click', async () => {
  if (btnExport.classList.contains('disabled')) return;
  
  // Pause playback during compilation
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
        totalFrames: TOTAL_FRAMES,
        fps: FPS
      })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Export service responded with error");
    }

    // Simulate progress while compilation is running in backend
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += Math.floor(Math.random() * 5) + 2;
      if (progress >= 96) {
        clearInterval(progressInterval);
      } else {
        exportStatusTxt.textContent = "Capturing Frames & Compiling...";
        exportProgressTxt.textContent = `${progress}% completed`;
      }
    }, 400);

    const result = await response.json();
    clearInterval(progressInterval);

    if (result.success && result.streamUrl) {
      exportStatusTxt.textContent = "✅ Compilation Complete! Downloading...";
      exportProgressTxt.textContent = "100% completed";
      
      const downloadLink = document.createElement('a');
      downloadLink.href = result.streamUrl;
      downloadLink.download = `compiled-animation-${Date.now()}.mp4`;
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
    setTimeout(() => {
      exportOverlay.classList.remove('visible');
      btnExport.classList.remove('disabled');
    }, 4500);
  }
});

// Boot
window.addEventListener('load', () => {
  compileJSON();
  requestAnimationFrame(tick);
});
