'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// ── Skins ─────────────────────────────────────────────────────────────────────
const SKINS = [
  { id: 'azul', name: 'AZUL', color: '#3b82f6', thrustColor: 'rgba(59,130,246,0.9)' },
  { id: 'rojo', name: 'ROJO', color: '#ff3344', thrustColor: 'rgba(255,51,68,0.9)' },
];
let currentSkin = (() => {
  try { return localStorage.getItem('asteroids_skin') || 'azul'; } catch { return 'azul'; }
})();
function getSkin() { return SKINS.find(s => s.id === currentSkin) || SKINS[0]; }
function updateSkinOverlay() {
  const overlay = document.getElementById('skins-overlay');
  if (!overlay) return;
  overlay.querySelectorAll('[data-skin]').forEach(btn => {
    const isActive = btn.dataset.skin === currentSkin;
    btn.classList.toggle('active', isActive);
    btn.style.borderColor = isActive ? getSkin().color : '#333';
    btn.style.color = isActive ? getSkin().color : '#fff';
  });
  const label = document.getElementById('skin-current-label');
  if (label) { label.textContent = getSkin().name; label.style.color = getSkin().color; }
}
function setSkin(id) {
  if (!SKINS.some(s => s.id === id)) return;
  currentSkin = id;
  try { localStorage.setItem('asteroids_skin', id); } catch {}
  updateSkinOverlay();
}
function cycleSkin() {
  const idx = SKINS.findIndex(s => s.id === currentSkin);
  setSkin(SKINS[(idx + 1) % SKINS.length].id);
}

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── PowerUp ───────────────────────────────────────────────────────────────────
const SPEED_BOOST_DURATION  = 5;    // segundos de efecto velocidad
const TRIPLE_SHOT_DURATION  = 5;    // segundos de efecto triple disparo
const POWERUP_RADIUS        = 13;
const POWERUP_TTL           = 9;    // segundos antes de desaparecer
const POWERUP_SPAWN_CHANCE  = 0.18; // drop-only al destruir asteroide grande

// ── Escudo ────────────────────────────────────────────────────────────────────
const SHIELD_DURATION     = 7;    // segundos de protección
const SHIELD_HITS         = 2;    // impactos que absorbe antes de romperse
const SHIELD_SPAWN_CHANCE = 0.15; // drop-only al destruir asteroide grande (independiente de velocidad/triple)
const SHIELD_RADIUS       = 24;   // radio visual del escudo

// ── Estrella Fugaz ──────────────────────────────────────────────────────────────
const SHOOTING_STAR_RADIUS    = 18;
const SHOOTING_STAR_SPEED     = 560;  // más rápido que cualquier otro elemento (asteroides 32/55/85, nave ~260, balas 520)
const SHOOTING_STAR_TTL       = 5;    // segundos antes de desaparecer
const SHOOTING_STAR_POINTS    = 250;
const SHOOTING_STAR_SPAWN_MIN = 9;    // intervalo mínimo entre apariciones (s)
const SHOOTING_STAR_SPAWN_MAX = 14;   // intervalo máximo entre apariciones (s)

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

class Asteroid {
  constructor(x, y, size = 3) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Estrella Fugaz ────────────────────────────────────────────────────────────
class ShootingStar {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = SHOOTING_STAR_RADIUS;
    this.ttl  = SHOOTING_STAR_TTL;
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SHOOTING_STAR_SPEED + rand(-30, 30);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rot = rand(0, Math.PI * 2);
    this.rotSpeed = rand(-4, 4);
    this.trail = [];
  }

  update(dt) {
    // Guardar estela
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 7) this.trail.shift();

    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    // Parpadeo en el último segundo antes de desaparecer
    if (this.ttl < 1 && Math.floor(this.ttl * 10) % 2 === 0) return;

