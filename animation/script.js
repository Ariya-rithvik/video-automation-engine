// Animation constants
const TOTAL_FRAMES = 240;
const FPS = 30;

// Frame boundaries for phases
const PHASE_START_1 = 0;   // Search Focus
const PHASE_START_2 = 60;  // Typewriter Input
const PHASE_START_3 = 90;  // 3D Shoe Grid
const PHASE_START_4 = 150; // Box Morph & Delivery

// State variables
let currentFrame = 0;
let isPlaying = true;
let playSpeed = 1.0;
let lastTimestamp = 0;

// DOM Elements
const viewport = document.querySelector('.showcase-viewport');
const amazonScreen = document.getElementById('amazon-screen');
const brandScreen = document.getElementById('brand-screen');
const deliveryScreen = document.getElementById('delivery-screen');
const searchBar = document.getElementById('floating-search-bar');
const searchPlaceholder = document.getElementById('search-placeholder');
const searchCursor = document.getElementById('search-cursor');
const virtualCursor = document.getElementById('virtual-cursor');
const cursorRipple = document.getElementById('cursor-ripple');
const morphContainer = document.getElementById('morph-container');
const morphBox = document.getElementById('morphing-box-element');
const morphShoeSvg = document.getElementById('box-shoe-inner');
const doorWrapper = document.querySelector('.porch-door-wrapper');
const deliveryToast = document.getElementById('delivery-toast');
const canvas = document.getElementById('confetti-canvas');
const ctx = canvas.getContext('2d');

// Cards
const shoeCards = [
  document.getElementById('shoe-card-1'),
  document.getElementById('shoe-card-2'),
  document.getElementById('shoe-card-3'),
  document.getElementById('shoe-card-4')
];

// Controls
const btnPlay = document.getElementById('btn-play');
const btnRestart = document.getElementById('btn-restart');
const speedBtns = document.querySelectorAll('.speed-btn');
const slider = document.getElementById('timeline-slider');
const totalTimeLabel = document.getElementById('total-time-label');
const stepIndicators = document.querySelectorAll('.step-indicator');

// Resize canvas to fill viewport
function resizeCanvas() {
  canvas.width = viewport.clientWidth;
  canvas.height = viewport.clientHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ── Confetti Particle Physics System ──
let confettiParticles = [];
class Confetti {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.size = Math.random() * 8 + 6;
    this.color = `hsl(${Math.random() * 360}, 90%, 60%)`;
    this.speedX = Math.random() * 12 - 6;
    this.speedY = Math.random() * -10 - 5; // upward blast
    this.gravity = 0.35;
    this.rotation = Math.random() * 360;
    this.rotationSpeed = Math.random() * 10 - 5;
    this.opacity = 1.0;
  }
  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    this.speedY += this.gravity;
    this.rotation += this.rotationSpeed;
    if (this.y > canvas.height - 30) {
      this.speedY *= -0.4; // bounce slightly
      this.speedX *= 0.8;
    }
    // Fade out as it ages
    this.opacity -= 0.012;
  }
  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.fillStyle = this.color;
    ctx.globalAlpha = Math.max(0, this.opacity);
    ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    ctx.restore();
  }
}

function triggerConfettiBurst() {
  confettiParticles = [];
  // Center porch rug area coordinates on canvas: x=512, y=420
  for (let i = 0; i < 90; i++) {
    confettiParticles.push(new Confetti(512, 420));
  }
}

function updateConfetti() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  confettiParticles.forEach((p, idx) => {
    p.update();
    p.draw();
    if (p.opacity <= 0) confettiParticles.splice(idx, 1);
  });
}

// ── Interpolation Helper (custom clamp & curves) ──
function lerp(start, end, amt) {
  return (1 - amt) * start + amt * end;
}

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

