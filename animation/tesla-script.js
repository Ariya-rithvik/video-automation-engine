// ═══════════════════════════════════════════════════════════
// TESLA — CYBERTRUCK REVEAL SHOWCASE — 45s ANIMATION
// ═══════════════════════════════════════════════════════════

const TOTAL_FRAMES = 1350;
const FPS = 30;

const P1_START = 0;     // Autopilot (0s – 11s)
const P2_START = 330;   // Cybertruck Wireframe (11s – 22s)
const P3_START = 660;   // Supercharger (22s – 34s)
const P4_START = 1020;  // Brand (34s – 45s)

let currentFrame = 0, isPlaying = true, playSpeed = 1.0, lastTimestamp = 0;

// DOM
const sceneDash = document.getElementById('scene-dash');
const sceneWire = document.getElementById('scene-wireframe');
const sceneCharger = document.getElementById('scene-charger');
const sceneBrand = document.getElementById('scene-brand');

const dashPanel = document.getElementById('dash-panel');
const dashSpeed = document.getElementById('dash-speed');
const dashRange = document.getElementById('dash-range');
const apBadge = document.getElementById('ap-badge');
const dashRoadCanvas = document.getElementById('dash-road-canvas');
const rCtx = dashRoadCanvas.getContext('2d');

const wireCanvas = document.getElementById('wireframe-canvas');
const wCtx = wireCanvas.getContext('2d');
const wfLabels = [
  document.getElementById('wf-label-tl'),
  document.getElementById('wf-label-tr'),
  document.getElementById('wf-label-bc')
];

const scPost1 = document.getElementById('sc-post-1');
const scPost2 = document.getElementById('sc-post-2');
const scCar = document.getElementById('sc-car');
const scCable = document.getElementById('sc-cable-1');
const scPlugGlow = document.getElementById('sc-plug-glow-1');
const chargeBar = document.getElementById('charge-bar');
const chargeFill = document.getElementById('charge-fill');
const chargePct = document.getElementById('charge-pct');
const chargeStats = document.getElementById('charge-stats');
const csPower = document.getElementById('cs-power');
const csAdded = document.getElementById('cs-added');
const csTime = document.getElementById('cs-time');

const brandLogo = document.getElementById('brand-logo');
const brandTagline = document.getElementById('brand-tagline');
const brandSubtitle = document.getElementById('brand-subtitle');
const stats = [document.getElementById('stat-1'), document.getElementById('stat-2'),
               document.getElementById('stat-3'), document.getElementById('stat-4')];

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

confettiCanvas.width = 1024; confettiCanvas.height = 576;

// Helpers
function lerp(a,b,t){return(1-t)*a+t*b;}
function clamp01(t){return Math.max(0,Math.min(1,t));}
function easeOutCubic(x){return 1-Math.pow(1-x,3);}
function easeOutBack(x){const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2);}
function easeInOutQuad(x){return x<0.5?2*x*x:1-Math.pow(-2*x+2,2)/2;}

