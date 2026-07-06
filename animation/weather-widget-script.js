// ═══════════════════════════════════════════════════════════
// iOS DYNAMIC ISLAND & UNLOCK TRANSITION — 45s ANIMATION
// ═══════════════════════════════════════════════════════════

const TOTAL_FRAMES = 1500; // 50s @ 30fps
const FPS = 30;

// Phase boundaries
const P1_START = 0;     // Lock Screen Parallax & Idle (0s – 10s)
const P2_START = 300;   // Dynamic Island Expand / Weather notification (10s – 20s)
const P3_START = 600;   // Lock Screen Unlock & Home Grid Load (20s – 30s)
const P4_START = 900;   // Siri + Gemini AI Shasta Trip & Outro (30s – 50s)

// Playback state
let currentFrame = 0;
let isPlaying = true;
let playSpeed = 1.0;
let lastTimestamp = 0;

// ── DOM References ──
const viewport               = document.getElementById('showcase-viewport');
const phoneScreen            = document.getElementById('phone-screen');
const lockscreenView         = document.getElementById('lockscreen-view');
const homescreenView         = document.getElementById('homescreen-view');
const lockscreenHeader       = document.getElementById('lockscreen-header');

// Wallpaper Waves
const waveBack               = document.getElementById('wave-back');
const waveFront              = document.getElementById('wave-front');

// Dynamic Island elements
const dynamicIsland          = document.getElementById('dynamic-island');
const islandPillContent      = document.getElementById('island-pill-content');
const pillIndicator          = document.getElementById('pill-indicator');
const islandExpandedTennis   = document.getElementById('island-expanded-tennis');
const tennisTextBubble       = islandExpandedTennis.querySelector('.tennis-text-bubble');
const tennisWeatherCard      = document.getElementById('tennis-weather-card');
const twSunIcon              = document.getElementById('tw-sun-icon');
const islandExpandedConcert  = document.getElementById('island-expanded-concert');
const concertHeader          = islandExpandedConcert.querySelector('.concert-header');
const concertTextBubble      = islandExpandedConcert.querySelector('.concert-text-bubble');

// Home Screen elements
const widgetWeather          = document.getElementById('widget-weather');
const widgetCalendar         = document.getElementById('widget-calendar');
const appItems               = document.querySelectorAll('.app-item');
const searchPill             = document.querySelector('.search-pill');
const homescreenDockContainer = document.querySelector('.homescreen-dock-container');
const homescreenContent      = document.getElementById('homescreen-content');

// Phase 4 AI elements
const aiAssistantContainer   = document.getElementById('ai-assistant-container');
const siriOrbWrapper         = document.getElementById('siri-orb-wrapper');
const geminiSparkWrapper     = document.getElementById('gemini-spark-wrapper');
const shastaPhotoCard        = document.getElementById('shasta-photo-card');
const privateCloudDiagram    = document.getElementById('private-cloud-diagram');
const privateCloudBgFade     = document.querySelector('.private-cloud-bg-fade');
const cloudUserNode          = document.querySelector('.cloud-user-node');
const concentricRingsSvg     = document.querySelector('.concentric-rings-svg');
const orbitingNodes          = document.querySelectorAll('.orbiting-node');
const privateCloudLabel      = document.querySelector('.private-cloud-label');
const geminiSummaryCard      = document.getElementById('gemini-summary-card');

const aiAppleOutline         = document.getElementById('ai-apple-outline');
const aiGoogleOutline        = document.getElementById('ai-google-outline');
const aiStarFlare            = document.getElementById('ai-star-flare');
const aiStarrySky            = document.getElementById('ai-starry-sky');
const aiPhoneFlash           = document.getElementById('ai-phone-flash');

// Clock hands
const clockHandHour          = document.getElementById('clock-hand-hour');
const clockHandMinute        = document.getElementById('clock-hand-minute');
const clockHandSecond        = document.getElementById('clock-hand-second');

// Global Controls
const btnPlay                = document.getElementById('btn-play');
const btnRestart             = document.getElementById('btn-restart');
const speedBtns              = document.querySelectorAll('.speed-btn');
const slider                 = document.getElementById('timeline-slider');
const currentTimeEl          = document.getElementById('current-time');
const stepIndicators          = document.querySelectorAll('.step-indicator');

