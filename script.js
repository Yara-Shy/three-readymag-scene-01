// Flowfield particle animation (замінено оригінальний Three.js код на 2D canvas flowfield)
// Вимога: в HTML має бути <canvas id="canvas"></canvas>
// Опційно: підключити dat.GUI, якщо хочеш редагувати параметри в UI.

////////////////////////////////////////////////////////////////////////////////
// Малий Vector клас
class Vector {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  addTo(v) {
    this.x += v.x;
    this.y += v.y;
    return this;
  }
  sub(v) {
    return new Vector(this.x - v.x, this.y - v.y);
  }
  div(s) {
    return new Vector(this.x / s, this.y / s);
  }
  mult(s) {
    this.x *= s; this.y *= s; return this;
  }
  getLength() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
  setLength(len) {
    const ang = Math.atan2(this.y, this.x);
    this.x = Math.cos(ang) * len;
    this.y = Math.sin(ang) * len;
    return this;
  }
  setAngle(a) {
    const len = this.getLength();
    this.x = Math.cos(a) * len;
    this.y = Math.sin(a) * len;
    return this;
  }
  set(x, y) {
    this.x = x; this.y = y; return this;
  }
  copy() {
    return new Vector(this.x, this.y);
  }
}

////////////////////////////////////////////////////////////////////////////////
// noisejs (Joseph Gentle) compact implementation (perlin + simplex 3D functions)
// Source adapted (public) -> provides noise.seed, noise.perlin3, noise.simplex3
const noise = (function() {
  // Permutation table
  const p = new Uint8Array(512);
  const permutation = new Uint8Array(256);
  for (let i = 0; i < 256; i++) permutation[i] = i;
  // Fisher-Yates shuffle
  function seed(seed) {
    let s = seed;
    if (s > 0 && s < 1) s *= 65536;
    s = Math.floor(s);
    if (s < 256) s |= s << 8;
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

  // Classic Perlin 3D
  function fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  function lerp(a, b, t) {
    return (1 - t) * a + t * b;
  }
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
        lerp(grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z), u),
        v
      ),
      lerp(
        lerp(grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1), u),
        lerp(grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1), u),
        v
      ),
      w
    );
  }

  // Simplex noise 3D (fast approximation)
  // Implementation adapted from public-domain simplex noise variations
  const F3 = 1 / 3;
  const G3 = 1 / 6;
  function simplex3(xin, yin, zin) {
    let n0, n1, n2, n3;
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const X0 = i - t;
    const Y0 = j - t;
    const Z0 = k - t;
    let x0 = xin - X0;
    let y0 = yin - Y0;
    let z0 = zin - Z0;

    let i1, j1, k1;
    let i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }

    const x1 = x0 - i1 + G3;
    const y1 = y0 - j1 + G3;
    const z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3;
    const y2 = y0 - j2 + 2 * G3;
    const z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3;
    const y3 = y0 - 1 + 3 * G3;
    const z3 = z0 - 1 + 3 * G3;

    const ii = i & 255;
    const jj = j & 255;
    const kk = k & 255;

    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 < 0) n0 = 0;
    else {
      t0 *= t0;
      n0 = t0 * t0 * grad(p[ii + p[jj + p[kk]]], x0, y0, z0);
    }
    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 < 0) n1 = 0;
    else {
      t1 *= t1;
      n1 = t1 * t1 * grad(p[ii + i1 + p[jj + j1 + p[kk + k1]]], x1, y1, z1);
    }
    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 < 0) n2 = 0;
    else {
      t2 *= t2;
      n2 = t2 * t2 * grad(p[ii + i2 + p[jj + j2 + p[kk + k2]]], x2, y2, z2);
    }
    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 < 0) n3 = 0;
    else {
      t3 *= t3;
      n3 = t3 * t3 * grad(p[ii + 1 + p[jj + 1 + p[kk + 1]]], x3, y3, z3);
    }
    // scale to roughly [-1,1]
    return 32 * (n0 + n1 + n2 + n3);
  }

  // default seed
  seed(Math.random() * 65536);
  return { seed, perlin3, simplex3 };
})();

////////////////////////////////////////////////////////////////////////////////
// Основні параметри (твої значення, адаптовано під ES6)
let canvas, ctx, field, w, h, fieldSize, columns, rows, noiseZ, particles, hue;
noiseZ = 0;