// ═══════════════════════════════════════════════════════════
// AUTOPILOT ROAD DRAWING
// ═══════════════════════════════════════════════════════════
function drawRoad(frame) {
  rCtx.clearRect(0, 0, 800, 300);
  const speed = clamp01((frame - 30) / 150);
  const scroll = frame * 3 * speed;

  // Vanishing point road
  const vpX = 400, vpY = 60;

  // Road surface
  rCtx.fillStyle = '#1a1a24';
  rCtx.beginPath();
  rCtx.moveTo(vpX, vpY);
  rCtx.lineTo(0, 300);
  rCtx.lineTo(800, 300);
  rCtx.closePath();
  rCtx.fill();

  // Road lines
  rCtx.strokeStyle = 'rgba(255,255,255,0.12)';
  rCtx.lineWidth = 1;
  // Left edge
  rCtx.beginPath();
  rCtx.moveTo(vpX, vpY);
  rCtx.lineTo(80, 300);
  rCtx.stroke();
  // Right edge
  rCtx.beginPath();
  rCtx.moveTo(vpX, vpY);
  rCtx.lineTo(720, 300);
  rCtx.stroke();

  // Center dashes (perspective)
  for (let i = 0; i < 20; i++) {
    const t = ((i * 0.05 + scroll * 0.001) % 1);
    const y = vpY + (300 - vpY) * t;
    const x = vpX;
    const dashLen = 2 + t * 15;
    const alpha = t * 0.4;
    rCtx.strokeStyle = `rgba(255,255,255,${alpha})`;
    rCtx.lineWidth = 1 + t * 2;
    rCtx.beginPath();
    rCtx.moveTo(x, y);
    rCtx.lineTo(x, y + dashLen);
    rCtx.stroke();
  }

  // Autopilot lane markers (blue)
  if (frame >= 120) {
    const apAlpha = clamp01((frame - 120) / 30) * 0.5;
    rCtx.strokeStyle = `rgba(59,130,246,${apAlpha})`;
    rCtx.lineWidth = 2;
    // Left lane
    rCtx.beginPath();
    rCtx.moveTo(vpX, vpY);
    rCtx.lineTo(200, 300);
    rCtx.stroke();
    // Right lane
    rCtx.beginPath();
    rCtx.moveTo(vpX, vpY);
    rCtx.lineTo(600, 300);
    rCtx.stroke();
  }

  // Detected car ahead (box)
  if (frame >= 160) {
    const carT = clamp01((frame - 160) / 30);
    const carAlpha = carT * 0.6;
    const carY = lerp(80, 140, Math.sin(frame * 0.02) * 0.5 + 0.5);
    const carW = 30 + carT * 10;
    const carH = 15 + carT * 5;
    rCtx.strokeStyle = `rgba(59,130,246,${carAlpha})`;
    rCtx.lineWidth = 1.5;
    rCtx.strokeRect(vpX - carW/2, carY, carW, carH);
    // Label
    rCtx.fillStyle = `rgba(59,130,246,${carAlpha})`;
    rCtx.font = '9px Inter';
    rCtx.fillText('45 km/h', vpX - 15, carY - 4);
  }
}

// ═══════════════════════════════════════════════════════════
// CYBERTRUCK WIREFRAME — Line-by-line laser draw
// ═══════════════════════════════════════════════════════════
// Cybertruck outline points (angular low-poly design)
const CYBER_LINES = [
  // Main body outline
  [[180,380],[220,280]], [[220,280],[300,240]], [[300,240],[480,200]],
  [[480,200],[620,200]], [[620,200],[720,220]], [[720,220],[780,260]],
  [[780,260],[840,340]], [[840,340],[840,380]], [[840,380],[180,380]],
  // Roof/windshield
  [[300,240],[380,195]], [[380,195],[520,185]], [[520,185],[620,200]],
  // Window line
  [[380,195],[380,240]], [[520,185],[520,200]],
  // Front detail
  [[780,260],[810,280]], [[810,280],[840,340]],
  // Bed/trunk line
  [[220,280],[220,380]],
  // Wheel arches
  [[240,380],[260,350],[310,340],[360,350],[380,380]],
  [[650,380],[670,340],[720,330],[770,340],[790,380]],
  // Bottom line details
  [[380,380],[650,380]],
  // Headlight
  [[830,295],[845,310]], [[845,310],[830,325]],
  // Taillight
  [[185,300],[200,290]], [[200,320],[185,330]],
  // A-pillar
  [[300,240],[300,380]],
];

// Flatten for progressive drawing
const allSegments = [];
CYBER_LINES.forEach(line => {
  if (line.length === 2) {
    allSegments.push({from: line[0], to: line[1]});
  } else {
    for (let i = 0; i < line.length - 1; i++) {
      allSegments.push({from: line[i], to: line[i+1]});
    }
  }
});

