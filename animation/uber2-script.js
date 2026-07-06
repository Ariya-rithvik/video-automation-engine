// ═══════════════════════════════════════════════════════════
// UBER MOTO 3D JOURNEY — 45s TIMELINE SCRIPT
// ═══════════════════════════════════════════════════════════

const TOTAL_FRAMES = 1350; // 45 seconds @ 30fps
const FPS = 30;

// Phase boundaries
const P1_START = 0;     // Open & Booking UI (0s – 12s)
const P2_START = 360;   // Bike Burst (12s – 18s)
const P3_START = 540;   // Live Map Journey (18s – 34s)
const P4_START = 1020;  // Outro & Celebration (34s – 45s)

// State variables
let currentFrame = 0;
let isPlaying = true;
let playSpeed = 1.0;
let lastTimestamp = 0;

// Caches to avoid DOM thrashing
let cachePickupText = "";
let cacheDestText = "";
let cacheEtaValue = -1;
let cacheDistValue = -1;
let cacheStat1 = -1;
let cacheStat2 = -1;
let cacheStat3 = -1;

// ── DOM References ──
const viewport = document.getElementById('showcase-viewport');

// Scenes
const scenePhone = document.getElementById('scene-phone');
const sceneBurst = document.getElementById('scene-burst');
const sceneMap   = document.getElementById('scene-map');
const sceneBrand = document.getElementById('scene-brand');

// Scene 1: Phone Booking
const phoneWrapper       = document.getElementById('phone-wrapper');
const textPickup         = document.getElementById('text-pickup');
const textDestination    = document.getElementById('text-destination');
const cursorPickup       = document.querySelector('.cursor-pickup');
const cursorDest         = document.querySelector('.cursor-dest');
const rideOffersPanel    = document.getElementById('ride-offers-panel');
const cardMoto           = document.getElementById('card-moto');
const cardAuto           = document.getElementById('card-auto');
const btnConfirmRide     = document.getElementById('btn-confirm-ride');
const bookingLoader      = document.getElementById('booking-loader-overlay');
const phonePinStart      = document.getElementById('phone-pin-start');
const phonePinEnd        = document.getElementById('phone-pin-end');
const phoneRouteLine     = document.getElementById('phone-route-line');

// Scene 2: Bike Burst
const bikeContainer       = document.getElementById('bike-container');
const speedLinesContainer = document.getElementById('speed-lines-container');
const bikeTelemetry       = document.getElementById('bike-telemetry');
const rearWheel           = document.getElementById('rear-wheel');
const frontWheel          = document.getElementById('front-wheel');
const headlightBeam       = document.getElementById('headlight-beam');
const speedValEl          = document.querySelector('.speed-val');

// Scene 3: Cyber Map
const cyberMapContainer   = document.getElementById('cyber-map-container');
const routePathMain       = document.getElementById('route-path-main');
const routePathProgress   = document.getElementById('route-path-progress');
const mapDriverTracker    = document.getElementById('map-driver-tracker');
const hudDriver           = document.getElementById('hud-driver');
const hudStatus           = document.getElementById('hud-status');
const hudPin              = document.getElementById('hud-pin');
const hudSafety           = document.getElementById('hud-safety');
const hudEtaVal           = document.getElementById('hud-eta-val');
const hudDistVal           = document.getElementById('hud-dist-val');

// Scene 4: Brand Outro
const outroLogo           = document.getElementById('outro-logo');
const outroTagline        = document.getElementById('outro-tagline');
const outroQuote          = document.getElementById('outro-quote');
const boxStat1            = document.getElementById('box-stat1');
const boxStat2            = document.getElementById('box-stat2');
const boxStat3            = document.getElementById('box-stat3');
const numStat1            = boxStat1.querySelector('.stat-number');
const numStat2            = boxStat2.querySelector('.stat-number');
const numStat3            = boxStat3.querySelector('.stat-number');

// Overlays
const virtualCursor       = document.getElementById('virtual-cursor');
const cursorRipple        = document.getElementById('cursor-ripple');
const toastNotification   = document.getElementById('toast-notification');
const confettiCanvas      = document.getElementById('confetti-canvas');
const ctx                 = confettiCanvas.getContext('2d');