let particleCount = 2000;
let particleSize = 0.9;
fieldSize = 70;
let fieldForce = 0.15;
let noiseSpeed = 0.003;
let sORp = true;
let trailLength = 0.15;
let hueBase = 10;
let hueRange = 5;
let maxSpeed = 2.5;
let enableGUI = true;

let ui = {
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
    ui.simplexOrPerlin ? sORp = true : sORp = false;
    reset(); // перерахувати field
  },
  reset() {
    particleCount = Math.round(ui.particleCount);
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
    f2.add(ui, "maxSpeed", 1.0, 4.0).onChange(ui.change.bind(ui));
    f3.add(ui, "fieldSize", 10, 150).step(1).onChange(ui.change.bind(ui));
    f3.add(ui, "fieldForce", 0.05, 1).onChange(ui.change.bind(ui));
    f3.add(ui, "noiseSpeed", 0.001, 0.005).onChange(ui.change.bind(ui));
    f3.add(ui, "simplexOrPerlin").onChange(ui.change.bind(ui));
  }
} catch (e) {
  // Якщо dat.GUI не підключений — просто ігноруємо GUI
  // console.log('dat.GUI не знайдено, GUI пропущено');
}

class Particle {
  constructor(x, y) {
    this.pos = new Vector(x, y);
    this.vel = new Vector(Math.random() - 0.5, Math.random() - 0.5);
    this.acc = new Vector(0, 0);
    this.hue = Math.random() * 30 - 15;
  }
  move(acc) {
    if (acc) {
      this.acc.addTo(acc);
    }
    this.vel.addTo(this.acc);
    this.pos.addTo(this.vel);
    if (this.vel.getLength() > maxSpeed) {
      this.vel.setLength(maxSpeed);
    }
    this.acc.setLength(0);
  }
  wrap() {
    if (this.pos.x > w) {
      this.pos.x = 0;
    } else if (this.pos.x < -fieldSize) {
      this.pos.x = w - 1;
    }
    if (this.pos.y > h) {
      this.pos.y = 0;
    } else if (this.pos.y < -fieldSize) {
      this.pos.y = h - 1;
    }
  }
}

canvas = document.querySelector("#canvas");
if (!canvas) {
  // якщо canvas немає — створимо і додамо в body
  canvas = document.createElement('canvas');
  canvas.id = 'canvas';
  document.body.appendChild(canvas);
}
ctx = canvas.getContext("2d");

window.addEventListener("resize", reset);

function initParticles() {
  particles = [];
  let numberOfParticles = particleCount;
  for (let i = 0; i < numberOfParticles; i++) {
    let particle = new Particle(Math.random() * w, Math.random() * h);
    particles.push(particle);
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
  if (sORp) {
    for (let x = 0; x < columns; x++) {
      for (let y = 0; y < rows; y++) {
        const angle = noise.simplex3(x / 20, y / 20, noiseZ) * Math.PI * 2;
        const length = noise.simplex3(x / 40 + 40000, y / 40 + 40000, noiseZ) * fieldForce;
        field[x][y].setLength(Math.abs(length)); // length може бути від'ємним — робимо абсолютне
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
}

function draw() {
  requestAnimationFrame(draw);
  calcField();
  noiseZ += noiseSpeed;
  drawBackground();
  drawParticles();
}

function drawBackground() {
  // Прозорий чорний фон для сліду
  ctx.fillStyle = "rgba(0,0,0," + trailLength + ")";
  ctx.fillRect(0, 0, w, h);
}

function drawParticles() {
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const ps = Math.abs(p.vel.x + p.vel.y) * particleSize + 0.3;
    const hue = (hueBase + p.hue + ((p.vel.x + p.vel.y) * hueRange));
    ctx.fillStyle = "hsl(" + hue + ", 100%, 50%)";
    ctx.fillRect(p.pos.x, p.pos.y, ps, ps);

    let pos = p.pos.div(fieldSize);
    let v;
    if (pos.x >= 0 && pos.x < columns && pos.y >= 0 && pos.y < rows) {
      v = field[Math.floor(pos.x)][Math.floor(pos.y)];
    }
    p.move(v);
    p.wrap();
  }
}

// Запуск
reset();
draw();