function drawCybertruck(progress, frame) {
  wCtx.clearRect(0, 0, 1024, 576);

  // Grid background
  wCtx.strokeStyle = 'rgba(200,200,220,0.03)';
  wCtx.lineWidth = 0.5;
  for (let x = 0; x < 1024; x += 40) {
    wCtx.beginPath(); wCtx.moveTo(x, 0); wCtx.lineTo(x, 576); wCtx.stroke();
  }
  for (let y = 0; y < 576; y += 40) {
    wCtx.beginPath(); wCtx.moveTo(0, y); wCtx.lineTo(1024, y); wCtx.stroke();
  }

  const totalSegs = allSegments.length;
  const drawnSegs = Math.floor(progress * totalSegs);
  const partialProgress = (progress * totalSegs) - drawnSegs;

  // Draw completed segments
  for (let i = 0; i < Math.min(drawnSegs, totalSegs); i++) {
    const seg = allSegments[i];
    const age = (drawnSegs - i) / totalSegs;
    
    // Bright initial, fading to static
    const brightness = Math.max(0.3, 1 - age * 0.7);
    
    wCtx.strokeStyle = `rgba(200,200,220,${brightness})`;
    wCtx.lineWidth = 1.5;
    wCtx.shadowColor = `rgba(200,200,220,${brightness * 0.5})`;
    wCtx.shadowBlur = brightness * 8;
    wCtx.beginPath();
    wCtx.moveTo(seg.from[0], seg.from[1]);
    wCtx.lineTo(seg.to[0], seg.to[1]);
    wCtx.stroke();
    wCtx.shadowBlur = 0;
  }

  // Draw partial segment (laser tip)
  if (drawnSegs < totalSegs) {
    const seg = allSegments[drawnSegs];
    const endX = lerp(seg.from[0], seg.to[0], partialProgress);
    const endY = lerp(seg.from[1], seg.to[1], partialProgress);

    // Laser line
    wCtx.strokeStyle = 'rgba(232,33,39,0.9)';
    wCtx.lineWidth = 2;
    wCtx.shadowColor = '#e82127';
    wCtx.shadowBlur = 15;
    wCtx.beginPath();
    wCtx.moveTo(seg.from[0], seg.from[1]);
    wCtx.lineTo(endX, endY);
    wCtx.stroke();

    // Laser dot
    wCtx.fillStyle = '#fff';
    wCtx.shadowColor = '#e82127';
    wCtx.shadowBlur = 20;
    wCtx.beginPath();
    wCtx.arc(endX, endY, 3, 0, Math.PI * 2);
    wCtx.fill();
    wCtx.shadowBlur = 0;
  }

  // Vertices glow
  for (let i = 0; i < Math.min(drawnSegs + 1, totalSegs); i++) {
    const seg = allSegments[i];
    const alpha = Math.max(0.1, 0.5 - (drawnSegs - i) / totalSegs);
    wCtx.fillStyle = `rgba(200,200,220,${alpha})`;
    wCtx.beginPath();
    wCtx.arc(seg.from[0], seg.from[1], 2, 0, Math.PI * 2);
    wCtx.fill();
  }

  // After complete — glow pulse
  if (progress >= 1) {
    const pulse = Math.sin(frame * 0.05) * 0.1 + 0.5;
    for (let i = 0; i < totalSegs; i++) {
      const seg = allSegments[i];
      wCtx.strokeStyle = `rgba(232,33,39,${pulse * 0.15})`;
      wCtx.lineWidth = 3;
      wCtx.shadowColor = `rgba(232,33,39,${pulse * 0.3})`;
      wCtx.shadowBlur = 12;
      wCtx.beginPath();
      wCtx.moveTo(seg.from[0], seg.from[1]);
      wCtx.lineTo(seg.to[0], seg.to[1]);
      wCtx.stroke();
      wCtx.shadowBlur = 0;
    }
  }
}