// ── Helpers ──
function lerp(a, b, t) { return (1 - t) * a + t * b; }
function clamp01(t) { return Math.max(0, Math.min(1, t)); }
function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }
function easeInOutQuad(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }
function easeOutBack(x) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

// Reset all styles to default state before frame update
function resetStyles() {
  // Lock Screen
  lockscreenView.style.transform = '';
  lockscreenView.style.opacity = '';
  lockscreenView.classList.remove('active');
  lockscreenHeader.style.transform = '';
  lockscreenHeader.style.opacity = '';

  // Home Screen
  homescreenView.classList.remove('active');
  homescreenView.style.opacity = '';
  homescreenView.style.transform = '';
  widgetWeather.style.opacity = '';
  widgetWeather.style.transform = '';
  widgetCalendar.style.opacity = '';
  widgetCalendar.style.transform = '';
  
  appItems.forEach(app => {
    app.style.opacity = '';
    app.style.transform = '';
  });
  searchPill.style.opacity = '';
  searchPill.style.transform = '';
  homescreenDockContainer.style.opacity = '';
  homescreenDockContainer.style.transform = '';

  // Dynamic Island
  dynamicIsland.style.width = '';
  dynamicIsland.style.height = '';
  dynamicIsland.style.borderRadius = '';
  dynamicIsland.style.opacity = '';
  dynamicIsland.className = 'dynamic-island';
  
  islandPillContent.style.opacity = '';
  pillIndicator.classList.remove('active');
  
  islandExpandedTennis.style.opacity = '';
  tennisTextBubble.style.opacity = '';
  tennisTextBubble.style.transform = '';
  tennisWeatherCard.style.opacity = '';
  tennisWeatherCard.style.transform = '';
  
  islandExpandedConcert.style.opacity = '';
  concertHeader.style.opacity = '';
  concertHeader.style.transform = '';
  concertTextBubble.style.opacity = '';
  concertTextBubble.style.transform = '';

  // Phase 4 AI elements
  aiAssistantContainer.style.opacity = '';
  aiAssistantContainer.style.transform = '';
  siriOrbWrapper.style.opacity = '';
  siriOrbWrapper.style.transform = '';
  geminiSparkWrapper.style.opacity = '';
  geminiSparkWrapper.style.transform = '';
  shastaPhotoCard.style.opacity = '';
  shastaPhotoCard.style.transform = '';
  privateCloudDiagram.style.opacity = '';
  privateCloudBgFade.style.opacity = '';
  cloudUserNode.style.transform = '';
  concentricRingsSvg.style.transform = '';
  orbitingNodes.forEach(node => {
    node.style.transform = '';
    node.style.opacity = '';
  });
  privateCloudLabel.style.opacity = '';
  privateCloudLabel.style.transform = '';
  geminiSummaryCard.style.opacity = '';
  geminiSummaryCard.style.transform = '';
  homescreenContent.style.opacity = '';

  aiAppleOutline.style.opacity = '';
  aiAppleOutline.style.transform = '';
  aiGoogleOutline.style.opacity = '';
  aiGoogleOutline.style.transform = '';
  aiStarFlare.style.opacity = '';
  aiStarFlare.style.transform = '';
  aiStarrySky.style.opacity = '';
  aiPhoneFlash.style.opacity = '';
}