    // Estela dorada
    for (let i = 0; i < this.trail.length; i++) {
      const p = this.trail[i];
      const alpha = (i / this.trail.length) * 0.35;
      ctx.fillStyle = `rgba(255, 235, 59, ${alpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (i / this.trail.length) * this.radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);

    // Halo exterior
    const pulse = Math.sin(Date.now() * 0.01) * 2;
    ctx.strokeStyle = 'rgba(255, 235, 59, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 6 + pulse, 0, Math.PI * 2);
    ctx.stroke();

    // Estrella de 5 puntas
    ctx.fillStyle = '#ffeb3b';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const outer = this.radius;
    const inner = this.radius * 0.45;
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Brillo central
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12;
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.speedBoost    = 0;
    this.tripleShot    = 0;
    this.shield        = 0; // segundos restantes de escudo
    this.shieldHits    = 0; // impactos restantes
    this.shieldFlash   = 0; // timer para flash de impacto
    this.dead          = false;
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.shieldFlash   > 0) this.shieldFlash   -= dt;
    if (this.speedBoost    > 0) {
      this.speedBoost -= dt;
      if (this.speedBoost < 0) this.speedBoost = 0;
    }
    if (this.tripleShot    > 0) {
      this.tripleShot -= dt;
      if (this.tripleShot < 0) this.tripleShot = 0;
    }
    if (this.shield > 0) {
      this.shield -= dt;
      if (this.shield <= 0) {
        this.shield = 0;
        this.shieldHits = 0;
      }
    }

    const ROT   = 3.5;   // rad/s
    const speedMul = this.speedBoost > 0 ? 2 : 1;
    const THRUST = 260 * speedMul;  // px/s² (doble durante boost - opción B)
    const DRAG   = 0.987;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt * speedMul, W);
    this.y = wrap(this.y + this.vy * dt * speedMul, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (this.tripleShot > 0) {
      // 3 balas paralelas en línea recta, separadas lateralmente
      const perp = this.angle + Math.PI / 2;
      const SPREAD = 10;
      const px = Math.cos(perp) * SPREAD;
      const py = Math.sin(perp) * SPREAD;
      return [
        new Bullet(ox + px, oy + py, this.angle),
        new Bullet(ox, oy, this.angle),
        new Bullet(ox - px, oy - py, this.angle),
      ];
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  draw() {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    const hasTriple = this.tripleShot > 0;
    const hasSpeed  = this.speedBoost > 0;
    if (hasTriple) ctx.strokeStyle = '#ff0';
    else if (hasSpeed) ctx.strokeStyle = '#0ff';
    else ctx.strokeStyle = getSkin().color;
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo( 20,  0);   // nariz
    ctx.lineTo(-12, -9);   // ala izquierda
    ctx.lineTo( -7,  0);   // muesca trasera
    ctx.lineTo(-12,  9);   // ala derecha
    ctx.closePath();
    ctx.stroke();

    // Halo cyan durante boost velocidad
    if (hasSpeed) {
      ctx.save();
      ctx.globalAlpha = 0.18 + Math.sin(Date.now() * 0.008) * 0.08;
      ctx.strokeStyle = '#0ff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // Halo amarillo durante triple shot
    if (hasTriple) {
      ctx.save();
      ctx.globalAlpha = 0.20 + Math.sin(Date.now() * 0.012) * 0.10;
      ctx.strokeStyle = '#ff0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, hasSpeed ? 26 : 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Escudo — anillo hexagonal / circular con pulso
    if (this.shield > 0) {
      const pulse = Math.sin(Date.now() * 0.01) * 2;
      const flicker = this.shield < 2 ? (Math.floor(this.shield * 10) % 2 === 0 ? 0.4 : 1) : 1;
      const flash = this.shieldFlash > 0 ? 0.9 : 0;
      ctx.save();
      ctx.rotate(-this.angle); // escudo no rota con la nave
      ctx.globalAlpha = (0.7 * flicker) + flash * 0.3;
      // Anillo exterior azul-violeta
      ctx.strokeStyle = flash > 0 ? '#fff' : '#5b8cff';
      ctx.lineWidth = flash > 0 ? 2.5 : 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, SHIELD_RADIUS + pulse * 0.4, 0, Math.PI * 2);
      ctx.stroke();
      // Anillo interior
      ctx.globalAlpha = (0.25 * flicker) + flash * 0.2;
      ctx.strokeStyle = '#8ec8ff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, SHIELD_RADIUS - 5, 0, Math.PI * 2);
      ctx.stroke();
      // Hexágono sutil
      ctx.globalAlpha = 0.18 * flicker;
      ctx.strokeStyle = '#5b8cff';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const px = Math.cos(a) * (SHIELD_RADIUS + 1);
        const py = Math.sin(a) * (SHIELD_RADIUS + 1);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      const boosted = hasSpeed;
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(boosted ? 12 : 6, boosted ? 22 : 14), 0);
      ctx.lineTo(-8,  4);
      if (hasTriple) ctx.strokeStyle = 'rgba(255, 235, 59, 0.9)';
      else ctx.strokeStyle = boosted ? 'rgba(0, 255, 255, 0.9)' : getSkin().thrustColor;
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y) {
    this.x  = x;
    this.y  = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── PowerUp (velocidad / escudo / triple) ───────────────────────────────────
class PowerUp {
  constructor(x, y, type = 'speed') {
    this.x = x;
    this.y = y;
    this.type = type; // 'speed' | 'shield' | 'triple'
    this.radius = POWERUP_RADIUS;
    this.ttl  = POWERUP_TTL;
    this.dead = false;
    this.bob  = rand(0, Math.PI * 2);
  }

  update(dt) {
    this.bob += dt * 3;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const pulse = Math.sin(this.bob) * 2;
    const alpha = Math.min(1, this.ttl > 2 ? 1 : this.ttl / 2);
    const isSpeed  = this.type === 'speed';
    const isShield = this.type === 'shield';
    const isTriple = this.type === 'triple';
    const color = isTriple ? '#ff0' : isShield ? '#5b8cff' : '#0ff';
    const innerColor = isShield ? '#8ec8ff' : '#fff';
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalAlpha = alpha;
    // Anillo exterior (color según tipo)
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + pulse * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    // Anillo interno
    ctx.strokeStyle = innerColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius - 4, 0, Math.PI * 2);
    ctx.stroke();

    if (isTriple) {
      // Símbolo triple: 3 balas verticales
      ctx.fillStyle = '#ff0';
      ctx.strokeStyle = '#ff0';
      for (let i = -1; i <= 1; i++) {
        const bx = i * 5;
        // cuerpo bala
        ctx.beginPath();
        ctx.arc(bx, -1, 2, 0, Math.PI * 2);
        ctx.fill();
        // punta
        ctx.beginPath();
        ctx.moveTo(bx - 2, -3);
        ctx.lineTo(bx, -6);
        ctx.lineTo(bx + 2, -3);
        ctx.stroke();
        // cola
        ctx.beginPath();
        ctx.moveTo(bx, 1);
        ctx.lineTo(bx, 5);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    } else if (isShield) {
      // Símbolo escudo
      ctx.strokeStyle = '#5b8cff';
      ctx.fillStyle   = 'rgba(91,140,255,0.22)';
      ctx.lineWidth   = 1.6;
      ctx.lineJoin    = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(6, -4);
      ctx.lineTo(6, 2);
      ctx.bezierCurveTo(6, 5, 3, 7, 0, 8);
      ctx.bezierCurveTo(-3, 7, -6, 5, -6, 2);
      ctx.lineTo(-6, -4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Brillo central
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, 1.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Símbolo >> (velocidad)
      ctx.strokeStyle = '#0ff';
      ctx.lineWidth = 1.8;
      ctx.lineJoin  = 'round';
      ctx.lineCap   = 'round';
      ctx.beginPath();
      ctx.moveTo(-6, -5);
      ctx.lineTo(-1, 0);
      ctx.lineTo(-6, 5);
      ctx.moveTo(1, -5);
      ctx.lineTo(6, 0);
      ctx.lineTo(1, 5);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles, powerUps, shootingStars;
let score, lives, level;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;
let shootingStarTimer; // cuenta atrás para siguiente aparición
let shootingStarNextInterval; // intervalo aleatorio actual

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
}

function resetShootingStarTimer() {
  shootingStarNextInterval = rand(SHOOTING_STAR_SPAWN_MIN, SHOOTING_STAR_SPAWN_MAX);
  shootingStarTimer = shootingStarNextInterval;
}

function spawnShootingStar() {
  const SAFE_DIST = 130;
  let x, y;
  // Spawn aleatorio evitando el centro; si falla usa borde
  let tries = 0;
  do {
    // 50% en borde para efecto de cruce rápido
    if (Math.random() < 0.5) {
      const edge = randInt(0, 3);
      if (edge === 0) { x = 0; y = rand(0, H); }
      else if (edge === 1) { x = W; y = rand(0, H); }
      else if (edge === 2) { x = rand(0, W); y = 0; }
      else { x = rand(0, W); y = H; }
      break;
    }
    x = rand(0, W);
    y = rand(0, H);
    tries++;
  } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST && tries < 20);
  shootingStars.push(new ShootingStar(x, y));
  resetShootingStarTimer();
}

function initGame() {
  ship          = new Ship();
  bullets   = [];
  asteroids = [];
  particles = [];
  powerUps  = [];
  shootingStars = [];
  score  = 0;
  lives  = 3;
  level  = 1;
  state  = 'playing';
  spawnAsteroids(4);
  resetShootingStarTimer();
  updateSkinOverlay();
}

function nextLevel() {
  level++;
  bullets   = [];
  particles = [];
  powerUps  = [];
  // La estrella fugaz persiste entre niveles (no se limpia) para mantener su ciclo de 5s
  ship.reset();
  spawnAsteroids(3 + level);
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  // Cambio de skin con tecla C — disponible en cualquier estado
  if (pressed('KeyC')) cycleSkin();

  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    asteroids.forEach(a => a.update(dt));
    powerUps.forEach(p => p.update(dt));
    powerUps = powerUps.filter(p => !p.dead);
    shootingStars.forEach(s => s.update(dt));
    shootingStars = shootingStars.filter(s => !s.dead);
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }

  // Ciclo de aparición de estrella fugaz
  shootingStarTimer -= dt;
  if (shootingStarTimer <= 0) spawnShootingStar();

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(dt));
  particles.forEach(p => p.update(dt));
  powerUps.forEach(p => p.update(dt));
  shootingStars.forEach(s => s.update(dt));

  bullets   = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);
  powerUps  = powerUps.filter(p => !p.dead);
  shootingStars = shootingStars.filter(s => !s.dead);

  // Bala vs asteroide
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        score += POINTS[a.size];
        explode(a.x, a.y, a.size * 5);
        newAsteroids.push(...a.split());
        // Combinado: 18% (50/50 speed/triple) + 15% shield independientes al destruir asteroide grande
        if (a.size === 3) {
          if (Math.random() < POWERUP_SPAWN_CHANCE) {
            const kind = Math.random() < 0.5 ? 'speed' : 'triple';
            powerUps.push(new PowerUp(a.x, a.y, kind));
          }
          if (Math.random() < SHIELD_SPAWN_CHANCE) {
            const ox = powerUps.length && powerUps[powerUps.length - 1].x === a.x ? a.x + rand(-12, 12) : a.x;
            const oy = powerUps.length && powerUps[powerUps.length - 1].y === a.y ? a.y + rand(-12, 12) : a.y;
            powerUps.push(new PowerUp(ox, oy, 'shield'));
          }
        }
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets   = bullets.filter(b => !b.dead);

  // Bala vs estrella fugaz (250 pts, desaparece al impactar)
  for (const b of bullets) {
    for (const s of shootingStars) {
      if (!s.dead && !b.dead && dist(b, s) < s.radius) {
        b.dead = true;
        s.dead = true;
        score += SHOOTING_STAR_POINTS;
        explode(s.x, s.y, 10);
      }
    }
  }
  shootingStars = shootingStars.filter(s => !s.dead);
  bullets       = bullets.filter(b => !b.dead);

  // Nave vs powerUp (recolecta antes de chequear muerte)
  if (!ship.dead) {
    for (const p of powerUps) {
      if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
        p.dead = true;
        if (p.type === 'shield') {
          ship.shield = SHIELD_DURATION;
          ship.shieldHits = SHIELD_HITS;
          ship.shieldFlash = 0.15;
          explode(p.x, p.y, 8);
        } else if (p.type === 'triple') {
          ship.tripleShot = TRIPLE_SHOT_DURATION;
          explode(p.x, p.y, 6);
        } else {
          ship.speedBoost = SPEED_BOOST_DURATION;
          explode(p.x, p.y, 6);
        }
      }
    }
    powerUps = powerUps.filter(p => !p.dead);
  }

  // Nave vs asteroide (con escudo)
  if (ship.invincible <= 0) {
    const shieldedAsteroids = [];
    let wasBlocked = false;
    for (const a of asteroids) {
      if (dist(ship, a) < ship.radius + a.radius * 0.82) {
        if (ship.shield > 0) {
          // Bloqueo con escudo: consume 1 carga, destruye asteroide y da puntos
          a.dead = true;
          wasBlocked = true;
          ship.shieldHits--;
          ship.shieldFlash = 0.22;
          score += POINTS[a.size];
          explode(a.x, a.y, a.size * 5);
          explode(ship.x, ship.y, 4);
          shieldedAsteroids.push(...a.split());
          if (ship.shieldHits <= 0) ship.shield = 0;
        } else {
          killShip();
          break;
        }
      }
    }
    if (wasBlocked) {
      asteroids = asteroids.filter(a => !a.dead).concat(shieldedAsteroids);
    }

    // Nave vs estrella fugaz (también letal, escudo la bloquea)
    if (state === 'playing') {
      for (const s of shootingStars) {
        if (dist(ship, s) < ship.radius + s.radius * 0.85) {
          if (ship.shield > 0) {
            explode(s.x, s.y, 10);
            explode(ship.x, ship.y, 4);
            s.dead = true;
            score += SHOOTING_STAR_POINTS;
            ship.shieldHits--;
            ship.shieldFlash = 0.22;
            if (ship.shieldHits <= 0) ship.shield = 0;
          } else {
            explode(s.x, s.y, 10);
            s.dead = true;
            killShip();
            break;
          }
        }
      }
      shootingStars = shootingStars.filter(s => !s.dead);
    }
  }

  // Nivel completado
  if (asteroids.length === 0) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = getSkin().color;
  ctx.lineWidth   = 1.2;
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo( 9,  0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-3,  0);
  ctx.lineTo(-6,  5);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

  // Indicadores stacked (escudo + velocidad + triple)
  if (ship) {
    let hudY = 48;
    // Escudo
    if (ship.shield > 0) {
      const remaining = Math.ceil(ship.shield);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#5b8cff';
      ctx.font = '13px monospace';
      const hitsStr = ship.shieldHits > 0 ? ` x${ship.shieldHits}` : '';
      ctx.fillText(`ESCUDO${hitsStr}  ${remaining}s`, 14, hudY);
      const barW = 100;
      const prog = ship.shield / SHIELD_DURATION;
      ctx.fillStyle = 'rgba(91,140,255,0.25)';
      ctx.fillRect(14, hudY + 6, barW, 4);
      ctx.fillStyle = '#5b8cff';
      ctx.fillRect(14, hudY + 6, barW * prog, 4);
      hudY += 22;
    }
    // Velocidad
    if (ship.speedBoost > 0) {
      const remaining = Math.ceil(ship.speedBoost);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#0ff';
      ctx.font = '13px monospace';
      ctx.fillText(`VELOCIDAD x2  ${remaining}s`, 14, hudY);
      const barW = 100;
      const prog = ship.speedBoost / SPEED_BOOST_DURATION;
      ctx.fillStyle = 'rgba(0,255,255,0.25)';
      ctx.fillRect(14, hudY + 6, barW, 4);
      ctx.fillStyle = '#0ff';
      ctx.fillRect(14, hudY + 6, barW * prog, 4);
      hudY += 22;
    }
    // Triple shot
    if (ship.tripleShot > 0) {
      const remaining = Math.ceil(ship.tripleShot);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ff0';
      ctx.font = '13px monospace';
      ctx.fillText(`TRIPLE x3  ${remaining}s`, 14, hudY);
      const barW = 100;
      const prog = ship.tripleShot / TRIPLE_SHOT_DURATION;
      ctx.fillStyle = 'rgba(255,255,0,0.25)';
      ctx.fillRect(14, hudY + 6, barW, 4);
      ctx.fillStyle = '#ff0';
      ctx.fillRect(14, hudY + 6, barW * prog, 4);
    }
  }
}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  powerUps.forEach(p => p.draw());
  shootingStars.forEach(s => s.draw());
  bullets.forEach(b => b.draw());
  ship.draw();

  drawHUD();

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
// Sincronizar overlay tras carga inicial (por si el DOM se renderizó después)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', updateSkinOverlay);
} else {
  updateSkinOverlay();
}
requestAnimationFrame(loop);