// ═══════════════════════════════════════════════════════════
// CONFETTI
// ═══════════════════════════════════════════════════════════
const CONFETTI_COUNT = 80;
const confettiSeeds = [];
const confettiColors = ['#e82127','#c0c0c0','#ffffff','#4ade80','#808090','#e82127','#3b82f6'];
for(let i=0;i<CONFETTI_COUNT;i++){
  const angle=(1.3+Math.abs(Math.sin(i*432.1))*0.4)*Math.PI;
  const speed=4+Math.abs(Math.cos(i*123.4))*14;
  confettiSeeds.push({vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,
    size:5+Math.abs(Math.sin(i*987.6))*7,color:confettiColors[i%confettiColors.length],
    rotSpeed:-8+Math.abs(Math.cos(i*654.3))*16,rotOffset:Math.abs(Math.sin(i*321.0))*360});
}
function drawConfetti(t){
  cCtx.clearRect(0,0,1024,576);if(t<=0)return;
  const gravity=0.35,startX=512,startY=260,groundY=540;
  for(let i=0;i<CONFETTI_COUNT;i++){
    const s=confettiSeeds[i];let dx=s.vx*t,dy=s.vy*t+0.5*gravity*t*t;
    let cx=startX+dx,cy=startY+dy;
    if(cy>groundY){const a=0.5*gravity,b=s.vy,c=startY-groundY,disc=b*b-4*a*c;
      if(disc>=0){const tc=(-b+Math.sqrt(disc))/(2*a);if(t>tc){const tp=t-tc,vyc=s.vy+gravity*tc;
        cx=startX+s.vx*tc+s.vx*0.7*tp;cy=groundY+(-vyc*0.35)*tp+0.5*gravity*tp*tp;if(cy>groundY)cy=groundY;}}}
    let opacity=1.0;if(t>25)opacity=Math.max(0,1-(t-25)/25);if(opacity<=0)continue;
    const rot=(s.rotOffset+t*s.rotSpeed)*Math.PI/180;
    cCtx.save();cCtx.translate(cx,cy);cCtx.rotate(rot);
    cCtx.fillStyle=s.color;cCtx.globalAlpha=opacity;
    cCtx.fillRect(-s.size/2,-s.size/2,s.size,s.size);cCtx.restore();
  }
}

