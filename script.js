// Flowfield particle animation — particles move slowly by default,
// but when the cursor is near they speed up and follow the cursor.

class Vector {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  addTo(v) { if (!v) return this; this.x += v.x; this.y += v.y; return this; }
  subFrom(v) { this.x -= v.x; this.y -= v.y; return this; }
  div(s) { return new Vector(this.x / s, this.y / s); }
  mult(s) { this.x *= s; this.y *= s; return this; }
  getLength() { return Math.sqrt(this.x * this.x + this.y * this.y); }
  setLength(len) {
    const l = this.getLength() || 1;
    this.x = (this.x / l) * len;
    this.y = (this.y / l) * len;
    return this;
  }
  setAngle(a) {
    const len = this.getLength() || 1;
    this.x = Math.cos(a) * len;
    this.y = Math.sin(a) * len;
    return this;
  }
  set(x, y) { this.x = x; this.y = y; return this; }
  copy() { return new Vector(this.x, this.y); }
  reset() { this.x = 0; this.y = 0; return this; }
}

// Minimal Perlin-like noise (perlin3 + simplex3 alias)
const noise = (function() {
  const p = new Uint8Array(512);
  const permutation = new Uint8Array(256);
  for (let i = 0; i < 256; i++) permutation[i] = i;
  function seed(seed) {
    let s = seed;
    if (s > 0 && s < 1) s *= 65536;
    s = Math.floor(s) || 1;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807) % 2147483647;
      const r = (s & 0xffff) / 65536;
      const j = Math.floor(r * (i + 1));
      const tmp = permutation[i];
      permutation[i] = permutation[j];
      permutation[j] = tmp;
    }
    for (let i = 0; i < 512; i++) p[i] = permutation[i & 255];
  }
  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a, b, t) { return a + t * (b - a); }
  function grad(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }
  function perlin3(x, y, z) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
    const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
    return lerp(
      lerp(
        lerp(grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z), u),
        lerp(grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z), u), v
      ),
      lerp(
        lerp(grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1), u),
        lerp(grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1), u), v
      ),
      w
    );
  }
  seed(Math.random() * 65536);
  return { seed, perlin3, simplex3: perlin3 };
})();

////////////////////////////////////////////////////////////////////////////////
// Parameters
let canvas, ctx, field, w, h, fieldSize, columns, rows, noiseZ, particles;
noiseZ = 0;

let particleCount = 2000;
let particleSize = 0.9;
fieldSize = 70;
let fieldForce = 0.12; // base field force (keeps particles slow)
let noiseSpeed = 0.003;
let sORp = true;
let trailLength = 0.12;
let hueBase = 10;
let hueRange = 5;
let maxSpeed = 1.6; // base slow max speed
let enableGUI = false;

// Mouse / hover state
const mouse = { x: 0, y: 0, vx: 0, vy: 0, hover: false, down: false };

// Follow/near parameters
const followRadius = 220;            // radius where particles start following
const attractionStrength = 0.9;     // acceleration toward mouse at close distance
const speedBoostMultiplier = 2.8;   // maxSpeed multiplier when very close
const fieldDampingNearMouse = 0.15; // scale of field influence near mouse (reduced so particles follow mouse more)

////////////////////////////////////////////////////////////////////////////////
// UI object (kept small; GUI optional)
const ui = {
  particleCount,
  particleSize,
  fieldSize,
  fieldForce,
  noiseSpeed,
  simplexOrPerlin: sORp,
  trailLength,
  maxSpeed,
  hueBase,
  hueRange,
  change() {
    particleSize = ui.particleSize;
    fieldSize = ui.fieldSize;
    fieldForce = ui.fieldForce;
    noiseSpeed = ui.noiseSpeed;
    maxSpeed = ui.maxSpeed;
    hueBase = ui.hueBase;
    hueRange = ui.hueRange;
    sORp = !!ui.simplexOrPerlin;
    columns = Math.round(w / fieldSize) + 1;
    rows = Math.round(h / fieldSize) + 1;
    initField();
  },
  reset() {
    particleCount = Math.max(1, Math.round(ui.particleCount));
    reset();
  },
  bgColor() {
    trailLength = ui.trailLength;
  }
};

