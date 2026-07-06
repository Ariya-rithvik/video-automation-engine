// ═══════════════════════════════════════════════════════════
// AMAZON CLICKS TO DELIVERY — 45s CINEMATIC ANIMATION TIMELINE
// ═══════════════════════════════════════════════════════════

const TOTAL_FRAMES = 1350; // 45 seconds @ 30fps
const FPS = 30;

// Phase boundaries
const P1_START = 0;     // Product Showcase & Click (0s – 9s)
const P2_START = 270;   // Robotic Fulfillment & Packaging (9s – 22s)
const P3_START = 660;   // Flight of the Prime Drone (22s – 34s)
const P4_START = 1020;  // Magic Unboxing & Celebration (34s – 45s)

// Playback State
let currentFrame = 0;
let isPlaying = true;
let playSpeed = 1.0;
let lastTimestamp = 0;

// Typing / UI states
let lastTypeMsg = '';

// DOM References
const viewport = document.getElementById('showcase-viewport');

// Scenes
const sceneProduct     = document.getElementById('scene-product');
const sceneFulfillment = document.getElementById('scene-fulfillment');
const sceneDelivery    = document.getElementById('scene-delivery');
const sceneOutro       = document.getElementById('scene-outro');

// Scene 1: Product Card
const productCard = document.getElementById('product-card');
const buyNowBtn   = document.getElementById('buy-now-btn');

// Scene 2: Fulfillment
const scannerLaser = document.getElementById('scanner-laser');
const barcodeLog   = document.getElementById('barcode-log');
const amazonBox    = document.getElementById('amazon-box');
const flapL        = document.getElementById('flap-l');
const flapR        = document.getElementById('flap-r');
const sealingTape  = document.getElementById('sealing-tape');
const shippingLabel = document.getElementById('shipping-label');

const armLeft      = document.getElementById('arm-left');
const armRight     = document.getElementById('arm-right');
// Arm parts for dynamic rotation
const segLS1 = document.getElementById('arm-l-seg1');
const segLS2 = document.getElementById('arm-l-seg2');
const clawL  = document.getElementById('arm-l-claw');
const jointL2 = document.getElementById('arm-l-joint2');

const segRS1 = document.getElementById('arm-r-seg1');
const segRS2 = document.getElementById('arm-r-seg2');
const clawR  = document.getElementById('arm-r-claw');
const jointR2 = document.getElementById('arm-r-joint2');

// Scene 3: Drone Flight
const scrollingCity = document.getElementById('scrolling-city');
const streetRow     = document.getElementById('street-row');
const droneWrapper  = document.getElementById('drone-wrapper');
const droneSearchlight = document.getElementById('drone-searchlight');
const dronePayload  = document.getElementById('drone-payload');

// Secondary Escort Drone elements
const droneWrapper2 = document.getElementById('drone-wrapper-2');
const droneSearchlight2 = document.getElementById('drone-searchlight-2');

// Rotors to animate rotation
const propLR = document.getElementById('prop-lr');
const propRR = document.getElementById('prop-rr');
const propLF = document.getElementById('prop-lf');
const propRF = document.getElementById('prop-rf');

// Secondary Drone Rotors
const propLR2 = document.getElementById('prop-lr-2');
const propRR2 = document.getElementById('prop-rr-2');
const propLF2 = document.getElementById('prop-lf-2');
const propRF2 = document.getElementById('prop-rf-2');

// Scene 4: Outro
const doorstepPackage = document.getElementById('doorstep-package');
const packageVisuals  = document.getElementById('package-visuals');
const doorGlow         = document.getElementById('door-glow');
const floatingSmile   = document.getElementById('floating-smile');
const outroContent    = document.getElementById('outro-content');
const outroLogo       = document.getElementById('outro-logo');
const outroTagline    = document.getElementById('outro-tagline');
const outroSubtitle   = document.getElementById('outro-subtitle');
const outroStats      = document.getElementById('outro-stats');
const stat1           = document.getElementById('stat-1');
const stat2           = document.getElementById('stat-2');
const stat3           = document.getElementById('stat-3');