// ═══════════════════════════════════════════════════════════
// SCENE MANAGEMENT
// ═══════════════════════════════════════════════════════════
function activateScene(name) {
  const configs = [
    { el: sceneDash,    active: name === 'dash' },
    { el: sceneWire,    active: name === 'wire' },
    { el: sceneCharger, active: name === 'charger' },
    { el: sceneBrand,   active: name === 'brand' }
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
// MAIN UPDATE
// ═══════════════════════════════════════════════════════════
function updateShowcase(frame) {
  slider.value = Math.floor(frame);
  currentTimeEl.textContent = `${(frame / FPS).toFixed(2)}s`;
  stepIndicators.forEach((ind) => {
    const start = parseInt(ind.dataset.frame, 10);
    const idx = Array.from(stepIndicators).indexOf(ind);
    const next = stepIndicators[idx + 1] ? parseInt(stepIndicators[idx + 1].dataset.frame, 10) : TOTAL_FRAMES;
    ind.classList.toggle('active', frame >= start && frame < next);
  });

  // ── PHASE 1: Autopilot Dashboard (0 – 330) ──
  if (frame >= P1_START && frame < P2_START) {
    activateScene('dash');
    virtualCursor.style.display = 'none';
    cCtx.clearRect(0, 0, 1024, 576);
    wCtx.clearRect(0, 0, 1024, 576);

    // Panel entry
    const entryT = clamp01(frame / 30);
    dashPanel.style.opacity = easeOutCubic(entryT);
    dashPanel.style.transform = `scale(${lerp(0.95, 1, easeOutBack(entryT))})`;

    // Speed ramp up (30-180)
    const speedT = clamp01((frame - 30) / 150);
    const speed = Math.round(lerp(0, 120, easeInOutQuad(speedT)));
    dashSpeed.textContent = speed;

    // Range decrease
    const range = Math.round(390 - speedT * 12);
    dashRange.textContent = range;

    // Draw road
    drawRoad(frame);

    // Autopilot badge (120+)
    if (frame >= 120) {
      const apT = clamp01((frame - 120) / 20);
      apBadge.style.opacity = easeOutCubic(apT);
      apBadge.style.transform = `translateX(-50%) scale(${lerp(0.9, 1, easeOutBack(apT))})`;
    } else {
      apBadge.style.opacity = '0';
    }

    // Cursor clicks autopilot at 100
    if (frame >= 85 && frame < 130) {
      virtualCursor.style.display = 'block';
      const moveT = clamp01((frame - 85) / 12);
      virtualCursor.style.transform = `translate3d(${lerp(600, 475, easeOutCubic(moveT))}px, ${lerp(100, 220, easeOutCubic(moveT))}px, 200px)`;
    }
    if (frame >= 100 && frame < 110) cursorRipple.classList.add('click-wave');
    else cursorRipple.classList.remove('click-wave');

    // Fade out (300-330)
    if (frame >= 300) {
      const fadeT = clamp01((frame - 300) / 30);
      sceneDash.style.filter = `brightness(${lerp(1, 0, fadeT)})`;
    } else {
      sceneDash.style.filter = 'brightness(1)';
    }
  }

  // ── PHASE 2: Cybertruck Wireframe (330 – 660) ──
  if (frame >= P2_START && frame < P3_START) {
    activateScene('wire');
    virtualCursor.style.display = 'none';
    cCtx.clearRect(0, 0, 1024, 576);

    const localF = frame - P2_START;
    const drawDuration = 250; // frames to complete drawing
    const drawProgress = clamp01(localF / drawDuration);

    drawCybertruck(drawProgress, frame);

    // Labels fade in after drawing is partly done
    wfLabels.forEach((lbl, i) => {
      const startF = 120 + i * 40;
      const t = clamp01((localF - startF) / 25);
      lbl.style.opacity = easeOutCubic(t);
    });

    // Fade out (300-330)
    if (localF >= 300) {
      const fadeT = clamp01((localF - 300) / 30);
      sceneWire.style.filter = `brightness(${lerp(1, 0, fadeT)})`;
    } else {
      sceneWire.style.filter = 'brightness(1)';
    }
  }

  // ── PHASE 3: Supercharger (660 – 1020) ──
  if (frame >= P3_START && frame < P4_START) {
    activateScene('charger');
    virtualCursor.style.display = 'none';
    cCtx.clearRect(0, 0, 1024, 576);
    wCtx.clearRect(0, 0, 1024, 576);

    const localF = frame - P3_START;

    // Supercharger posts appear (0-30)
    const postT = clamp01(localF / 25);
    scPost1.setAttribute('opacity', easeOutCubic(postT));
    scPost2.setAttribute('opacity', easeOutCubic(clamp01((localF - 10) / 25)));

    // Car drives in (20-80)
    if (localF >= 20) {
      const carT = clamp01((localF - 20) / 50);
      scCar.setAttribute('opacity', '1');
      const carX = lerp(300, 0, easeOutCubic(carT));
      scCar.setAttribute('transform', `translate(${carX}, 0)`);
    } else {
      scCar.setAttribute('opacity', '0');
    }

    // Cable connects (80-120)
    if (localF >= 80) {
      const cableT = clamp01((localF - 80) / 30);
      scCable.setAttribute('opacity', easeOutCubic(cableT));
      scPlugGlow.setAttribute('opacity', (cableT * 0.8).toString());
      
      // Plug glow pulse
      if (localF >= 110) {
        const pulse = Math.sin(localF * 0.1) * 0.3 + 0.7;
        scPlugGlow.setAttribute('r', (6 + pulse * 4).toString());
      }
    }

    // Charge progress (110+)
    if (localF >= 110) {
      const chargeT = clamp01((localF - 110) / 200);
      const pct = Math.round(lerp(15, 95, easeInOutQuad(chargeT)));
      
      chargeBar.style.opacity = '1';
      chargeFill.style.width = `${pct}%`;
      chargePct.style.opacity = '1';
      chargePct.textContent = `${pct}%`;
      
      // Stats
      chargeStats.style.opacity = clamp01((localF - 130) / 20).toString();
      const power = Math.round(lerp(250, 80, chargeT));
      const added = Math.round(lerp(0, 280, chargeT));
      const time = Math.max(1, Math.round(lerp(25, 1, chargeT)));
      csPower.textContent = `${power} kW`;
      csAdded.textContent = `${added} km`;
      csTime.textContent = `${time} min`;
    } else {
      chargeBar.style.opacity = '0';
      chargePct.style.opacity = '0';
      chargeStats.style.opacity = '0';
    }

    // Fade out (330-360)
    if (localF >= 330) {
      const fadeT = clamp01((localF - 330) / 30);
      sceneCharger.style.filter = `brightness(${lerp(1, 0, fadeT)})`;
    } else {
      sceneCharger.style.filter = 'brightness(1)';
    }
  }

  // ── PHASE 4: Brand Celebration (1020 – 1350) ──
  if (frame >= P4_START) {
    activateScene('brand');
    virtualCursor.style.display = 'none';
    wCtx.clearRect(0, 0, 1024, 576);

    const localF = frame - P4_START;
    const gFloat = Math.sin((localF / 20) * Math.PI) * 3;

    // Logo
    if (localF >= 0) {
      const t = clamp01(localF / 30);
      brandLogo.style.opacity = easeOutCubic(t);
      brandLogo.style.transform = `scale(${lerp(0.7, 1, easeOutBack(t))}) translateY(${gFloat}px)`;
    }

    // Tagline
    if (localF >= 40) {
      const t = clamp01((localF - 40) / 25);
      brandTagline.style.opacity = easeOutCubic(t);
      brandTagline.style.transform = `translateY(${lerp(20, 0, easeOutCubic(t))}px)`;
    } else { brandTagline.style.opacity = '0'; }

    // Subtitle
    if (localF >= 70) {
      const t = clamp01((localF - 70) / 25);
      brandSubtitle.style.opacity = easeOutCubic(t);
    } else { brandSubtitle.style.opacity = '0'; }

    // Stats
    stats.forEach((el, i) => {
      const startF = 100 + i * 20;
      if (localF >= startF) {
        const t = clamp01((localF - startF) / 22);
        el.style.opacity = easeOutCubic(t);
        el.style.transform = `translateY(${lerp(15, 0, easeOutCubic(t))}px)`;
      } else { el.style.opacity = '0'; el.style.transform = 'translateY(15px)'; }
    });

    // Confetti
    const confettiT = localF - 80;
    if (confettiT > 0) drawConfetti(confettiT);
    else cCtx.clearRect(0, 0, 1024, 576);
  }
}

// ═══════════════════════════════════════════════════════════
// PLAYBACK
// ═══════════════════════════════════════════════════════════
function tick(ts) {
  if (!lastTimestamp) lastTimestamp = ts;
  const elapsed = Math.min(ts - lastTimestamp, 100);
  lastTimestamp = ts;
  if (isPlaying) {
    currentFrame += (elapsed / 1000) * FPS * playSpeed;
    if (currentFrame >= TOTAL_FRAMES) currentFrame = 0;
    updateShowcase(currentFrame);
  }
  requestAnimationFrame(tick);
}

btnPlay.addEventListener('click', () => {
  isPlaying = !isPlaying;
  btnPlay.textContent = isPlaying ? 'Pause' : 'Play';
  btnPlay.classList.toggle('btn-primary', isPlaying);
  btnPlay.classList.toggle('btn-secondary', !isPlaying);
});
btnRestart.addEventListener('click', () => {
  currentFrame = 0; updateShowcase(0);
  if (!isPlaying) { isPlaying = true; btnPlay.textContent = 'Pause'; btnPlay.classList.remove('btn-secondary'); btnPlay.classList.add('btn-primary'); }
});
speedBtns.forEach(btn => btn.addEventListener('click', () => {
  speedBtns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active'); playSpeed = parseFloat(btn.dataset.speed);
}));
slider.addEventListener('input', e => {
  currentFrame = parseInt(e.target.value, 10); updateShowcase(currentFrame);
  if (isPlaying) { isPlaying = false; btnPlay.textContent = 'Play'; btnPlay.classList.remove('btn-primary'); btnPlay.classList.add('btn-secondary'); }
});
stepIndicators.forEach(ind => ind.addEventListener('click', () => {
  currentFrame = parseInt(ind.dataset.frame, 10); updateShowcase(currentFrame);
  if (isPlaying) { isPlaying = false; btnPlay.textContent = 'Play'; btnPlay.classList.remove('btn-primary'); btnPlay.classList.add('btn-secondary'); }
}));

const urlParams = new URLSearchParams(window.location.search);
const frameParam = urlParams.get('frame');
if (frameParam !== null) {
  currentFrame = parseInt(frameParam, 10); isPlaying = false;
  btnPlay.textContent = 'Play'; btnPlay.classList.remove('btn-primary'); btnPlay.classList.add('btn-secondary');
}

updateShowcase(currentFrame);
requestAnimationFrame(tick);