try {
  if (enableGUI && typeof dat !== 'undefined') {
    const gui = new dat.GUI();
    const f1 = gui.addFolder("Color");
    const f2 = gui.addFolder("Particle");
    const f3 = gui.addFolder("Flowfield");
    f1.add(ui, "hueBase", 0, 360).onChange(ui.change.bind(ui));
    f1.add(ui, "hueRange", 0, 40).onChange(ui.change.bind(ui));
    f2.add(ui, "particleCount", 1000, 10000).step(100).onChange(ui.reset.bind(ui));
    f2.add(ui, "particleSize", 0.1, 3).onChange(ui.change.bind(ui));
    f2.add(ui, "trailLength", 0.05, 0.60).onChange(ui.bgColor.bind(ui));
    f2.add(ui, "maxSpeed", 0.5, 6.0).onChange(ui.change.bind(ui));
    f3.add(ui, "fieldSize", 10, 150).step(1).onChange(ui.change.bind(ui));
    f3.add(ui, "fieldForce", 0.01, 1).onChange(ui.change.bind(ui));
    f3.add(ui, "noiseSpeed", 0.0005, 0.01).onChange(ui.change.bind(ui));
    f3.add(ui, "simplexOrPerlin").onChange(ui.change.bind(ui));
  }
} catch (e) { /* ignore if dat.GUI missing */ }

////////////////////////////////////////////////////////////////////////////////
// Particle
class Particle {
  constructor(x, y) {
    this.pos = new Vector(x, y);
    this.vel = new Vector(Math.random() * 0.4 - 0.2, Math.random() * 0.4 - 0.2);
    this.acc = new Vector(0, 0);
    this.hue = Math.random() * 30 - 15;
  }
  move(acc) {
    if (acc) this.acc.addTo(acc);
    this.vel.addTo(this.acc);
    // clamp to some large hard cap to avoid runaway
    const cap = maxSpeed * speedBoostMultiplier * 1.5;
    if (this.vel.getLength() > cap) this.vel.setLength(cap);
    this.pos.addTo(this.vel);
    this.acc.reset();
  }
  wrap() {
    if (this.pos.x > w) this.pos.x = 0;
    else if (this.pos.x < -fieldSize) this.pos.x = w - 1;
    if (this.pos.y > h) this.pos.y = 0;
    else if (this.pos.y < -fieldSize) this.pos.y = h - 1;
  }
}

////////////////////////////////////////////////////////////////////////////////
// Setup canvas & events
function ensureCanvas() {
  canvas = document.querySelector("#canvas");
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'canvas';
    const container = document.getElementById('container') || document.body;
    container.appendChild(canvas);
  }
  ctx = canvas.getContext("2d");
}
ensureCanvas();

canvas.addEventListener('pointermove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  mouse.vx = x - (mouse.x || x);
  mouse.vy = y - (mouse.y || y);
  mouse.x = x; mouse.y = y;
});
canvas.addEventListener('pointerenter', () => { mouse.hover = true; });
canvas.addEventListener('pointerleave', () => { mouse.hover = false; });
canvas.addEventListener('pointerdown', () => { mouse.down = true; });
window.addEventListener('pointerup', () => { mouse.down = false; });

window.addEventListener("resize", reset);

function initParticles() {
  particles = [];
  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle(Math.random() * w, Math.random() * h));
  }
}

function initField() {
  field = new Array(columns);
  for (let x = 0; x < columns; x++) {
    field[x] = new Array(rows);
    for (let y = 0; y < rows; y++) {
      field[x][y] = new Vector(0, 0);
    }
  }
}