// Overlays
const virtualCursor    = document.getElementById('virtual-cursor');
const cursorRipple     = document.getElementById('cursor-ripple');
const celebrationToast = document.getElementById('celebration-toast');
const canvas           = document.getElementById('confetti-canvas');
const ctx              = canvas.getContext('2d');

// Timeline controls
const btnPlay        = document.getElementById('btn-play');
const btnRestart     = document.getElementById('btn-restart');
const speedBtns      = document.querySelectorAll('.speed-btn');
const slider         = document.getElementById('timeline-slider');
const currentTimeEl  = document.getElementById('current-time');
const stepIndicators = document.querySelectorAll('.step-indicator');

// ── Setup Canvas Size ──
function resizeCanvas() {
  canvas.width = 1024;
  canvas.height = 576;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ── Math Ease Functions ──
function lerp(a, b, t) { return (1 - t) * a + t * b; }
function clamp01(t) { return Math.max(0, Math.min(1, t)); }
function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }
function easeInCubic(x) { return x * x * x; }
function easeInOutQuad(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }
function easeOutBack(x) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

// ── Prime Confetti Seeds ──
const CONFETTI_COUNT = 100;
const confettiSeeds = [];
const confettiColors = ['#0066c0', '#ff9900', '#00f2fe', '#ffffff', '#ffb700', '#00a8e8'];

for (let i = 0; i < CONFETTI_COUNT; i++) {
  const angle = (1.2 + Math.abs(Math.sin(i * 99.7)) * 0.6) * Math.PI; // spraying upwards
  const speed = 3 + Math.abs(Math.cos(i * 45.3)) * 13;
  confettiSeeds.push({
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: 4 + Math.abs(Math.sin(i * 12.3)) * 8,
    color: confettiColors[i % confettiColors.length],
    rotSpeed: -5 + Math.abs(Math.cos(i * 77.2)) * 10,
    rotOffset: Math.abs(Math.sin(i * 5.5)) * 360,
    type: i % 3 // 0: square, 1: star, 2: smiley shape
  });
}

function drawConfetti(t) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (t <= 0) return;
  const gravity = 0.3, startX = 512, startY = 400, groundY = 540;

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
          cy = groundY + (-vyc * 0.3) * tp + 0.5 * gravity * tp * tp;
          if (cy > groundY) cy = groundY;
        }
      }
    }

    let opacity = 1.0;
    if (t > 40) opacity = Math.max(0, 1 - (t - 40) / 30);
    if (opacity <= 0) continue;

    const rot = (s.rotOffset + t * s.rotSpeed) * Math.PI / 180;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.fillStyle = s.color;
    ctx.globalAlpha = opacity;

    if (s.type === 0) {
      // Square
      ctx.fillRect(-s.size / 2, -s.size / 2, s.size, s.size);
    } else if (s.type === 1) {
      // Star / Triangle
      ctx.beginPath();
      ctx.moveTo(0, -s.size);
      ctx.lineTo(s.size * 0.8, s.size * 0.5);
      ctx.lineTo(-s.size * 0.8, s.size * 0.5);
      ctx.closePath();
      ctx.fill();
    } else {
      // Smiley Arrow curves
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -s.size/2, s.size, 0.2*Math.PI, 0.8*Math.PI);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ── Update Robotic Arm Positions (Connected Joint Kinematics) ──
function updateRoboticArms(frame) {
  let angleSweep = 0;
  if (frame >= 380 && frame < 500) {
    const workT = (frame - 380) / 120;
    angleSweep = Math.sin(workT * Math.PI) * 25;
  } else if (frame >= 500) {
    angleSweep = 0;
  }

  // Left Arm calculations (Shoulder is at (30, 150) relative to SVG)
  const thetaL = (35 - angleSweep) * Math.PI / 180;
  const x1_l = 30;
  const y1_l = 150;
  const x2_l = x1_l + 70 * Math.cos(thetaL);
  const y2_l = y1_l - 70 * Math.sin(thetaL);
  
  // Forearm bends down towards the conveyor belt
  const forearmThetaL = thetaL - (30 * Math.PI / 180); 
  const x3_l = x2_l + 55 * Math.cos(forearmThetaL);
  const y3_l = y2_l - 55 * Math.sin(forearmThetaL);

  segLS1.setAttribute('x2', x2_l);
  segLS1.setAttribute('y2', y2_l);
  if (jointL2) {
    jointL2.setAttribute('cx', x2_l);
    jointL2.setAttribute('cy', y2_l);
  }
  segLS2.setAttribute('x1', x2_l);
  segLS2.setAttribute('y1', y2_l);
  segLS2.setAttribute('x2', x3_l);
  segLS2.setAttribute('y2', y3_l);
  clawL.setAttribute('transform', `translate(${x3_l}, ${y3_l})`);

  // Right Arm calculations (Shoulder is at (170, 150) relative to SVG)
  const thetaR = (35 - angleSweep) * Math.PI / 180;
  const x1_r = 170;
  const y1_r = 150;
  const x2_r = x1_r - 70 * Math.cos(thetaR);
  const y2_r = y1_r - 70 * Math.sin(thetaR);
  
  const forearmThetaR = thetaR - (30 * Math.PI / 180);
  const x3_r = x2_r - 55 * Math.cos(forearmThetaR);
  const y3_r = y2_r - 55 * Math.sin(forearmThetaR);

  segRS1.setAttribute('x2', x2_r);
  segRS1.setAttribute('y2', y2_r);
  if (jointR2) {
    jointR2.setAttribute('cx', x2_r);
    jointR2.setAttribute('cy', y2_r);
  }
  segRS2.setAttribute('x1', x2_r);
  segRS2.setAttribute('y1', y2_r);
  segRS2.setAttribute('x2', x3_r);
  segRS2.setAttribute('y2', y3_r);
  clawR.setAttribute('transform', `translate(${x3_r}, ${y3_r})`);
}