// Playback Controls
const btnPlay             = document.getElementById('btn-play');
const btnRestart          = document.getElementById('btn-restart');
const speedToggles        = document.querySelectorAll('.speed-toggle');
const scrubber            = document.getElementById('timeline-scrubber');
const timeLabel           = document.getElementById('current-time-label');
const stepIndicators      = document.querySelectorAll('.step-indicator');

// ── Setup Confetti Canvas ──
function initCanvas() {
  confettiCanvas.width = 1024;
  confettiCanvas.height = 576;
}
initCanvas();
window.addEventListener('resize', initCanvas);

// ── Typewriter Config ──
const PICKUP_TEXT = "Hotel Royal Orchid";
const DEST_TEXT   = "Kempegowda Int'l Airport (BLR)";

// ── Math Helpers ──
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp01(t) { return Math.max(0, Math.min(1, t)); }
function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
function easeOutQuint(t) { return 1 - Math.pow(1 - t, 5); }

// Get SVG Path measurements
let routeLength = 0;
try {
  routeLength = routePathMain.getTotalLength();
} catch (e) {
  routeLength = 1800; // fallback path length
}

// ── Confetti Particle System ──
const CONFETTI_COUNT = 120;
const confettiParticles = [];
const confettiColors = ['#276EF1', '#06C167', '#ffffff', '#1f2937', '#eef2ff'];

for (let i = 0; i < CONFETTI_COUNT; i++) {
  const angle = (1.2 + Math.abs(Math.sin(i * 354.1)) * 0.6) * Math.PI;
  const speed = 5 + Math.abs(Math.cos(i * 245.2)) * 16;
  confettiParticles.push({
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: 4 + Math.abs(Math.sin(i * 789.3)) * 8,
    color: confettiColors[i % confettiColors.length],
    spinSpeed: -6 + Math.abs(Math.cos(i * 142.1)) * 12,
    spinOffset: Math.abs(Math.sin(i * 512.4)) * 360
  });
}

function renderConfetti(t) {
  ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  if (t <= 0) return;
  const gravity = 0.3;
  const startX = 512;
  const startY = 280;
  const floorY = 550;

  for (let i = 0; i < CONFETTI_COUNT; i++) {
    const p = confettiParticles[i];
    let dx = p.vx * t;
    let dy = p.vy * t + 0.5 * gravity * t * t;
    let cx = startX + dx;
    let cy = startY + dy;

    // Bounce logic
    if (cy > floorY) {
      const a = 0.5 * gravity;
      const b = p.vy;
      const c = startY - floorY;
      const discriminant = b * b - 4 * a * c;
      if (discriminant >= 0) {
        const bounceTime = (-b + Math.sqrt(discriminant)) / (2 * a);
        if (t > bounceTime) {
          const tAfter = t - bounceTime;
          const vyAtFloor = p.vy + gravity * bounceTime;
          cx = startX + p.vx * bounceTime + p.vx * 0.6 * tAfter;
          cy = floorY + (-vyAtFloor * 0.4) * tAfter + 0.5 * gravity * tAfter * tAfter;
          if (cy > floorY) cy = floorY;
        }
      }
    }

    let opacity = 1.0;
    if (t > 30) opacity = Math.max(0, 1 - (t - 30) / 20);
    if (opacity <= 0) continue;

    const rotation = (p.spinOffset + t * p.spinSpeed) * Math.PI / 180;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = opacity;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    ctx.restore();
  }
}