function calcField() {
  // fill flow field from noise
  if (sORp) {
    for (let x = 0; x < columns; x++) {
      for (let y = 0; y < rows; y++) {
        const angle = noise.simplex3(x / 20, y / 20, noiseZ) * Math.PI * 2;
        const length = noise.simplex3(x / 40 + 40000, y / 40 + 40000, noiseZ) * fieldForce;
        field[x][y].setLength(Math.abs(length));
        field[x][y].setAngle(angle);
      }
    }
  } else {
    for (let x = 0; x < columns; x++) {
      for (let y = 0; y < rows; y++) {
        const angle = noise.perlin3(x / 20, y / 20, noiseZ) * Math.PI * 2;
        const length = noise.perlin3(x / 40 + 40000, y / 40 + 40000, noiseZ) * fieldForce;
        field[x][y].setLength(Math.abs(length));
        field[x][y].setAngle(angle);
      }
    }
  }
}

function reset() {
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
  noise.seed(Math.random());
  columns = Math.round(w / fieldSize) + 1;
  rows = Math.round(h / fieldSize) + 1;
  initParticles();
  initField();
  // center mouse default
  mouse.x = w / 2; mouse.y = h / 2; mouse.vx = 0; mouse.vy = 0;
}

function draw() {
  requestAnimationFrame(draw);
  calcField();
  // noiseZ baseline + some modulation by horizontal mouse motion
  noiseZ += noiseSpeed + (mouse.vx * 0.00025);
  // decay mouse velocity for subtle swirl
  mouse.vx *= 0.86; mouse.vy *= 0.86;
  drawBackground();
  drawParticles();
}

function drawBackground() {
  ctx.fillStyle = "rgba(0,0,0," + trailLength + ")";
  ctx.fillRect(0, 0, w, h);
}

function drawParticles() {
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];

    // Draw particle
    const ps = Math.abs(p.vel.x + p.vel.y) * particleSize + 0.35;
    const hue = (hueBase + p.hue + ((p.vel.x + p.vel.y) * hueRange));
    ctx.fillStyle = "hsl(" + hue + ", 100%, 50%)";
    ctx.fillRect(p.pos.x, p.pos.y, ps, ps);

    // Base field acceleration
    const pos = p.pos.div(fieldSize);
    let v = null;
    if (pos.x >= 0 && pos.x < columns && pos.y >= 0 && pos.y < rows) {
      v = field[Math.floor(pos.x)][Math.floor(pos.y)];
    }
    // copy field vector and apply base damping so base movement is slow
    const acc = v ? v.copy().mult(0.9) : new Vector(0, 0);

    // Add small swirl from mouse movement (global subtle effect)
    acc.addTo(new Vector(mouse.vx * 0.015, mouse.vy * 0.015));

    // If hovering and within followRadius -> particles accelerate toward mouse and speed up
    if (mouse.hover) {
      const dx = mouse.x - p.pos.x;
      const dy = mouse.y - p.pos.y;
      const distSq = dx * dx + dy * dy;
      const r = followRadius;
      if (distSq < r * r) {
        const dist = Math.sqrt(distSq) || 0.0001;
        const influence = 1 - dist / r; // 1 at close, 0 at boundary
        // attraction vector toward mouse
        const toMouse = new Vector(dx / dist, dy / dist);
        // strength grows with influence, pointerdown can amplify further
        const pressMultiplier = mouse.down ? 1.8 : 1.0;
        const strength = attractionStrength * influence * pressMultiplier;
        toMouse.setLength(strength);
        acc.addTo(toMouse);

        // speed boost: gently increase particle velocity toward mouse
        // compute desired velocity toward mouse and lerp current velocity slightly
        const desired = new Vector(dx / dist, dy / dist).setLength(maxSpeed * (1 + influence * (speedBoostMultiplier - 1)));
        // blend velocity toward desired to keep smooth motion
        p.vel.x = p.vel.x * (0.92) + desired.x * (0.08);
        p.vel.y = p.vel.y * (0.92) + desired.y * (0.08);
      }
    }

    // Ensure base maxSpeed is respected (slow baseline)
    if (p.vel.getLength() > maxSpeed * speedBoostMultiplier) {
      p.vel.setLength(maxSpeed * speedBoostMultiplier);
    }

    p.move(acc);
    // small damping to avoid indefinite acceleration
    p.vel.mult(0.9995);
    p.wrap();
  }
}

// Start
reset();
draw();
