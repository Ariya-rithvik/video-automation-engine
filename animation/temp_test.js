const fs = require('fs');
const path = require('path');

console.log("Starting script validation in mocked DOM environment...\n");

// Mock standard browser objects
global.window = {
  addEventListener: () => {},
  location: { search: '' }
};

global.URLSearchParams = class {
  constructor() { return { get: () => null }; }
};

const mockElement = () => ({
  style: {},
  classList: {
    toggle: () => {},
    add: () => {},
    remove: () => {},
    contains: () => false
  },
  getContext: () => ({
    clearRect: () => {},
    beginPath: () => {},
    stroke: () => {},
    fill: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    arc: () => {},
    rect: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    lineTo: () => {},
    moveTo: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    roundRect: () => {},
    ellipse: () => {},
    fillText: () => {},
    closePath: () => {},
    clip: () => {},
    quadraticCurveTo: () => {},
    bezierCurveTo: () => {}
  }),
  setAttribute: () => {},
  getAttribute: () => '100',
  querySelector: () => mockElement(),
  querySelectorAll: () => [mockElement(), mockElement()],
  appendChild: () => {},
  addEventListener: () => {},
  dataset: { frame: '0', speed: '1' }
});

global.document = {
  getElementById: (id) => {
    // console.log(`  Mocking getElementById: ${id}`);
    return mockElement();
  },
  querySelector: (selector) => {
    // console.log(`  Mocking querySelector: ${selector}`);
    return mockElement();
  },
  querySelectorAll: (selector) => {
    // console.log(`  Mocking querySelectorAll: ${selector}`);
    return [mockElement(), mockElement()];
  },
  createElement: (tag) => {
    // console.log(`  Mocking createElement: ${tag}`);
    return mockElement();
  },
  addEventListener: () => {}
};

global.requestAnimationFrame = () => {};

const files = [
  'apple-script.js',
  'spacex-script.js',
  'spotify-script.js',
  'netflix-script.js',
  'tesla-script.js',
  'uber-script.js',
  'uber2-script.js',
  'weather-widget-script.js',
  'football-script.js'
];

let hasErrors = false;

files.forEach(file => {
  const filePath = path.join('d:', 'production_product', 'animation', file);
  console.log(`Checking ${file}...`);
  try {
    const code = fs.readFileSync(filePath, 'utf8');
    
    // Append test code to run updateShowcase across all timeline frames
    const testSnippet = `
      try {
        console.log("    [Test] Calling updateShowcase at multiple keyframes...");
        const keyframes = Array.from({length: 1951}, (_, i) => i);
        for (const f of keyframes) {
          updateShowcase(f);
        }
        console.log("    [Test] Keyframe execution passed!");
      } catch (e) {
        throw new Error("Failed during timeline updateShowcase: " + e.message + "\\n" + e.stack);
      }
    `;
    const codeWithTest = code + "\n" + testSnippet;
    
    const fn = new Function(codeWithTest);
    fn();
    console.log(`  => ${file} loaded and scrubbed successfully through all phases!\n`);
  } catch (err) {
    console.error(`  => ERROR in ${file}:`, err.message);
    console.error(err.stack);
    hasErrors = true;
  }
});

if (hasErrors) {
  process.exit(1);
} else {
  console.log("All scripts loaded, executed, and scrubbed through all phases successfully in mock browser environment!");
}