// ── Core Animation Update ──
function updateShowcase(frame) {
  // Sync slider input value
  slider.value = Math.floor(frame);
  
  // Set time label
  const seconds = (frame / FPS).toFixed(2);
  document.querySelector('.time-label').textContent = `${seconds}s`;

  // Update step indicator active states
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

  // -------------------------------------------------------------
  // PHASE 1: Search Focus (Frames 0 to 60)
  // -------------------------------------------------------------
  if (frame >= PHASE_START_1 && frame < PHASE_START_2) {
    // Active Screen
    amazonScreen.classList.add('active');
    brandScreen.classList.remove('active');
    deliveryScreen.classList.remove('active');
    
    // Search bar state
    searchBar.classList.remove('brand-hidden');
    searchPlaceholder.textContent = '';
    searchCursor.style.display = 'inline';

    // Morph elements hidden
    morphContainer.classList.remove('visible');
    deliveryToast.classList.remove('active');
    doorWrapper.classList.remove('door-opened');

    // Reset card animation classes
    shoeCards.forEach(c => {
      c.classList.remove('fly-in', 'levitate', 'selected-out', 'active-morph-source');
    });

    // 1. Move virtual cursor from offscreen bottom right to the search bar
    // Starting coordinate: (950, 500); Search bar focus center coordinate: (540, 276)
    let pointerX, pointerY;
    if (frame < 12) {
      // Idle offscreen
      pointerX = 950;
      pointerY = 500;
    } else if (frame >= 12 && frame < 36) {
      // Move to search bar input field
      const t = easeInOutCubic((frame - 12) / 24);
      pointerX = lerp(950, 480, t);
      pointerY = lerp(500, 276, t);
    } else {
      // Float focus active
      pointerX = 480;
      pointerY = 276;
    }
    virtualCursor.style.transform = `translate3d(${pointerX}px, ${pointerY}px, 0)`;

    // Click wave trigger
    if (frame === 36) {
      cursorRipple.classList.add('click-wave');
      searchBar.classList.add('focus-active');
    } else if (frame < 36) {
      cursorRipple.classList.remove('click-wave');
      searchBar.classList.remove('focus-active');
    }

    // Blur homepage grid slowly after focus click
    if (frame >= 36) {
      const t = (frame - 36) / 24;
      const blur = lerp(0, 10, t);
      amazonScreen.querySelector('.mock-grid').style.filter = `blur(${blur}px)`;
      amazonScreen.querySelector('.mock-grid').style.opacity = lerp(1, 0.4, t);
    } else {
      amazonScreen.querySelector('.mock-grid').style.filter = 'none';
      amazonScreen.querySelector('.mock-grid').style.opacity = '1';
    }
  }

  // -------------------------------------------------------------
  // PHASE 2: Typewriter Input (Frames 60 to 90)
  // -------------------------------------------------------------
  if (frame >= PHASE_START_2 && frame < PHASE_START_3) {
    amazonScreen.classList.add('active');
    brandScreen.classList.remove('active');
    deliveryScreen.classList.remove('active');
    searchBar.classList.remove('brand-hidden');
    searchBar.classList.add('focus-active');
    morphContainer.classList.remove('visible');

    // Typewriter shoes text
    const text = 'shoes';
    const progress = (frame - PHASE_START_2) / 18; // type over 18 frames
    const chars = Math.min(text.length, Math.floor(lerp(0, text.length + 1, progress)));
    searchPlaceholder.textContent = text.slice(0, chars);

    // Virtual cursor moves to search button
    let pointerX, pointerY;
    if (frame < 78) {
      pointerX = 480;
      pointerY = 276;
      cursorRipple.classList.remove('click-wave');
    } else {
      // Move to search button coordinate: (720, 276)
      const t = easeInOutCubic((frame - 78) / 12);
      pointerX = lerp(480, 720, t);
      pointerY = lerp(276, 276, t);
    }
    virtualCursor.style.transform = `translate3d(${pointerX}px, ${pointerY}px, 0)`;

    // Click trigger on Search button
    if (frame === 88) {
      cursorRipple.classList.add('click-wave');
    }
  }

  // -------------------------------------------------------------
  // PHASE 3: 3D Shoe Grid Rises (Frames 90 to 150)
  // -------------------------------------------------------------
  if (frame >= PHASE_START_3 && frame < PHASE_START_4) {
    amazonScreen.classList.remove('active');
    brandScreen.classList.add('active');
    deliveryScreen.classList.remove('active');
    searchBar.classList.add('brand-hidden'); // fade search bar away
    morphContainer.classList.remove('visible');
    deliveryToast.classList.remove('active');
    doorWrapper.classList.remove('door-opened');

    // Trigger fly-in animation classes at frame 90
    if (frame === 90) {
      shoeCards.forEach(c => {
        c.classList.add('fly-in');
        c.style.opacity = '1';
      });
    }
    
    // Add floating levitation once fly-in completes (frame 110)
    if (frame >= 110) {
      shoeCards.forEach(c => {
        c.classList.remove('fly-in');
        c.classList.add('levitate');
      });
    } else {
      shoeCards.forEach(c => c.classList.remove('levitate'));
    }

    // Move virtual cursor to Card 1 Select Option button
    // Card 1 Button Position: x=190, y=412
    let pointerX, pointerY;
    if (frame < 105) {
      pointerX = 720;
      pointerY = 276;
      cursorRipple.classList.remove('click-wave');
    } else if (frame >= 105 && frame < 132) {
      const t = easeInOutCubic((frame - 105) / 27);
      pointerX = lerp(720, 190, t);
      pointerY = lerp(276, 412, t);
    } else {
      pointerX = 190;
      pointerY = 412;
    }
    virtualCursor.style.transform = `translate3d(${pointerX}px, ${pointerY}px, 0)`;

    // Click Card 1 Option Button
    if (frame === 132) {
      cursorRipple.classList.add('click-wave');
      // Highlight Card 1, Fade others
      shoeCards[0].classList.add('active-morph-source');
      shoeCards[1].classList.add('selected-out');
      shoeCards[2].classList.add('selected-out');
      shoeCards[3].classList.add('selected-out');
    } else if (frame < 132) {
      shoeCards[0].classList.remove('active-morph-source');
      shoeCards.forEach(c => c.classList.remove('selected-out'));
    }
  }

  // -------------------------------------------------------------
  // PHASE 4: Parcel Morph & Door Delivery (Frames 150 to 240)
  // -------------------------------------------------------------
  if (frame >= PHASE_START_4) {
    brandScreen.classList.remove('active');
    deliveryScreen.classList.add('active');
    searchBar.classList.add('brand-hidden');
    virtualCursor.style.transform = 'translate3d(950px, 500px, 0)'; // Return cursor offscreen

    // Show morph overlay
    morphContainer.classList.add('visible');

    // 1. Squash card shape to Cardboard Box (Frames 150 to 180)
    if (frame >= 150 && frame < 185) {
      const t = (frame - 150) / 35;
      const easeT = easeInOutCubic(t);
      
      // Calculate coordinates to slide Card 1 to Center-mat entrance
      // Mat entrance center: x=457, y=280
      const boxX = lerp(107, 457, easeT);
      const boxY = lerp(135, 120, easeT); // Lift slightly as it slides
      const boxScale = lerp(1, 0.8, easeT);
      
      morphContainer.style.transform = `translate3d(${boxX}px, ${boxY}px, 50px) scale(${boxScale})`;

      if (frame >= 165) {
        morphBox.classList.add('morph-to-cube');
      } else {
        morphBox.classList.remove('morph-to-cube');
      }
      
      // Reset drop transforms
      morphBox.style.transform = 'none';
      deliveryToast.classList.remove('active');
      doorWrapper.classList.remove('door-opened');
    }

    // 2. Drop cardboard box in 3D perspective to Porch Rug (Frames 185 to 205)
    if (frame >= 185) {
      // Keep main container centered above door porch rug
      morphContainer.style.transform = `translate3d(457px, 120px, 50px) scale(0.8)`;
      morphBox.classList.add('morph-to-cube');
      
      if (frame < 208) {
        const t = (frame - 185) / 23;
        // parabolic arc path (fall + physics drop)
        const dropY = lerp(0, 200, t * t); // accelerating gravity
        const rotateX = lerp(0, 35, t);
        const rotateY = lerp(0, 45, t);
        morphBox.style.transform = `translateY(${dropY}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      } else {
        // Box is resting on mat
        morphBox.style.transform = `translateY(200px) rotateX(35deg) rotateY(45deg)`;
      }
    }

    // 3. Arrive, open door, fire confetti (Frames 208 to 240)
    if (frame >= 208) {
      doorWrapper.classList.add('door-opened');
      deliveryToast.classList.add('active');
      
      // Fire confetti burst once
      if (frame === 208 && confettiParticles.length === 0) {
        triggerConfettiBurst();
      }
    }
  }
}

// ── Playback & Loop Ticker ──
function tick(timestamp) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  const elapsedMs = timestamp - lastTimestamp;
  lastTimestamp = timestamp;

  if (isPlaying) {
    // progress frame based on real elapsed time & playback speed
    const frameDelta = (elapsedMs / 1000) * FPS * playSpeed;
    currentFrame += frameDelta;

    if (currentFrame >= TOTAL_FRAMES) {
      currentFrame = 0; // Loop around
      confettiParticles = []; // clear particles
    }

    updateShowcase(currentFrame);
  }

  // Update canvas confetti independently of frames so particles drop smoothly
  if (confettiParticles.length > 0) {
    updateConfetti();
  }

  requestAnimationFrame(tick);
}

// ── Control Listeners ──
btnPlay.addEventListener('click', () => {
  isPlaying = !isPlaying;
  btnPlay.textContent = isPlaying ? 'Pause' : 'Play';
  btnPlay.classList.toggle('btn-primary', isPlaying);
  btnPlay.classList.toggle('btn-secondary', !isPlaying);
});

btnRestart.addEventListener('click', () => {
  currentFrame = 0;
  confettiParticles = [];
  updateShowcase(0);
  if (!isPlaying) {
    isPlaying = true;
    btnPlay.textContent = 'Pause';
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
  
  // Pause on manual scrub so user can inspect
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
  });
});

// Boot loop
updateShowcase(0);
requestAnimationFrame(tick);