// ═══════════════════════════════════════════════════════════
// MAIN TIMELINE UPDATE FUNCTION
// ═══════════════════════════════════════════════════════════
function updateShowcase(frame) {
  resetStyles();
  slider.value = Math.floor(frame);
  currentTimeEl.textContent = `${(frame / FPS).toFixed(2)}s`;

  // Step Indicators highlight sync
  stepIndicators.forEach((ind) => {
    const start = parseInt(ind.dataset.frame, 10);
    const idx = Array.from(stepIndicators).indexOf(ind);
    const next = stepIndicators[idx + 1] ? parseInt(stepIndicators[idx + 1].dataset.frame, 10) : TOTAL_FRAMES;
    ind.classList.toggle('active', frame >= start && frame < next);
  });

  // Calculate parallax breathing sways
  const swayBackY  = 10 + Math.sin(frame * 0.03) * 4;
  const swayFrontY = Math.sin(frame * 0.02) * 3;
  waveBack.style.transform = `rotate(-5deg) translateY(${swayBackY}px)`;
  waveFront.style.transform = `rotate(3deg) translateY(${swayFrontY}px)`;

  // Clock widget analog hands sync
  const baseHour = 9;
  const baseMin = 41;
  const baseSec = (frame * 0.1) % 60;
  const hourAngle = baseHour * 30 + baseMin * 0.5;
  const minAngle = baseMin * 6;
  const secAngle = baseSec * 6;
  clockHandHour.style.transform = `rotate(${hourAngle}deg)`;
  clockHandMinute.style.transform = `rotate(${minAngle}deg)`;
  clockHandSecond.style.transform = `rotate(${secAngle}deg)`;

  // ─────────────────────────────────────────────────
  // PHASE 1: Lock Screen Idle (0 – 300 / 0s – 10s)
  // ─────────────────────────────────────────────────
  if (frame >= P1_START && frame < P2_START) {
    lockscreenView.classList.add('active');
    
    // Ambient clock breathing sway
    const clockSway = Math.sin(frame * 0.02) * 1.5;
    lockscreenHeader.style.transform = `translateY(${clockSway}px)`;

    // Pill indicator active glow pulses occasionally
    const pillGlow = (frame % 90 < 35);
    pillIndicator.classList.toggle('active', pillGlow);
  }

  // ─────────────────────────────────────────────────
  // PHASE 2: Island Expand & Weather Alert (300 – 600 / 10s – 20s)
  // ─────────────────────────────────────────────────
  else if (frame >= P2_START && frame < P3_START) {
    lockscreenView.classList.add('active');
    dynamicIsland.classList.add('expanded-tennis');

    const localF = frame - P2_START;

    // Morph Dynamic Island size with spring physics
    let islandW = 110;
    let islandH = 28;
    let islandR = 14;

    // Width expands first (0 to 40)
    const wT = clamp01(localF / 40);
    islandW = lerp(110, 250, easeOutBack(wT));

    // Height expands next (10 to 60)
    if (localF >= 10) {
      const hT = clamp01((localF - 10) / 50);
      islandH = lerp(28, 185, easeOutBack(hT));
      islandR = lerp(14, 38, easeOutBack(hT));
    }
    dynamicIsland.style.width = `${islandW}px`;
    dynamicIsland.style.height = `${islandH}px`;
    dynamicIsland.style.borderRadius = `${islandR}px`;

    // Fade camera lens out
    islandPillContent.style.opacity = 1 - clamp01(localF / 15);

    // Fade dark card text bubble in (35 to 75)
    if (localF >= 35) {
      const textT = clamp01((localF - 35) / 40);
      islandExpandedTennis.style.opacity = textT;
      tennisTextBubble.style.opacity = textT;
      tennisTextBubble.style.transform = `translateY(${lerp(6, 0, easeOutCubic(textT))}px)`;
    } else {
      islandExpandedTennis.style.opacity = 0;
      tennisTextBubble.style.opacity = 0;
    }

    // Slide/bounce weather card down (65 to 115)
    if (localF >= 65) {
      const cardT = clamp01((localF - 65) / 50);
      tennisWeatherCard.style.opacity = cardT;
      tennisWeatherCard.style.transform = `translateY(${lerp(35, 0, easeOutBack(cardT))}px) scale(${lerp(0.9, 1.0, easeOutBack(cardT))})`;

      // Rotate sun icon
      const sunRot = (localF - 65) * 2;
      twSunIcon.style.transform = `rotate(${sunRot}deg)`;
    } else {
      tennisWeatherCard.style.opacity = 0;
      tennisWeatherCard.style.transform = 'translateY(35px) scale(0.9)';
    }

    // Temperature value count-up (75 to 125)
    if (localF >= 75) {
      const tempT = clamp01((localF - 75) / 50);
      const tempVal = Math.round(lerp(0, 63, easeOutCubic(tempT)));
      document.querySelector('.tw-temp').textContent = `${tempVal}°`;
    } else {
      document.querySelector('.tw-temp').textContent = '0°';
    }
  }

  // ─────────────────────────────────────────────────
  // PHASE 3: Screen Unlock & Home Grid Load (600 – 1020 / 20s – 34s)
  // ─────────────────────────────────────────────────
  else if (frame >= P3_START && frame < P4_START) {
    homescreenView.classList.add('active');

    const localF = frame - P3_START;

    // 1. Lock Screen wrapper slides up and fades out (0 to 50)
    const lockT = clamp01(localF / 50);
    const lockY = lerp(0, -576, easeOutCubic(lockT));
    lockscreenView.style.transform = `translateY(${lockY}px)`;
    lockscreenView.style.opacity = 1 - lockT;
    if (lockT < 1) lockscreenView.classList.add('active');

    // 2. Home screen elements scale in and fade in (10 to 65)
    if (localF >= 10) {
      const homeT = clamp01((localF - 10) / 55);
      homescreenView.style.opacity = homeT;
      homescreenView.style.transform = `scale(${lerp(0.92, 1.0, easeOutCubic(homeT))})`;
    } else {
      homescreenView.style.opacity = 0;
      homescreenView.style.transform = 'scale(0.92)';
    }

    // 3. Dynamic Island shrinks back to small pill (0 to 45)
    const shrinkT = clamp01(localF / 45);
    dynamicIsland.style.width = `${lerp(250, 110, easeOutCubic(shrinkT))}px`;
    dynamicIsland.style.height = `${lerp(185, 28, easeOutCubic(shrinkT))}px`;
    dynamicIsland.style.borderRadius = `${lerp(38, 14, easeOutCubic(shrinkT))}px`;
    islandExpandedTennis.style.opacity = 1 - shrinkT;
    islandPillContent.style.opacity = shrinkT;

    // 4. Home Widgets slide in from left/right (35 to 85)
    if (localF >= 35) {
      const widgetT = clamp01((localF - 35) / 50);
      widgetWeather.style.opacity = widgetT;
      widgetWeather.style.transform = `translateX(${lerp(-40, 0, easeOutCubic(widgetT))}px)`;
      widgetCalendar.style.opacity = widgetT;
      widgetCalendar.style.transform = `translateX(${lerp(40, 0, easeOutCubic(widgetT))}px)`;

      // Weather temperature widget count-up
      const tempVal = Math.round(lerp(0, 62, easeOutCubic(widgetT)));
      document.getElementById('widget-temp').textContent = `${tempVal}°`;
    } else {
      widgetWeather.style.opacity = 0;
      widgetWeather.style.transform = 'translateX(-40px)';
      widgetCalendar.style.opacity = 0;
      widgetCalendar.style.transform = 'translateX(40px)';
      document.getElementById('widget-temp').textContent = '0°';
    }

    // 5. App Icons bounce/scale in staggered sequence (45 to 160)
    appItems.forEach((app, idx) => {
      const startDelay = 45 + idx * 6;
      if (localF >= startDelay) {
        const appT = clamp01((localF - startDelay) / 30);
        app.style.opacity = appT;
        app.style.transform = `scale(${lerp(0.5, 1.0, easeOutBack(appT))})`;
      } else {
        app.style.opacity = 0;
        app.style.transform = 'scale(0.5)';
      }
    });

    // 6. Search Pill rises (120 to 160)
    if (localF >= 120) {
      const searchT = clamp01((localF - 120) / 40);
      searchPill.style.opacity = searchT;
      searchPill.style.transform = `translateY(${lerp(15, 0, easeOutCubic(searchT))}px)`;
    } else {
      searchPill.style.opacity = 0;
      searchPill.style.transform = 'translateY(15px)';
    }

    // 7. Dock container rises (140 to 185)
    if (localF >= 140) {
      const dockT = clamp01((localF - 140) / 45);
      homescreenDockContainer.style.opacity = dockT;
      homescreenDockContainer.style.transform = `translateY(${lerp(30, 0, easeOutCubic(dockT))}px)`;
    } else {
      homescreenDockContainer.style.opacity = 0;
      homescreenDockContainer.style.transform = 'translateY(30px)';
    }
  }

  // ─────────────────────────────────────────────────
  // PHASE 4: Siri + Gemini AI Shasta Trip (900 – 1500 / 30s – 50s)
  // ─────────────────────────────────────────────────
  else if (frame >= P4_START) {
    homescreenView.classList.add('active');
    
    // Dynamic Island returns to small pill state and is inactive
    dynamicIsland.style.width = '110px';
    dynamicIsland.style.height = '28px';
    dynamicIsland.style.borderRadius = '14px';
    islandPillContent.style.opacity = 1;

    const localF = frame - P4_START;

    // 1. Siri Orb activates at the bottom (0 to 30)
    if (localF >= 0 && localF < 270) {
      const orbT = clamp01(localF / 30);
      aiAssistantContainer.style.opacity = orbT;
      
      // Default transform for siri orb before morph (bottom center)
      if (localF < 90) {
        aiAssistantContainer.style.transform = `translate(-50%, 0) scale(${lerp(0.6, 1.0, easeOutBack(orbT))})`;
        siriOrbWrapper.style.opacity = 1;
        siriOrbWrapper.style.transform = 'scale(1)';
        
        // Hide morph logos
        aiAppleOutline.style.opacity = 0;
        aiGoogleOutline.style.opacity = 0;
        aiStarFlare.style.opacity = 0;
      }
    }

    // 2. Shasta Photo Card slides down from the top (30 to 90)
    if (localF >= 30 && localF < 90) {
      const shastaT = clamp01((localF - 30) / 45); // 1.5s slide down
      shastaPhotoCard.style.opacity = shastaT;
      shastaPhotoCard.style.transform = `translateY(${lerp(-120, 0, easeOutCubic(shastaT))}%)`;
    } else if (localF >= 90 && localF < 130) {
      // Fade out Shasta Card as Siri moves to center (90 to 130)
      const fadeT = clamp01((localF - 90) / 40);
      shastaPhotoCard.style.opacity = 1 - fadeT;
      shastaPhotoCard.style.transform = `translateY(${lerp(0, -20, easeOutCubic(fadeT))}px)`;
    } else {
      shastaPhotoCard.style.opacity = 0;
      shastaPhotoCard.style.transform = 'translateY(-120%)';
    }

    // 3. Siri Orb moves to center, morphs to neon Apple outline (90 to 150)
    if (localF >= 90 && localF < 150) {
      const morphT = clamp01((localF - 90) / 60); // 2s morph
      
      // Move assistant container from bottom center to screen center
      const translateY = lerp(0, -160, easeInOutQuad(morphT));
      const scale = lerp(1.0, 1.4, easeInOutQuad(morphT));
      aiAssistantContainer.style.transform = `translate(-50%, ${translateY}px) scale(${scale})`;
      
      // Fade out Siri Orb
      siriOrbWrapper.style.opacity = 1 - morphT;
      siriOrbWrapper.style.transform = `scale(${1 - morphT})`;
      
      // Fade in Apple outline
      aiAppleOutline.style.opacity = morphT;
      aiAppleOutline.style.transform = `scale(${lerp(0.8, 1.0, easeInOutQuad(morphT))})`;
      
      // Starry sky background fades in
      aiStarrySky.style.opacity = morphT;
      
      // Fade out homescreen grid
      homescreenContent.style.opacity = 1 - morphT;

      // Hide google, flare, and spark
      aiGoogleOutline.style.opacity = 0;
      aiStarFlare.style.opacity = 0;
      geminiSparkWrapper.style.opacity = 0;
    }

    // 4. Apple Outline Active & Star lens flare grows/spins inside Apple outline (150 to 200)
    if (localF >= 150 && localF < 200) {
      aiAssistantContainer.style.transform = `translate(-50%, -160px) scale(1.4)`;
      siriOrbWrapper.style.opacity = 0;
      aiAppleOutline.style.opacity = 1;
      aiAppleOutline.style.transform = 'scale(1)';
      aiStarrySky.style.opacity = 1;
      homescreenContent.style.opacity = 0;

      const flareT = clamp01((localF - 150) / 50);
      aiStarFlare.style.opacity = flareT;
      aiStarFlare.style.transform = `scale(${lerp(0, 1.0, easeOutBack(flareT))}) rotate(${lerp(0, 180, easeOutCubic(flareT))}deg)`;

      aiGoogleOutline.style.opacity = 0;
      geminiSparkWrapper.style.opacity = 0;
    }

    // 5. White flash triggers, Apple outline morphs to Google G (200 to 240)
    if (localF >= 200 && localF < 240) {
      aiAssistantContainer.style.transform = `translate(-50%, -160px) scale(1.4)`;
      aiStarrySky.style.opacity = 1;
      homescreenContent.style.opacity = 0;
      siriOrbWrapper.style.opacity = 0;
      geminiSparkWrapper.style.opacity = 0;

      const flashT = clamp01((localF - 200) / 40);
      // Flash peak is at flashT = 0.25 (frame 210, 10 frames from start of flash)
      let flashOpacity = 0;
      if (flashT <= 0.25) {
        flashOpacity = flashT / 0.25;
      } else {
        flashOpacity = 1 - (flashT - 0.25) / 0.75;
      }
      aiPhoneFlash.style.opacity = flashOpacity;

      if (localF < 210) {
        // Before peak: Apple outline & flare active
        aiAppleOutline.style.opacity = 1;
        aiAppleOutline.style.transform = 'scale(1)';
        aiGoogleOutline.style.opacity = 0;
        aiStarFlare.style.opacity = 1;
      } else {
        // After peak: Google G active, Apple outline & flare fade out
        aiAppleOutline.style.opacity = 0;
        
        const googleScale = lerp(0.85, 1.0, easeOutBack(clamp01((localF - 210) / 30)));
        aiGoogleOutline.style.opacity = 1;
        aiGoogleOutline.style.transform = `scale(${googleScale})`;
        
        // Star flare fades out
        aiStarFlare.style.opacity = 1 - clamp01((localF - 210) / 20);
        aiStarFlare.style.transform = `scale(${1 - clamp01((localF - 210) / 20)}) rotate(${180 + (localF - 210) * 2}deg)`;
      }
    }

    // 6. Google G glows & fades to Private Cloud network circles (240 to 300)
    if (localF >= 240 && localF < 300) {
      siriOrbWrapper.style.opacity = 0;
      aiStarFlare.style.opacity = 0;
      aiAppleOutline.style.opacity = 0;
      geminiSparkWrapper.style.opacity = 0;
      
      const fadeCloudT = clamp01((localF - 270) / 30); // starts at 270
      
      if (localF < 270) {
        aiAssistantContainer.style.opacity = 1;
        aiAssistantContainer.style.transform = `translate(-50%, -160px) scale(1.4)`;
        aiGoogleOutline.style.opacity = 1;
        aiGoogleOutline.style.transform = 'scale(1)';
        aiStarrySky.style.opacity = 1;
        
        privateCloudDiagram.style.opacity = 0;
        privateCloudBgFade.style.opacity = 0;
        cloudUserNode.style.transform = 'scale(0)';
        concentricRingsSvg.style.transform = 'scale(0.5) rotate(0deg)';
        orbitingNodes.forEach(node => {
          node.style.opacity = 0;
          node.style.transform = 'translate(-50%, -50%) scale(0)';
        });
        privateCloudLabel.style.opacity = 0;
        privateCloudLabel.style.transform = 'translateY(20px)';
      } else {
        // Fading out G logo, fading in Private Cloud
        aiAssistantContainer.style.opacity = 1 - fadeCloudT;
        aiAssistantContainer.style.transform = `translate(-50%, -160px) scale(${lerp(1.4, 1.0, fadeCloudT)})`;
        aiGoogleOutline.style.opacity = 1 - fadeCloudT;
        aiGoogleOutline.style.transform = `scale(${1 - fadeCloudT})`;
        aiStarrySky.style.opacity = 1 - fadeCloudT;
        
        privateCloudDiagram.style.opacity = 1;
        privateCloudBgFade.style.opacity = fadeCloudT;
        
        // Scale up central user profile node
        const scaleUser = lerp(0, 1.0, easeOutBack(fadeCloudT));
        cloudUserNode.style.transform = `scale(${scaleUser})`;
        
        // Scale/rotate concentric rings
        const scaleRings = lerp(0.5, 1.0, easeOutCubic(fadeCloudT));
        const rotateRings = (localF - 270) * 0.4;
        concentricRingsSvg.style.transform = `scale(${scaleRings}) rotate(${rotateRings}deg)`;
        
        privateCloudLabel.style.opacity = 0;
        privateCloudLabel.style.transform = 'translateY(20px)';
      }
    }

    // 7. Private Cloud Presentation & Orbiting Nodes (300 to 380)
    if (localF >= 300) {
      // Ensure logo morph elements are hidden
      siriOrbWrapper.style.opacity = 0;
      aiAppleOutline.style.opacity = 0;
      aiGoogleOutline.style.opacity = 0;
      aiStarFlare.style.opacity = 0;
      aiStarrySky.style.opacity = 0;
      aiAssistantContainer.style.opacity = 0;
      geminiSparkWrapper.style.opacity = 0;

      // Private Cloud Active
      if (localF < 520) {
        privateCloudDiagram.style.opacity = 1;
        privateCloudBgFade.style.opacity = 1;
        cloudUserNode.style.transform = 'scale(1)';
        
        const rotateRings = (localF - 270) * 0.4;
        concentricRingsSvg.style.transform = `scale(1) rotate(${rotateRings}deg)`;
        
        // Staggered expand of orbiting app nodes
        orbitingNodes.forEach((node, idx) => {
          const nodeStart = 300 + idx * 8;
          if (localF >= nodeStart) {
            const nodeT = clamp01((localF - nodeStart) / 30);
            
            let baseTransform = '';
            if (node.classList.contains('node-photos')) {
              baseTransform = 'translate(-50%, -50%) translate(52px, -30px)';
            } else if (node.classList.contains('node-mail')) {
              baseTransform = 'translate(-50%, -50%) translate(-60px, 45px)';
            } else if (node.classList.contains('node-messages')) {
              baseTransform = 'translate(-50%, -50%) translate(35px, 35px)';
            } else if (node.classList.contains('node-calendar')) {
              baseTransform = 'translate(-50%, -50%) translate(-35px, -35px)';
            }
            
            node.style.opacity = nodeT;
            node.style.transform = `${baseTransform} scale(${lerp(0, 1.0, easeOutBack(nodeT))})`;
          } else {
            node.style.opacity = 0;
            node.style.transform = 'translate(-50%, -50%) scale(0)';
          }
        });
        
        // Label slides up
        if (localF >= 320) {
          const labelT = clamp01((localF - 320) / 30);
          privateCloudLabel.style.opacity = labelT;
          privateCloudLabel.style.transform = `translateY(${lerp(20, 0, easeOutCubic(labelT))}px)`;
        } else {
          privateCloudLabel.style.opacity = 0;
          privateCloudLabel.style.transform = 'translateY(20px)';
        }
      }
    }

    // 8. Gemini Summary Card slides up from bottom (380 to 520)
    if (localF >= 380 && localF < 520) {
      const summaryT = clamp01((localF - 380) / 45); // 1.5s slide up
      geminiSummaryCard.style.opacity = summaryT;
      geminiSummaryCard.style.transform = `translateY(${lerp(120, 0, easeOutCubic(summaryT))}%)`;
    } else if (localF >= 520) {
      // Will be handled by outro fade
    } else {
      geminiSummaryCard.style.opacity = 0;
      geminiSummaryCard.style.transform = 'translateY(120%)';
    }

    // 9. Outro Fade Out (starts at localF = 520 to 600 / frame 1420 to 1500)
    if (localF >= 520) {
      const fadeT = clamp01((localF - 520) / 50);
      homescreenView.style.opacity = 0; // already hidden
      privateCloudDiagram.style.opacity = 1 - fadeT;
      geminiSummaryCard.style.opacity = 1 - fadeT;
      
      // Ensure label and user nodes remain styled but fade with diagram
      cloudUserNode.style.transform = 'scale(1)';
      const rotateRings = (localF - 270) * 0.4;
      concentricRingsSvg.style.transform = `scale(1) rotate(${rotateRings}deg)`;
      
      orbitingNodes.forEach((node) => {
        let baseTransform = '';
        if (node.classList.contains('node-photos')) {
          baseTransform = 'translate(-50%, -50%) translate(52px, -30px)';
        } else if (node.classList.contains('node-mail')) {
          baseTransform = 'translate(-50%, -50%) translate(-60px, 45px)';
        } else if (node.classList.contains('node-messages')) {
          baseTransform = 'translate(-50%, -50%) translate(35px, 35px)';
        } else if (node.classList.contains('node-calendar')) {
          baseTransform = 'translate(-50%, -50%) translate(-35px, -35px)';
        }
        node.style.transform = `${baseTransform} scale(1)`;
        node.style.opacity = 1;
      });
      privateCloudLabel.style.opacity = 1;
      privateCloudLabel.style.transform = 'translateY(0)';
    }
  }
}

// ═══════════════════════════════════════════════════════════
// PLAYBACK ENGINE
// ═══════════════════════════════════════════════════════════
function tick(timestamp) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  const elapsedMs = Math.min(timestamp - lastTimestamp, 100); // Tab protect
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