// ── Scene Activator ──
function activateScene(name) {
  sceneProduct.classList.toggle('active', name === 'product');
  sceneFulfillment.classList.toggle('active', name === 'fulfillment');
  sceneDelivery.classList.toggle('active', name === 'delivery');
  sceneOutro.classList.toggle('active', name === 'outro');
}

// ── Reset Overlays ──
function resetOverlays() {
  virtualCursor.style.display = 'none';
  cursorRipple.classList.remove('click-wave');
  celebrationToast.classList.remove('active');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// ═══════════════════════════════════════════════════════════
// MAIN RENDER UPDATE LOOP
// ═══════════════════════════════════════════════════════════
function updateShowcase(frame) {
  slider.value = Math.floor(frame);
  currentTimeEl.textContent = `${(frame / FPS).toFixed(2)}s`;

  // Step Indicators
  stepIndicators.forEach((ind, idx) => {
    const start = parseInt(ind.dataset.frame, 10);
    const next = stepIndicators[idx + 1] ? parseInt(stepIndicators[idx + 1].dataset.frame, 10) : TOTAL_FRAMES;
    ind.classList.toggle('active', frame >= start && frame < next);
  });

  const bobOffset = Math.sin((frame / 15) * Math.PI) * 5;

  // ─────────────────────────────────────────────────
  // PHASE 1: Product Showcase (Frames 0 – 270 / 0s – 9s)
  // ─────────────────────────────────────────────────
  if (frame >= P1_START && frame < P2_START) {
    activateScene('product');
    resetOverlays();

    // Entry transition for Product Card (first 40 frames)
    const entryT = clamp01(frame / 40);
    const scale = lerp(0.5, 1.0, easeOutBack(entryT));
    const opacity = lerp(0, 1, entryT);
    const rotationX = lerp(30, 0, entryT);
    const rotationY = lerp(-40, 0, entryT);

    productCard.style.opacity = opacity;
    productCard.style.transform = `translate3d(0, ${bobOffset}px, 0) scale(${scale}) rotateX(${rotationX}deg) rotateY(${rotationY}deg)`;
    
    // Reset Buy button state
    buyNowBtn.classList.remove('clicked');
    
    // Virtual Cursor entry (starts at frame 120, clicks at 180)
    if (frame >= 120) {
      virtualCursor.style.display = 'block';
      const moveT = clamp01((frame - 120) / 50);
      const startX = 800, startY = 450;
      const targetX = 512, targetY = 380; // center of Buy Now button
      
      const cx = lerp(startX, targetX, easeOutCubic(moveT));
      const cy = lerp(startY, targetY, easeOutCubic(moveT));
      virtualCursor.style.transform = `translate3d(${cx}px, ${cy}px, 100px)`;

      // Trigger click state
      if (frame >= 180 && frame < 195) {
        buyNowBtn.style.transform = 'scale(0.95)';
        cursorRipple.classList.add('click-wave');
      } else {
        buyNowBtn.style.transform = 'scale(1)';
        cursorRipple.classList.remove('click-wave');
      }
    }

    // Shrink out card & fade to next scene (240 - 270)
    if (frame >= 230) {
      const exitT = clamp01((frame - 230) / 40);
      const exitScale = lerp(1.0, 0.4, easeInOutQuad(exitT));
      const exitOpacity = lerp(1, 0, exitT);
      productCard.style.transform = `translate3d(0, ${bobOffset}px, 0) scale(${exitScale}) rotateY(${exitT * 30}deg)`;
      productCard.style.opacity = exitOpacity;
    }
  }

  // ─────────────────────────────────────────────────
  // PHASE 2: Fulfillment & Packaging (Frames 270 – 660 / 9s – 22s)
  // ─────────────────────────────────────────────────
  else if (frame >= P2_START && frame < P3_START) {
    activateScene('fulfillment');
    resetOverlays();

    // Box assembly scaling entry (270 - 330)
    const boxEntryT = clamp01((frame - 270) / 60);
    const boxScale = lerp(0, 1.0, easeOutBack(boxEntryT));
    amazonBox.style.transform = `rotateX(-15deg) rotateY(35deg) scale(${boxScale})`;
    
    // Flaps are open by default initially
    flapL.style.transform = 'rotateY(90deg)';
    flapR.style.transform = 'rotateY(-90deg)';
    sealingTape.style.transform = 'translate(-50%, -50%) scaleX(0)';
    shippingLabel.style.opacity = '0';
    shippingLabel.style.transform = 'scale(0.5)';
    scannerLaser.style.opacity = '0';
    barcodeLog.style.opacity = '0';

    // Robotic arm entry (330 - 380) and exit (500 - 550) offsets
    const armEntryT = clamp01((frame - 330) / 50);
    let armLOffset = -200;
    let armROffset = 200;
    if (frame < 500) {
      armLOffset = lerp(-200, 0, easeOutCubic(armEntryT));
      armROffset = lerp(200, 0, easeOutCubic(armEntryT));
    } else {
      const armExitT = clamp01((frame - 500) / 50);
      armLOffset = lerp(0, -200, easeInCubic(armExitT));
      armROffset = lerp(0, 200, easeInCubic(armExitT));
    }
    armLeft.style.transform = `translate3d(${armLOffset}px, 0, 0)`;
    armRight.style.transform = `translate3d(${armROffset}px, 0, 0)`;

    // Call joint calculations to prevent disconnected limbs
    updateRoboticArms(frame);

    // Flaps folding closed (400 - 460)
    if (frame >= 400) {
      const foldT = clamp01((frame - 400) / 50);
      const angleL = lerp(90, 0, easeInOutQuad(foldT));
      const angleR = lerp(-90, 0, easeInOutQuad(foldT));
      flapL.style.transform = `rotateY(${angleL}deg)`;
      flapR.style.transform = `rotateY(${angleR}deg)`;
    }

    // Tape sealing glows (460 - 520)
    if (frame >= 460) {
      const tapeT = clamp01((frame - 460) / 50);
      sealingTape.style.transform = `translate(-50%, -50%) scaleX(${lerp(0, 1.0, easeOutCubic(tapeT))})`;
    }

    // Laser scanning scanner line sweeps down (530 - 600)
    if (frame >= 530 && frame < 600) {
      const laserT = (frame - 530) / 70;
      const laserY = lerp(50, 500, laserT);
      scannerLaser.style.opacity = '1';
      scannerLaser.style.top = `${laserY}px`;
      
      // Label printed
      if (frame >= 550) {
        const labelT = clamp01((frame - 550) / 30);
        shippingLabel.style.opacity = labelT;
        shippingLabel.style.transform = `scale(${lerp(0.5, 1.0, easeOutBack(labelT))})`;
        
        // Log terminal shows shipping tag
        barcodeLog.style.opacity = '1';
        const msg = "BARCODE_GEN: OK >> US-9823-DELIV";
        const charLen = Math.floor(clamp01((frame - 550) / 30) * msg.length);
        if (msg.substring(0, charLen) !== lastTypeMsg) {
          barcodeLog.textContent = msg.substring(0, charLen);
          lastTypeMsg = msg.substring(0, charLen);
        }
      }
    } else if (frame >= 600) {
      scannerLaser.style.opacity = '0';
      shippingLabel.style.opacity = '1';
      shippingLabel.style.transform = 'scale(1)';
      barcodeLog.style.opacity = '1';
      barcodeLog.textContent = "BARCODE_GEN: OK >> US-9823-DELIV";
    }

    // Conveyor track moves package off screen (610 - 660)
    if (frame >= 610) {
      const driveT = clamp01((frame - 610) / 50);
      const driveX = lerp(0, 450, easeInCubic(driveT));
      const boxS = lerp(1.0, 0.7, driveT);
      amazonBox.style.transform = `rotateX(-15deg) rotateY(35deg) translate3d(${driveX}px, 0, 0) scale(${boxS})`;
      amazonBox.style.opacity = 1 - driveT;
    }
  }

  // ─────────────────────────────────────────────────
  // PHASE 3: Flight of the Prime Drones (Frames 660 – 1020 / 22s – 34s)
  // ─────────────────────────────────────────────────
  else if (frame >= P3_START && frame < P4_START) {
    activateScene('delivery');
    resetOverlays();

    const phaseT = (frame - P3_START) / (P4_START - P3_START);

    // Parallax scrolling calculation
    const scrollOffsetBack = (frame * -0.5) % 400;
    const scrollOffsetMid  = (frame * -1.8) % 300;
    const scrollOffsetFore = (frame * -4.5) % 200;

    scrollingCity.querySelector('.skyline-back').style.backgroundPositionX = `${scrollOffsetBack}px`;
    scrollingCity.querySelector('.skyline-mid').style.backgroundPositionX = `${scrollOffsetMid}px`;
    streetRow.style.backgroundPositionX = `${scrollOffsetFore}px`;

    // Rotors spin dynamically
    const rotSpeedFactor = 30; // speed up propellers rotation representation
    const rxLR = 25 + 15 * Math.sin(frame * rotSpeedFactor);
    const rxRR = 25 - 15 * Math.sin(frame * rotSpeedFactor);
    
    // Animate Main Drone Rotors
    propLR.setAttribute('rx', Math.max(5, rxLR));
    propRR.setAttribute('rx', Math.max(5, rxRR));
    propLF.setAttribute('rx', Math.max(5, rxLR));
    propRF.setAttribute('rx', Math.max(5, rxRR));

    // Animate Secondary Escort Drone Rotors
    if (propLR2) {
      propLR2.setAttribute('rx', Math.max(5, rxLR));
      propRR2.setAttribute('rx', Math.max(5, rxRR));
      propLF2.setAttribute('rx', Math.max(5, rxLR));
      propRF2.setAttribute('rx', Math.max(5, rxRR));
    }

    // Drone flight entry / exit trajectory
    let dx = 0, dy = 0, ds = 1.0, dRot = 0;
    let payloadOffset = 0;
    let payloadOpacity = 1;

    // Drone flies in from upper-left (660 - 750)
    if (frame < 750) {
      const entryT = clamp01((frame - 660) / 90);
      dx = lerp(-350, 0, easeOutCubic(entryT));
      dy = lerp(-200, bobOffset, easeOutCubic(entryT));
      ds = lerp(0.5, 1.0, entryT);
      dRot = lerp(-15, 0, easeOutCubic(entryT));
      droneSearchlight.style.opacity = entryT * 0.9;
      if (droneSearchlight2) {
        droneSearchlight2.style.opacity = entryT * 0.7;
      }
    }
    // Hovering steady stage (750 - 870)
    else if (frame < 870) {
      dx = 0;
      dy = bobOffset;
      ds = 1.0;
      dRot = Math.sin(frame / 20) * 2.5; // slight swaying
      droneSearchlight.style.opacity = '1';
      if (droneSearchlight2) {
        droneSearchlight2.style.opacity = '0.8';
      }
    }
    // Descending to drop package (870 - 950)
    else if (frame < 950) {
      const dropT = clamp01((frame - 870) / 80);
      dx = 0;
      dy = lerp(bobOffset, 120, easeInOutQuad(dropT));
      ds = lerp(1.0, 1.25, dropT);
      dRot = 0;
      
      // Searchlight fades out
      droneSearchlight.style.opacity = 1 - dropT;
      if (droneSearchlight2) {
        droneSearchlight2.style.opacity = 0.8 * (1 - dropT);
      }

      // Package drops / release animation (around 930)
      if (frame >= 925) {
        const releaseT = clamp01((frame - 925) / 25);
        payloadOffset = lerp(0, 140, easeInCubic(releaseT));
        payloadOpacity = 1 - releaseT;
      }
    }
    // Drone flies away back into sky (950 - 1020)
    else {
      const exitT = clamp01((frame - 950) / 70);
      dx = lerp(0, 400, easeInCubic(exitT));
      dy = lerp(120, -280, easeInCubic(exitT));
      ds = lerp(1.25, 0.4, exitT);
      dRot = lerp(0, 20, exitT);
      droneSearchlight.style.opacity = '0';
      if (droneSearchlight2) {
        droneSearchlight2.style.opacity = '0';
      }
      payloadOpacity = 0;
    }

    // Apply main drone transforms
    droneWrapper.style.transform = `translate3d(calc(-50% + ${dx}px), calc(-50% + ${dy}px), 0) scale(${ds}) rotateZ(${dRot}deg)`;
    droneSearchlight.style.transform = `translateX(-50%) rotateZ(${-dRot}deg)`;
    
    // Apply secondary escort drone transforms (flies in tandem, offset back & slightly higher in background)
    if (droneWrapper2) {
      const dx2 = dx - 130;
      const dy2 = dy - 60;
      const ds2 = ds * 0.68;
      const dRot2 = dRot + Math.sin(frame * 0.05) * 1.5;
      
      droneWrapper2.style.transform = `translate3d(calc(-50% + ${dx2}px), calc(-50% + ${dy2}px), 0) scale(${ds2}) rotateZ(${dRot2}deg)`;
      if (droneSearchlight2) {
        droneSearchlight2.style.transform = `translateX(-50%) rotateZ(${-dRot2}deg)`;
      }
    }
    
    // Animate box cargo package location
    dronePayload.style.transform = `translateX(-50%) translateY(${payloadOffset}px)`;
    dronePayload.style.opacity = payloadOpacity;
  }

  // ─────────────────────────────────────────────────
  // PHASE 4: Unboxing & Brand Celebration (Frames 1020 – 1350 / 34s – 45s)
  // ─────────────────────────────────────────────────
  else if (frame >= P4_START) {
    activateScene('outro');
    resetOverlays();

    // Reset Scene 1 elements
    productCard.style.opacity = '0';

    // Doorstep package scales up in landing spot (1020 - 1050)
    const landT = clamp01((frame - 1020) / 30);
    doorstepPackage.style.transform = `translateX(-50%) scale(${lerp(0, 1.0, easeOutBack(landT))})`;

    // Door interior warm glow shines (1030 - 1060)
    if (frame >= 1030) {
      const glowT = clamp01((frame - 1030) / 30);
      doorGlow.style.opacity = glowT;
    } else {
      doorGlow.style.opacity = '0';
    }

    // Box flaps burst open wide (1055 - 1090)
    const flapLOpen = doorstepPackage.querySelector('.flap-left-open');
    const flapROpen = doorstepPackage.querySelector('.flap-right-open');
    const flapFOpen = doorstepPackage.querySelector('.flap-front-open');
    const flapBOpen = doorstepPackage.querySelector('.flap-back-open');

    if (frame >= 1055) {
      const openT = clamp01((frame - 1055) / 35);
      flapLOpen.style.transform = `rotateY(${lerp(-90, -140, easeOutBack(openT))}deg)`;
      flapROpen.style.transform = `rotateY(${lerp(90, 140, easeOutBack(openT))}deg)`;
      flapFOpen.style.transform = `rotateX(${lerp(-90, -130, easeOutBack(openT))}deg)`;
      flapBOpen.style.transform = `rotateX(${lerp(90, 130, easeOutBack(openT))}deg)`;
      
      // Floating Prime Smile rises out of the package
      const smileT = clamp01((frame - 1065) / 50);
      floatingSmile.style.opacity = smileT;
      floatingSmile.style.transform = `translate(-50%, calc(-50% - ${lerp(0, 120, easeOutCubic(smileT))}px)) scale(${lerp(0.5, 1.2, easeOutBack(smileT))})`;
    } else {
      flapLOpen.style.transform = 'rotateY(-90deg)';
      flapROpen.style.transform = 'rotateY(90deg)';
      flapFOpen.style.transform = 'rotateX(-90deg)';
      flapBOpen.style.transform = 'rotateX(90deg)';
      floatingSmile.style.opacity = '0';
      floatingSmile.style.transform = 'translate(-50%, -50%) scale(0.5)';
    }

    // Outro logo & tagline fade in (1100 - 1150)
    if (frame >= 1100) {
      const textT = clamp01((frame - 1100) / 40);
      outroContent.style.opacity = textT;
      outroContent.style.transform = `scale(${lerp(0.92, 1.0, easeOutCubic(textT))})`;
      outroContent.style.pointerEvents = 'auto';
    } else {
      outroContent.style.opacity = '0';
      outroContent.style.transform = 'scale(0.92)';
      outroContent.style.pointerEvents = 'none';
    }

    // Stats cards slide up in staggered increments
    [stat1, stat2, stat3].forEach((el, idx) => {
      const statStart = 1130 + idx * 25;
      if (frame >= statStart) {
        const sT = clamp01((frame - statStart) / 25);
        el.style.opacity = sT;
        el.style.transform = `translateY(${lerp(20, 0, easeOutCubic(sT))}px)`;
      } else {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
      }
    });

    // Delivered Success Toast pops up (1110 - 1350)
    if (frame >= 1110) {
      celebrationToast.classList.add('active');
    } else {
      celebrationToast.classList.remove('active');
    }

    // Confetti System explosion
    const confettiElapsed = frame - 1060;
    if (confettiElapsed > 0) {
      drawConfetti(confettiElapsed);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
}

// ═══════════════════════════════════════════════════════════
// PLAYBACK HEARTBEAT ENGINE
// ═══════════════════════════════════════════════════════════
function tick(timestamp) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  
  // Safe frame-delta protector to prevent freezes
  const elapsedMs = Math.min(timestamp - lastTimestamp, 100);
  lastTimestamp = timestamp;

  if (isPlaying) {
    currentFrame += (elapsedMs / 1000) * FPS * playSpeed;
    if (currentFrame >= TOTAL_FRAMES) currentFrame = 0;
    updateShowcase(currentFrame);
  }
  requestAnimationFrame(tick);
}

// ── Controls Action Hookups ──
btnPlay.addEventListener('click', () => {
  isPlaying = !isPlaying;
  btnPlay.textContent = isPlaying ? 'Pause' : 'Play';
  btnPlay.classList.toggle('btn-primary', isPlaying);
  btnPlay.classList.toggle('btn-secondary', !isPlaying);
});

btnRestart.addEventListener('click', () => {
  currentFrame = 0;
  lastTypeMsg = '';
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
  lastTypeMsg = '';
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
    lastTypeMsg = '';
    updateShowcase(currentFrame);
    if (isPlaying) {
      isPlaying = false;
      btnPlay.textContent = 'Play';
      btnPlay.classList.remove('btn-primary');
      btnPlay.classList.add('btn-secondary');
    }
  });
});

// Support frame scrubbing via URL parameters
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
