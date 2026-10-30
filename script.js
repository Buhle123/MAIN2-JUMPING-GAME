"use strict";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreElement = document.getElementById("score");
const bestElement = document.getElementById("best");
const gameMessage = document.getElementById("gameMessage");
const messageTitle = gameMessage.querySelector("h2");
const messageText = gameMessage.querySelector("p");
const restartButton = document.getElementById("restartButton");
const muteButton = document.getElementById("muteButton");
const dino = document.getElementById("dino");

// ---------- Canvas setup (sharp on high-DPI screens) ----------
const WIDTH = 800;
const HEIGHT = 300;
const groundY = 250;

function setupCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = WIDTH * dpr;
  canvas.height = HEIGHT * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
setupCanvas();

// ---------- Settings ----------
const STAND_H = 40;
const DUCK_H = 24;
const MAX_SPEED = 11;
// Physics values use pixels and nominal 60 Hz frames.
const FRAME_MS = 1000 / 60;
const PHYSICS_STEP = 0.5;
const MAX_FRAME_DELTA = 3;

const player = {
  x: 60,
  y: groundY - STAND_H,
  width: 35,
  height: STAND_H,
  velocityY: 0,
  gravity: 0.7,
  jumpPower: -13,
  grounded: true,
  ducking: false
};

let obstacles = [];
let clouds = [];
let score = 0;
let best = loadBest();
let speed = 5;
let distance = 0;        // pixels travelled since last obstacle
let nextGap = 400;       // pixels until the next obstacle
let state = "ready"; // ready, playing, paused, gameover
let lastTime = 0;
let accumulator = 0;
let animationId = null;
let canRestartAt = 0;    // stops accidental instant restarts
let muted = false;
let audioCtx = null;
let scrollX = 0;         // ground scroll position
let particles = [];
let scale = 1;           // displayed canvas width / 800, keeps the CSS dino aligned
let jumpInput = null;    // key code or pointer ID that initiated this jump

bestElement.textContent = best;

// ---------- Storage (wrapped: can fail in private mode) ----------
function loadBest() {
  try {
    const value = Number(localStorage.getItem("dinoBest"));
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  }
  catch { return 0; }
}
function saveBest() {
  try { localStorage.setItem("dinoBest", best); } catch { /* ignore */ }
}

// ---------- Sound (generated, no audio files needed) ----------
function beep(freq, duration, type = "square", volume = 0.06, slideTo = null) {
  if (muted) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const t = audioCtx.currentTime;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + duration);
  } catch { /* audio not available */ }
}

// ---------- Drawing ----------
// The dino is a CSS-styled <div>; JS only moves it and toggles state classes
function updateScale() {
  scale = (canvas.clientWidth - 2 * canvas.clientLeft) / WIDTH;
  canvas.parentElement.style.setProperty("--u", scale);
  renderDino();
}

function renderDino() {
  dino.classList.toggle("ducking", player.ducking && player.grounded);
  dino.classList.toggle("running", state === "playing" && player.grounded);
  dino.style.transform = `translate(${player.x * scale}px, ${player.y * scale}px)`;
}

// ---------- Theme: day -> sunset -> night as the score grows ----------
const PALETTES = [
  { top: [140, 208, 255], bot: [236, 248, 255], cloud: [255, 255, 255], ground: [120, 200, 100], dirt: [214, 176, 124], orb: [255, 211, 90] },
  { top: [255, 140, 130], bot: [255, 224, 160], cloud: [255, 238, 228], ground: [150, 170, 90],  dirt: [186, 128, 96],  orb: [255, 128, 70] },
  { top: [26, 36, 82],    bot: [86, 100, 164],  cloud: [112, 126, 184], ground: [66, 120, 112],  dirt: [66, 72, 108],   orb: [244, 241, 222] }
];
const STARS = Array.from({ length: 30 }, () => ({ x: Math.random() * WIDTH, y: Math.random() * 160 }));
let themeT = 0;
let theme = {};

const mix = (a, b, f) => a.map((v, i) => v + (b[i] - v) * f);
const rgb = c => `rgb(${c.map(Math.round).join(",")})`;

function computeTheme() {
  const i = Math.floor(themeT) % 3, j = (i + 1) % 3, f = themeT % 1;
  for (const k of Object.keys(PALETTES[0])) theme[k] = rgb(mix(PALETTES[i][k], PALETTES[j][k], f));
  theme.night = i === 2 ? 1 - f : j === 2 ? f : 0;
}