// ── Exhaust Particle Trail for Bike ──
function renderExhaustTrail(t) {
  // Simple custom smoke drawing behind exhaust pipe
  // Exhaust end is roughly at SVG coordinates (310, 195)
  // Scale of SVG: Bike box is center stage
  if (t <= 0 || t > 180) return; // only active in burst scene
  const bikeBox = bikeContainer.getBoundingClientRect();
  const viewportBox = viewport.getBoundingClientRect();

  if (!bikeBox.width) return;

  // Let's draw 3-5 expanding smoke circles on the main canvas
  ctx.save();
  ctx.fillStyle = "rgba(100, 116, 139, 0.25)";
  ctx.filter = "blur(6px)";

  // Translate local exhaust pipe pos relative to viewport
  const exLocalX = bikeBox.left - viewportBox.left + (bikeBox.width * 0.72);
  const exLocalY = bikeBox.top - viewportBox.top + (bikeBox.height * 0.70);

  for (let i = 0; i < 8; i++) {
    const offset = (t + i * 15) % 80;
    const speedX = -offset * 3.5;
    const speedY = Math.sin(offset * 0.1) * 12;
    const radius = 10 + offset * 0.8;
    const opacity = Math.max(0, 0.4 - offset / 80);

    ctx.beginPath();
    ctx.globalAlpha = opacity;
    ctx.arc(exLocalX + speedX, exLocalY + speedY, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ── Merge shockwave ripple ──
function renderShockwave(t) {
  if (t < 0 || t > 40) return;
  const radius = t * 18;
  const opacity = Math.max(0, 1 - t / 40);

  ctx.save();
  ctx.strokeStyle = "rgba(6, 193, 103, 0.6)";
  ctx.lineWidth = 4;
  ctx.filter = "blur(4px)";
  ctx.beginPath();
  ctx.globalAlpha = opacity;
  // center of screen
  ctx.arc(512, 288, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ── Reset Overlays ──
function resetOverlays() {
  virtualCursor.style.display = 'none';
  cursorRipple.classList.remove('ripple-active');
  toastNotification.classList.remove('active');
  ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  
  // Clean phone screen styles
  cursorPickup.style.display = 'none';
  cursorDest.style.display = 'none';
  rideOffersPanel.classList.remove('visible');
  cardMoto.classList.remove('selected');
  cardAuto.classList.remove('selected');
  btnConfirmRide.classList.remove('visible');
  btnConfirmRide.classList.remove('active');
  btnConfirmRide.classList.remove('clicked');
  bookingLoader.classList.remove('active');
  phonePinStart.style.opacity = '0';
  phonePinEnd.style.opacity = '0';
  phoneRouteLine.style.opacity = '0';

  // Clean burst styles
  bikeContainer.style.opacity = '0';
  bikeContainer.style.transform = 'translate(-50%, -50%) scale(0)';
  bikeContainer.classList.remove('bobbing', 'vibrating');
  speedLinesContainer.classList.remove('active');
  bikeTelemetry.classList.remove('visible');
  headlightBeam.style.opacity = '0';
  rearWheel.setAttribute('transform', 'translate(120, 200) rotate(0)');
  frontWheel.setAttribute('transform', 'translate(355, 210) rotate(0)');

  // Clean map cards
  hudDriver.classList.remove('visible');
  hudStatus.classList.remove('visible');
  hudPin.classList.remove('visible');
  hudSafety.classList.remove('visible');
  routePathProgress.setAttribute('stroke-dashoffset', routeLength);

  // Clean outro styles
  outroLogo.classList.remove('active');
  outroTagline.classList.remove('active');
  outroQuote.classList.remove('active');
  boxStat1.classList.remove('active');
  boxStat2.classList.remove('active');
  boxStat3.classList.remove('active');
}

// ── Handle Scene Swapping ──
function activateScene(sceneName) {
  const configs = [
    { el: scenePhone, active: sceneName === 'phone' },
    { el: sceneBurst, active: sceneName === 'burst' },
    { el: sceneMap,   active: sceneName === 'map' },
    { el: sceneBrand, active: sceneName === 'brand' }
  ];
  configs.forEach(cfg => {
    if (cfg.active) {
      cfg.el.classList.add('active');
    } else {
      cfg.el.classList.remove('active');
      cfg.el.style.opacity = ""; // Clear inline opacity override to prevent it blocking other scenes
    }
  });
}

// ═══════════════════════════════════════════════════════════
// DYNAMIC TIMELINE UPDATE
// ═══════════════════════════════════════════════════════════
function updateShowcase(frame) {
  scrubber.value = Math.floor(frame);
  timeLabel.textContent = `${(frame / FPS).toFixed(2)}s`;

  // Update step indicators
  stepIndicators.forEach((ind) => {
    const start = parseInt(ind.dataset.frame, 10);
    const idx = Array.from(stepIndicators).indexOf(ind);
    const next = stepIndicators[idx + 1] ? parseInt(stepIndicators[idx + 1].dataset.frame, 10) : TOTAL_FRAMES;
    ind.classList.toggle('active', frame >= start && frame < next);
  });

  const floatBob = Math.sin((frame / 15) * Math.PI) * 4;

  // ─────────────────────────────────────────────────
  // PHASE 1: App Opening & Ride Selection (0 - 360 / 0s - 12s)
  // ─────────────────────────────────────────────────
  if (frame >= P1_START && frame < P2_START) {
    activateScene('phone');
    resetOverlays();

    // 1. Phone Entry bounce (0 - 35)
    const entryT = clamp01(frame / 35);
    const entryY = lerp(600, 0, easeOutBack(entryT));
    const entryRot = lerp(-40, 15, easeOutCubic(entryT));
    const entryRotY = lerp(50, -10, easeOutCubic(entryT));
    phoneWrapper.style.opacity = entryT;
    phoneWrapper.style.transform = `rotateX(${entryRot}deg) rotateY(${entryRotY}deg) translate3d(0, ${entryY + floatBob}px, 0)`;

    // 2. Typewriter pickup: starts at 45, types over 65 frames
    if (frame >= 45) {
      cursorPickup.style.display = 'inline-block';
      const typeT = clamp01((frame - 45) / 65);
      const len = Math.floor(typeT * PICKUP_TEXT.length);
      const str = PICKUP_TEXT.substring(0, len);
      if (str !== cachePickupText) {
        textPickup.textContent = str;
        cachePickupText = str;
      }
      if (frame >= 110) cursorPickup.style.display = 'none';
    } else {
      textPickup.textContent = "";
      cachePickupText = "";
      cursorPickup.style.display = 'none';
    }

    // 3. Typewriter destination: starts at 125, types over 75 frames
    if (frame >= 125) {
      cursorDest.style.display = 'inline-block';
      const typeT = clamp01((frame - 125) / 75);
      const len = Math.floor(typeT * DEST_TEXT.length);
      const str = DEST_TEXT.substring(0, len);
      if (str !== cacheDestText) {
        textDestination.textContent = str;
        cacheDestText = str;
      }
      if (frame >= 200) cursorDest.style.display = 'none';
    } else {
      textDestination.textContent = "";
      cacheDestText = "";
      cursorDest.style.display = 'none';
    }

    // 4. Map Preview markers fade in (starts at 205)
    if (frame >= 205) {
      const markerT = clamp01((frame - 205) / 15);
      phonePinStart.style.opacity = markerT;
      phonePinEnd.style.opacity = markerT;
      phoneRouteLine.style.opacity = markerT;
    }

    // 5. Offers list slides up (220 - 245)
    if (frame >= 220) {
      rideOffersPanel.classList.add('visible');
    }

    // 6. Confirmed Ride Button entry (240 - 260)
    if (frame >= 240) {
      btnConfirmRide.classList.add('visible');
    }

    // 7. Virtual Cursor arrives & selects Moto (260 - 290)
    if (frame >= 260) {
      virtualCursor.style.display = 'block';
      const moveT = clamp01((frame - 260) / 25);
      const cx = lerp(680, 560, easeOutCubic(moveT));
      const cy = lerp(200, 360, easeOutCubic(moveT));
      virtualCursor.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;

      if (frame >= 285) {
        cardMoto.classList.add('selected');
        btnConfirmRide.classList.add('active');
      }
    }

    // 8. Virtual Cursor moves to Confirm Button & clicks (295 - 325)
    if (frame >= 295) {
      const moveT = clamp01((frame - 295) / 18);
      const cx = lerp(560, 512, easeOutCubic(moveT));
      const cy = lerp(360, 480, easeOutCubic(moveT));
      virtualCursor.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;

      if (frame >= 315 && frame < 323) {
        btnConfirmRide.classList.add('clicked');
        cursorRipple.classList.add('ripple-active');
      } else if (frame >= 323) {
        btnConfirmRide.classList.remove('clicked');
        cursorRipple.classList.remove('ripple-active');
      }
    }

    // 9. Booking Loader fades in (325 - 360)
    if (frame >= 325) {
      bookingLoader.classList.add('active');
      virtualCursor.style.display = 'none';
    }
  }

  // ─────────────────────────────────────────────────
  // PHASE 2: Phone Explodes & Bike Bursts (360 - 540 / 12s - 18s)
  // ─────────────────────────────────────────────────
  else if (frame >= P2_START && frame < P3_START) {
    activateScene('burst');
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

    // 1. Phone collapses/fades out in Scene 1 (visual transition overlay)
    scenePhone.classList.add('active'); // keep active for overlap
    const transT = clamp01((frame - 360) / 40);
    const phoneScale = lerp(1, 0, easeInOutQuad(transT));
    const phoneRotate = lerp(15, 120, easeInOutQuad(transT));
    const phoneOpacity = lerp(1, 0, transT);
    phoneWrapper.style.transform = `rotateX(${phoneRotate}deg) rotateZ(${phoneRotate * 0.5}deg) scale(${phoneScale})`;
    phoneWrapper.style.opacity = phoneOpacity;

    if (frame >= 400) {
      scenePhone.classList.remove('active');
    }

    // 2. Bike grows out from center (370 - 430)
    if (frame >= 370) {
      const scaleT = clamp01((frame - 370) / 55);
      const bScale = lerp(0, 1.15, easeOutBack(scaleT));
      const bOpacity = clamp01((frame - 370) / 25);
      bikeContainer.style.opacity = bOpacity;
      bikeContainer.style.transform = `translate(-50%, -50%) scale(${bScale})`;

      // Add high-speed wheel spinning
      const spinAngle = (frame * 24) % 360;
      rearWheel.setAttribute('transform', `translate(120, 200) rotate(${spinAngle})`);
      frontWheel.setAttribute('transform', `translate(355, 210) rotate(${spinAngle})`);

      // Light beam
      headlightBeam.style.opacity = scaleT;
      speedLinesContainer.classList.add('active');
    }

    // 3. Engine idle / telemetry speeds (430 - 500)
    if (frame >= 430 && frame < 500) {
      bikeContainer.classList.remove('bobbing');
      bikeContainer.classList.add('vibrating'); // micro engine vibration
      bikeTelemetry.classList.add('visible');

      const speedT = clamp01((frame - 430) / 50);
      const rawSpeed = Math.floor(lerp(0, 120, easeOutCubic(speedT)));
      if (rawSpeed !== cacheEtaValue) {
        speedValEl.textContent = rawSpeed;
        cacheEtaValue = rawSpeed;
      }
      
      // Exhaust trail smoke drawing
      renderExhaustTrail(frame - 430);
    }

    // 4. Acceleration & exit (500 - 540)
    if (frame >= 500) {
      bikeContainer.classList.remove('vibrating');
      const accelT = clamp01((frame - 500) / 38);
      const exitX = lerp(0, 800, easeInOutQuad(accelT));
      const exitY = lerp(0, -60, easeInOutQuad(accelT));
      const exitScale = lerp(1.15, 0.4, accelT);
      bikeContainer.style.transform = `translate(calc(-50% + ${exitX}px), calc(-50% + ${exitY}px)) scale(${exitScale})`;
      bikeContainer.style.opacity = 1 - accelT;
      
      // Fast wheel rotation
      const spinAngle = (frame * 40) % 360;
      rearWheel.setAttribute('transform', `translate(120, 200) rotate(${spinAngle})`);
      frontWheel.setAttribute('transform', `translate(355, 210) rotate(${spinAngle})`);

      speedLinesContainer.style.opacity = 1 - accelT;
      bikeTelemetry.classList.remove('visible');
    }
  }

  // ─────────────────────────────────────────────────
  // PHASE 3: Cyber Map Tracker Journey (540 - 1020 / 18s - 34s)
  // ─────────────────────────────────────────────────
  else if (frame >= P3_START && frame < P4_START) {
    activateScene('map');
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

    // 1. Journey progress percentage
    const progressT = clamp01((frame - P3_START) / (P4_START - P3_START));
    const progressEased = easeInOutQuad(progressT);
    const dashoffset = routeLength * (1 - progressEased);
    routePathProgress.setAttribute('stroke-dashoffset', dashoffset);

    // 2. Get Driver Dot Position coordinates
    let currentPt = { x: 150, y: 720 };
    try {
      currentPt = routePathMain.getPointAtLength(progressEased * routeLength);
      mapDriverTracker.setAttribute('transform', `translate(${currentPt.x}, ${currentPt.y})`);
    } catch(e) {
      // Fallback coordinate mapping
      currentPt.x = lerp(150, 1450, progressEased);
      currentPt.y = lerp(720, 700, progressEased);
      mapDriverTracker.setAttribute('transform', `translate(${currentPt.x}, ${currentPt.y})`);
    }

    // 3. Dynamic 3D Camera Pan based on driver's position
    // Map bounds: 1600 x 900. Center camera around driver
    const camX = lerp(0, -250, progressEased); // slight horizontal scroll
    const camY = lerp(0, 80, progressEased);   // slight vertical scroll
    const camRotX = lerp(36, 40, progressT);
    const camRotZ = lerp(-12, -8, progressT);
    cyberMapContainer.style.transform = `rotateX(${camRotX}deg) rotateZ(${camRotZ}deg) translate3d(${camX}px, ${camY}px, -40px) scale(${1.0 - progressT * 0.1})`;

    // 4. Staggered HUD cards entrance
    // Driver HUD (560)
    if (frame >= 560) {
      hudDriver.classList.add('visible');
    } else {
      hudDriver.classList.remove('visible');
    }

    // Status HUD (595)
    if (frame >= 595) {
      hudStatus.classList.add('visible');
      // ETA Countdown: 5 -> 1 min
      const minutesRemaining = Math.max(1, Math.ceil(5 * (1 - progressT)));
      if (minutesRemaining !== cacheEtaValue) {
        hudEtaVal.textContent = minutesRemaining;
        cacheEtaValue = minutesRemaining;
      }
      // Distance Countdown: 4.8 -> 0.0 km
      const distanceRemaining = (4.8 * (1 - progressT)).toFixed(1);
      if (distanceRemaining !== cacheDistValue) {
        hudDistVal.textContent = distanceRemaining;
        cacheDistValue = distanceRemaining;
      }
    } else {
      hudStatus.classList.remove('visible');
    }

    // PIN HUD (630)
    if (frame >= 630) {
      hudPin.classList.add('visible');
    } else {
      hudPin.classList.remove('visible');
    }

    // Safety HUD (665)
    if (frame >= 665) {
      hudSafety.classList.add('visible');
    } else {
      hudSafety.classList.remove('visible');
    }

    // Near arrival updates (960+)
    if (frame >= 965) {
      if (cacheEtaValue !== 0) {
        hudEtaVal.textContent = "✓";
        hudEtaVal.style.color = "#06C167";
        cacheEtaValue = 0;
      }
      if (cacheDistValue !== 0.0) {
        hudDistVal.textContent = "0.0";
        cacheDistValue = 0.0;
      }
    } else {
      hudEtaVal.style.color = "#276EF1";
    }
  }

  // ─────────────────────────────────────────────────
  // PHASE 4: Outro Celebration (1020 - 1350 / 34s - 45s)
  // ─────────────────────────────────────────────────
  else if (frame >= P4_START) {
    activateScene('brand');

    // 1. Transition overlap: Map fades to black, shockwave triggered
    if (frame < 1070) {
      sceneMap.classList.add('active'); // overlay map
      const fadeT = clamp01((frame - 1020) / 45);
      sceneMap.style.opacity = 1 - fadeT;
      
      // Render dynamic shockwave on arrival
      renderShockwave(frame - 1020);
    } else {
      sceneMap.classList.remove('active');
    }

    // 2. Uber logo scales in (1060 - 1090)
    if (frame >= 1060) {
      outroLogo.classList.add('active');
    }

    // 3. Taglines slide up (1090 - 1130)
    if (frame >= 1095) outroTagline.classList.add('active');
    if (frame >= 1125) outroQuote.classList.add('active');

    // 4. Stats count-up staggering (1150)
    const stat1Start = 1140;
    const stat2Start = 1170;
    const stat3Start = 1200;

    // Stat 1: 1 Billion rides
    if (frame >= stat1Start) {
      boxStat1.classList.add('active');
      const valT = clamp01((frame - stat1Start) / 45);
      const val = Math.floor(easeInOutQuad(valT) * 1000000000);
      if (val !== cacheStat1) {
        numStat1.textContent = formatStatNum(val);
        cacheStat1 = val;
      }
    }

    // Stat 2: 25K partners
    if (frame >= stat2Start) {
      boxStat2.classList.add('active');
      const valT = clamp01((frame - stat2Start) / 40);
      const val = Math.floor(easeInOutQuad(valT) * 25000);
      if (val !== cacheStat2) {
        numStat2.textContent = formatStatNum(val);
        cacheStat2 = val;
      }
    }

    // Stat 3: 4.8 avg rating
    if (frame >= stat3Start) {
      boxStat3.classList.add('active');
      const valT = clamp01((frame - stat3Start) / 35);
      const val = (lerp(0, 4.8, easeInOutQuad(valT))).toFixed(1);
      if (val !== cacheStat3) {
        numStat3.textContent = val;
        cacheStat3 = val;
      }
    }

    // 5. Toast notification shows up (1190)
    if (frame >= 1190) {
      toastNotification.classList.add('active');
    }

    // 6. Confetti start (1110)
    const confettiT = frame - 1110;
    if (confettiT > 0) {
      renderConfetti(confettiT);
    }
  }
}

// Format counter stats
function formatStatNum(num) {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1) + "B";
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(0) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(0) + "K";
  }
  return num;
}

// ═══════════════════════════════════════════════════════════
// PLAYBACK ENGINE
// ═══════════════════════════════════════════════════════════
function tick(timestamp) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  const elapsedMs = timestamp - lastTimestamp;
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
  // Clear caches
  cachePickupText = "";
  cacheDestText = "";
  cacheEtaValue = -1;
  cacheDistValue = -1;
  cacheStat1 = -1; cacheStat2 = -1; cacheStat3 = -1;
  
  updateShowcase(0);
  if (!isPlaying) {
    isPlaying = true;
    btnPlay.textContent = 'Pause';
    btnPlay.classList.remove('btn-secondary');
    btnPlay.classList.add('btn-primary');
  }
});

speedToggles.forEach((btn) => {
  btn.addEventListener('click', () => {
    speedToggles.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    playSpeed = parseFloat(btn.dataset.speed);
  });
});

scrubber.addEventListener('input', (e) => {
  currentFrame = parseInt(e.target.value, 10);
  cachePickupText = "";
  cacheDestText = "";
  cacheEtaValue = -1;
  cacheDistValue = -1;
  cacheStat1 = -1; cacheStat2 = -1; cacheStat3 = -1;
  
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
    cachePickupText = "";
    cacheDestText = "";
    cacheEtaValue = -1;
    cacheDistValue = -1;
    cacheStat1 = -1; cacheStat2 = -1; cacheStat3 = -1;
    
    updateShowcase(currentFrame);
    if (isPlaying) {
      isPlaying = false;
      btnPlay.textContent = 'Play';
      btnPlay.classList.remove('btn-primary');
      btnPlay.classList.add('btn-secondary');
    }
  });
});

// URL frame query selector support
const urlParams = new URLSearchParams(window.location.search);
const fParam = urlParams.get('frame');
if (fParam !== null) {
  currentFrame = parseInt(fParam, 10);
  isPlaying = false;
  btnPlay.textContent = 'Play';
  btnPlay.classList.remove('btn-primary');
  btnPlay.classList.add('btn-secondary');
}

// ── Run ──
updateShowcase(currentFrame);
requestAnimationFrame(tick);