function updateTheme(dt) {
  themeT += (score / 10 - themeT) * Math.min(0.02 * dt, 1);   // eases between stages
  computeTheme();
}

// ---------- Drawing ----------
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function circle(x, y, r) {
  ctx.moveTo(x + r, y);
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

function drawSky(time) {
  const g = ctx.createLinearGradient(0, 0, 0, groundY);
  g.addColorStop(0, theme.top);
  g.addColorStop(1, theme.bot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  if (theme.night > 0.05) {
    ctx.fillStyle = "#fff";
    STARS.forEach((s, i) => {
      ctx.globalAlpha = theme.night * (0.5 + 0.5 * Math.sin(time / 400 + i));
      ctx.fillRect(s.x, s.y, 2, 2);
    });
    ctx.globalAlpha = 1;
  }

  // Sun / moon with a soft glow
  ctx.fillStyle = theme.orb;
  ctx.globalAlpha = 0.25;
  ctx.beginPath(); circle(690, 65, 38); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath(); circle(690, 65, 26); ctx.fill();
}

function drawClouds() {
  ctx.fillStyle = theme.cloud;
  ctx.globalAlpha = 0.92;
  clouds.forEach(c => {
    ctx.beginPath();
    circle(c.x + 12, c.y, 12);
    circle(c.x + 30, c.y - 7, 16);
    circle(c.x + 50, c.y, 12);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawGround(offset) {
  ctx.fillStyle = theme.dirt;
  ctx.fillRect(0, groundY, WIDTH, HEIGHT - groundY);
  ctx.fillStyle = theme.ground;
  ctx.fillRect(0, groundY, WIDTH, 9);

  // Scrolling grass tufts and pebbles
  for (let i = 0; i < 20; i++) {
    const x = ((i * 43 - offset) % WIDTH + WIDTH) % WIDTH;
    ctx.fillStyle = theme.ground;
    ctx.fillRect(x, groundY - 5, 3, 5);
    ctx.fillRect(x + 5, groundY - 8, 3, 8);
  }
  ctx.fillStyle = "rgba(0, 0, 0, 0.13)";
  for (let i = 0; i < 14; i++) {
    const x = ((i * 71 - offset) % WIDTH + WIDTH) % WIDTH;
    roundRect(x, groundY + 16 + (i % 3) * 10, 8 + (i % 2) * 6, 4, 2);
  }
}

function drawObstacles() {
  obstacles.forEach(o => {
    const r = o.width / 2;
    ctx.fillStyle = "#2f9e55";
    roundRect(o.x, o.y, o.width, o.height, r);                 // trunk
    roundRect(o.x - 8, o.y + 13, 8, 5, 2.5);                   // left arm
    roundRect(o.x - 8, o.y + 7, 5, 11, 2.5);
    roundRect(o.x + o.width, o.y + 21, 8, 5, 2.5);             // right arm
    roundRect(o.x + o.width + 3, o.y + 15, 5, 11, 2.5);
    ctx.fillStyle = "rgba(255, 255, 255, 0.28)";               // highlight
    roundRect(o.x + 3, o.y + 6, 3, o.height - 12, 1.5);
    if (o.flower) {
      ctx.fillStyle = "#ff8fa3";
      ctx.beginPath(); circle(o.x + r, o.y + 1, 4.5); ctx.fill();
      ctx.fillStyle = "#ffe066";
      ctx.beginPath(); circle(o.x + r, o.y + 1, 1.8); ctx.fill();
    }
  });
}

// Dust puffs when jumping and landing
function puff(x, y, n) {
  for (let i = 0; i < n; i++) {
    particles.push({ x, y, vx: (Math.random() - 0.7) * 2.5 - speed * 0.15, vy: -Math.random() * 1.3, r: 2 + Math.random() * 3, life: 1 });
  }
}

function updateParticles(dt) {
  particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= 0.045 * dt; });
  particles = particles.filter(p => p.life > 0);
}

function drawParticles() {
  particles.forEach(p => {
    ctx.fillStyle = `rgba(255, 255, 255, ${p.life * 0.75})`;
    ctx.beginPath(); circle(p.x, p.y, p.r * p.life + 1); ctx.fill();
  });
}

function drawGame(time) {
  drawSky(time);
  drawClouds();
  drawGround(scrollX);
  drawObstacles();
  drawParticles();
  renderDino();
}

// ---------- Updating ----------
function updatePlayer(dt) {
  const wasGrounded = player.grounded;
  player.height = player.ducking && player.grounded ? DUCK_H : STAND_H;
  if (player.grounded) {
    player.y = groundY - player.height;
    player.velocityY = 0;
    return;
  }
  const gravity = player.ducking ? player.gravity * 2 : player.gravity;
  player.velocityY += gravity * dt;
  player.y += player.velocityY * dt;
  if (player.y + player.height >= groundY) {
    player.height = player.ducking ? DUCK_H : STAND_H;
    player.y = groundY - player.height;
    player.velocityY = 0;
    player.grounded = true;
    if (!wasGrounded) puff(player.x + 14, groundY, 5);
  }
}

function updateClouds(dt) {
  clouds.forEach(c => {
    c.x -= speed * 0.2 * dt;
    if (c.x < -60) {
      c.x = WIDTH + Math.random() * 100;
      c.y = 30 + Math.random() * 90;
    }
  });
}

function jump(source = null) {
  if (state === "paused") return;
  if (state !== "playing") {
    if (performance.now() >= canRestartAt) startGame();
    return;
  }
  if (player.grounded) {
    jumpInput = source;
    player.height = STAND_H;
    player.y = groundY - STAND_H;
    player.velocityY = player.jumpPower;
    player.grounded = false;
    beep(520, 0.12, "square", 0.05, 820);
    puff(player.x + 14, groundY, 4);
  }
}

// Letting go of jump early cuts the jump short (variable height)
function releaseJump() {
  if (state === "playing" && player.velocityY < -5) player.velocityY = -5;
}

function releaseJumpInput(source) {
  if (source !== jumpInput) return;
  jumpInput = null;
  releaseJump();
}

function bump() {
  const badge = scoreElement.parentElement;
  badge.classList.remove("bump");
  void badge.offsetWidth;          // restart the CSS animation
  badge.classList.add("bump");
}

function createObstacle() {
  const height = 25 + Math.random() * 25;
  obstacles.push({
    type: "cactus",
    flower: Math.random() < 0.5,
    x: WIDTH + 8,
    y: groundY - height,
    width: 15 + Math.random() * 10,
    height,
    passed: false
  });
}

function updateObstacles(dt) {
  const move = speed * dt;
  distance += move;
  scrollX = (scrollX + move) % WIDTH;

  // Obstacles spawn by distance, so spacing stays fair as speed rises
  if (distance >= nextGap) {
    createObstacle();
    distance = 0;
    nextGap = speed * (65 + Math.random() * 25);
  }

  obstacles.forEach(o => {
    o.x -= move;

    if (!o.passed && o.x + o.width < player.x) {
      o.passed = true;
      score++;
      scoreElement.textContent = score;
      bump();

      if (score % 5 === 0) {
        speed = Math.min(speed + 0.5, MAX_SPEED);
        beep(880, 0.15, "triangle", 0.06);
      }
    }
  });

  obstacles = obstacles.filter(o => o.x + o.width > -20);
}

// ---------- Collision (slightly forgiving hitboxes) ----------
function checkCollision(a, b) {
  const m = 4;
  return (
    a.x + m < b.x + b.width &&
    a.x + a.width - m > b.x &&
    a.y + m < b.y + b.height &&
    a.y + a.height - m > b.y
  );
}

function detectCollision() {
  const body = player.ducking && player.grounded
    ? { ...player, width: player.width + 14 }
    : player;

  return obstacles.some(o => checkCollision(body, o));
}

// ---------- Fixed-step game loop (long frame delays are clamped) ----------
function gameLoop(now) {
  animationId = null;
  if (state !== "playing" && state !== "paused") return;
  const elapsed = Math.max(0, Math.min((now - lastTime) / FRAME_MS, MAX_FRAME_DELTA));
  lastTime = now;
  if (state === "playing") {
    // Fixed 120 Hz physics: consistent jump paths and no collision tunnelling.
    accumulator += elapsed;
    while (accumulator >= PHYSICS_STEP && state === "playing") {
      updatePlayer(PHYSICS_STEP);
      updateObstacles(PHYSICS_STEP);
      updateClouds(PHYSICS_STEP);
      updateParticles(PHYSICS_STEP);
      updateTheme(PHYSICS_STEP);
      accumulator -= PHYSICS_STEP;
      if (detectCollision()) endGame();
    }
    if (state === "playing") drawGame(now);
  }
  if (state === "playing" || state === "paused") {
    animationId = requestAnimationFrame(gameLoop);
  }
}

function startGame() {
  cancelAnimationFrame(animationId);

  player.height = STAND_H;
  player.y = groundY - STAND_H;
  player.velocityY = 0;
  player.grounded = true;
  player.ducking = false;
  jumpInput = null;

  obstacles = [];
  clouds = [
    { x: 120, y: 50 }, { x: 380, y: 90 },
    { x: 620, y: 40 }, { x: 790, y: 75 }
  ];
  score = 0;
  speed = 5;
  distance = 0;
  nextGap = 400;
  scrollX = 0;
  particles = [];
  themeT = 0;
  computeTheme();
  state = "playing";
  accumulator = 0;
  canRestartAt = 0;
  setStatus("Playing. Hold Space or Arrow Up to jump higher.");

  scoreElement.textContent = score;
  gameMessage.classList.add("hidden");
  restartButton.blur();   // stops Space from "clicking" the button again

  lastTime = performance.now();
  animationId = requestAnimationFrame(gameLoop);
}

function endGame() {
  if (state !== "playing") return;
  state = "gameover";
  canRestartAt = performance.now() + 500;

  const isNewBest = score > best;
  if (isNewBest) {
    best = score;
    bestElement.textContent = best;
    saveBest();
  }

  beep(300, 0.35, "sawtooth", 0.07, 80);
  drawGame(performance.now());

  messageTitle.textContent = "Oops! Game over 💥";
  messageText.textContent = isNewBest
    ? `🎉 New best score: ${score}`
    : `Your final score: ${score}  ·  Best: ${best}`;
  restartButton.textContent = "Play Again";
  gameMessage.classList.remove("hidden");
  setStatus(`Game over. Final score: ${score}. Press Space or select Play Again to restart.`);
}

function setStatus(text) {
  document.getElementById("gameStatus").textContent = text;
}

function togglePause() {
  if (state !== "playing" && state !== "paused") return;
  state = state === "playing" ? "paused" : "playing";
  lastTime = performance.now();
  accumulator = 0;
  // Pause freezes the pose and discards held jump ownership. Resume is neutral.
  jumpInput = null;
  if (state === "playing") {
    player.ducking = false;
    if (player.grounded) {
      player.height = STAND_H;
      player.y = groundY - STAND_H;
    }
  }
  drawGame(lastTime);
  if (state === "paused") {
    setStatus("Paused. Press P or select Resume to continue.");
    messageTitle.textContent = "Paused";
    messageText.textContent = "Press P or select Resume to continue.";
    restartButton.textContent = "Resume";
    gameMessage.classList.remove("hidden");
  } else {
    gameMessage.classList.add("hidden");
    setStatus("Playing.");
  }
}

// ---------- Controls ----------
document.addEventListener("keydown", event => {
  if (event.target?.closest?.("button") && event.code === "Space") return;
  if (event.code === "Space" || event.code === "ArrowUp") {
    event.preventDefault();
    if (!event.repeat) jump(event.code);
  } else if (event.code === "ArrowDown") {
    event.preventDefault();
    if (state === "playing") player.ducking = true;
  } else if (event.code === "KeyP" && !event.repeat) {
    togglePause();
  }
});

document.addEventListener("keyup", event => {
  if (event.code === "Space" || event.code === "ArrowUp") releaseJumpInput(event.code);
  if (event.code === "ArrowDown" && state === "playing") player.ducking = false;
});

// Tap / click to jump (release shortens the jump)
canvas.addEventListener("pointerdown", event => jump(`pointer:${event.pointerId}`));
window.addEventListener("pointerup", event => releaseJumpInput(`pointer:${event.pointerId}`));

restartButton.addEventListener("click", () => {
  if (state === "paused") togglePause();
  else startGame();
});

muteButton.addEventListener("click", () => {
  muted = !muted;
  muteButton.textContent = muted ? "🔇" : "🔊";
  muteButton.setAttribute("aria-pressed", muted);
  muteButton.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
  muteButton.blur();
});

// Pause automatically when the tab is hidden
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state === "playing") togglePause();
});

window.addEventListener("blur", () => {
  if (state === "playing") togglePause();
});
canvas.addEventListener("pointercancel", event => releaseJumpInput(`pointer:${event.pointerId}`));

// Keep the CSS dino aligned when the canvas is resized
new ResizeObserver(updateScale).observe(canvas);
updateScale();

// Initial screen
computeTheme();
clouds = [{ x: 120, y: 50 }, { x: 380, y: 90 }, { x: 620, y: 40 }];
drawGame(0);
