const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function game(source = fs.readFileSync('script.js', 'utf8')) {
  const events = {};
  const frames = new Map();
  let id = 0;
  let now = 1000;
  const stored = new Map();
  function listen(name, fn) {
    (events[name] ??= []).push(fn);
  }
  function emit(name, event = {}) {
    for (const fn of events[name] ?? []) fn(event);
  }
  function classList() {
    const classes = new Set();
    return {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name); },
      toggle(name, force = !classes.has(name)) {
        if (force) classes.add(name);
        else classes.delete(name);
        return force;
      }
    };
  }
  const ctx = new Proxy({}, { get: (_, key) => key === 'createLinearGradient'
    ? () => ({ addColorStop() {} }) : () => {} });
  const elements = new Map();
  function element(name) {
    if (!elements.has(name)) elements.set(name, {
      textContent: '', clientWidth: 792, clientLeft: 4,
      style: { setProperty() {} }, classList: classList(),
      blur() {}, setAttribute() {}, getContext: () => ctx,
      addEventListener(type, fn) { listen(name + ':' + type, fn); },
      querySelector: tag => element(name + tag),
      get parentElement() { return element(name + 'parent'); }
    });
    return elements.get(name);
  }
  const sandbox = {
    document: { getElementById: element, hidden: false,
      addEventListener(type, fn) { listen(type, fn); } },
    window: { devicePixelRatio: 2, addEventListener(type, fn) { listen('window:' + type, fn); } },
    localStorage: { getItem(key) { return stored.get(key) ?? null; }, setItem(key, value) { stored.set(key, String(value)); } },
    performance: { now: () => now },
    ResizeObserver: class { observe() {} },
    requestAnimationFrame(fn) { frames.set(++id, fn); return id; },
    cancelAnimationFrame(n) { frames.delete(n); }
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return { run: code => vm.runInContext(code, sandbox), events, emit, frames, elements, stored,
    key(code, repeat = false) { emit('keydown', { code, repeat, preventDefault() {} }); },
    frame(timestamp) {
      now = timestamp;
      const [n, fn] = frames.entries().next().value;
      frames.delete(n);
      fn(now);
    }
  };
}

test('static links, ready state, responsive logical coordinates', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  for (const file of ['style.css', 'script.js']) {
    assert.ok(html.includes(file)); assert.ok(fs.existsSync(file));
  }
  const g = game();
  assert.equal(g.run('state'), 'ready');
  assert.equal(g.run('player.y + player.height'), 250);
  assert.equal(g.run('scale'), 784 / 800);
  assert.equal(g.frames.size, 0);
});

test('both jump keys, repeat protection, no double jump, gravity and exact landing', () => {
  for (const code of ['Space', 'ArrowUp']) {
    const g = game(); g.run('startGame()'); g.key(code);
    assert.equal(g.run('player.velocityY'), -13);
    g.run('updatePlayer(0.5)'); const velocity = g.run('player.velocityY');
    g.key(code); g.key(code, true);
    assert.equal(g.run('player.velocityY'), velocity);
    g.run('for(let i=0;i<150;i++) updatePlayer(0.5)');
    assert.equal(g.run('player.grounded'), true);
    assert.equal(g.run('player.y + player.height'), 250);
  }
});

test('duck, stand and jump from duck preserve floor alignment', () => {
  const g = game(); g.run('startGame(); player.ducking=true; updatePlayer(0.5)');
  assert.equal(g.run('player.y'), 226);
  g.run('player.ducking=false; updatePlayer(0.5)');
  assert.equal(g.run('player.y'), 210);
  g.run('player.ducking=true; updatePlayer(0.5); jump()');
  assert.equal(g.run('player.y'), 210);
  assert.equal(g.run('player.grounded'), false);
});

test('spawn, movement, cleanup and one point per obstacle', () => {
  const g = game(); g.run('startGame(); distance=nextGap; updateObstacles(0.5)');
  assert.equal(g.run('obstacles.length'), 1);
  const x = g.run('obstacles[0].x'); g.run('updateObstacles(0.5)');
  assert.ok(g.run('obstacles[0].x') < x);
  g.run('obstacles[0].x=0; updateObstacles(0.5); updateObstacles(0.5)');
  assert.equal(g.run('score'), 1);
  g.run('obstacles[0].x=-100; updateObstacles(0.5)');
  assert.equal(g.run('obstacles.length'), 0);
});

test('AABB collision, jump clearance, Game Over and frozen final score', () => {
  const g = game(); g.run('startGame(); obstacles=[{x:60,y:210,width:20,height:40}]');
  assert.equal(g.run('detectCollision()'), true);
  g.run('player.y=120'); assert.equal(g.run('detectCollision()'), false);
  g.run('player.y=210; score=7'); g.frame(1010);
  assert.equal(g.run('state'), 'gameover');
  assert.equal(g.frames.size, 0);
  assert.match(g.elements.get('gameStatus').textContent, /Final score: 7/);
  g.run('gameLoop(9000); endGame()'); assert.equal(g.run('score'), 7);
});

test('restart fully resets and keeps exactly one loop across 30 restarts', () => {
  const g = game();
  g.run('startGame(); score=40; speed=11; player.velocityY=-9; accumulator=2');
  g.run('for(let i=0;i<30;i++) startGame()');
  assert.equal(g.frames.size, 1);
  assert.equal(g.run('score + accumulator + player.velocityY + distance + themeT'), 0);
  assert.equal(g.run('speed'), 5);
  assert.equal(g.run('nextGap'), 400);
  assert.equal(g.run('obstacles.length'), 0);
  g.key('Space'); assert.equal(g.run('player.grounded'), false);
});

test('pause, tab hiding, repeated P and resume discard inactive time', () => {
  const g = game(); g.run('startGame()'); g.key('KeyP');
  g.key('KeyP', true); assert.equal(g.run('state'), 'paused');
  g.frame(90000); assert.equal(g.run('distance'), 0);
  g.emit('restartButton:click'); assert.equal(g.run('state'), 'playing');
  g.frame(100000); assert.ok(g.run('distance') <= 15);
  g.run('document.hidden=true'); g.emit('visibilitychange');
  assert.equal(g.run('state'), 'paused');
});

test('fixed physics agree throughout ascent, descent and landing at 30, 60 and 144 Hz', () => {
  const trajectories = [30, 60, 144].map(hz => {
    const g = game(); g.run('startGame(); jump()');
    const samples = [];
    for (let sample = 1; sample <= 6; sample++) {
      for (let frame = 1; frame <= hz / 6; frame++) {
        g.frame(1000 + ((sample - 1) * hz / 6 + frame) * 1000 / hz);
      }
      samples.push(g.run('player.y'));
    }
    assert.equal(g.run('player.grounded'), true);
    assert.equal(g.run('player.y + player.height'), 250);
    return samples;
  });
  for (let sample = 0; sample < 6; sample++) {
    const positions = trajectories.map(path => path[sample]);
    assert.ok(Math.max(...positions) - Math.min(...positions) < 4);
  }
});

test('maximum cactus is avoidable at base and maximum speed', () => {
  for (const speed of [5, 11]) {
    const g = game();
    g.run(`startGame(); speed=${speed}; obstacles=[{x:95 + speed * 12,y:200,width:25,height:50,passed:false}]; jump()`);
    for(let i=0;i<80;i++) {
      g.run('updatePlayer(0.5); updateObstacles(0.5)');
      assert.equal(g.run('detectCollision()'), false);
    }
    assert.equal(g.run('score'), 1);
  }
});

test('paused keyboard releases freeze physics and cannot cut the resumed jump', () => {
  for (const code of ['Space', 'ArrowUp']) {
    const g = game();
    g.run('startGame()');
    g.key(code);
    g.frame(1020);
    g.key('KeyP');
    const frozen = g.run('JSON.stringify(player)');
    const position = g.elements.get('dino').style.transform;
    g.emit('keyup', { code });
    g.emit('window:pointerup', { pointerId: 7 });
    g.run('releaseJump()');
    g.frame(2000);
    assert.equal(g.run('JSON.stringify(player)'), frozen);
    assert.equal(g.elements.get('dino').style.transform, position);
    g.emit('restartButton:click');
    assert.equal(g.run('JSON.stringify(player)'), frozen);
    g.emit('keyup', { code });
    assert.equal(g.run('JSON.stringify(player)'), frozen);
    g.frame(2010);
    assert.ok(g.run('player.y') < JSON.parse(frozen).y);
    assert.equal(g.frames.size, 1);
  }
});

test('only the initiating keyboard key can shorten its jump', () => {
  const g = game();
  g.run('startGame()');
  g.key('Space');
  g.key('ArrowUp');
  g.emit('keyup', { code: 'ArrowUp' });
  g.emit('window:pointerup', { pointerId: 2 });
  g.emit('gameCanvas:pointercancel', { pointerId: 2 });
  assert.equal(g.run('player.velocityY'), -13);
  g.emit('keyup', { code: 'Space' });
  assert.equal(g.run('player.velocityY'), -5);
  assert.equal(g.run('jumpInput'), null);
});

test('pointer jump releases and cancellation match pointer IDs', () => {
  for (const event of ['window:pointerup', 'gameCanvas:pointercancel']) {
    const g = game();
    g.run('startGame()');
    g.emit('gameCanvas:pointerdown', { pointerId: 7 });
    g.emit(event, { pointerId: 8 });
    g.emit('keyup', { code: 'Space' });
    assert.equal(g.run('player.velocityY'), -13);
    g.emit(event, { pointerId: 7 });
    assert.equal(g.run('player.velocityY'), -5);
    assert.equal(g.run('jumpInput'), null);
  }
});

test('pointer release during pause is ignored and restart clears input ownership', () => {
  const g = game();
  g.run('startGame()');
  g.emit('gameCanvas:pointerdown', { pointerId: 7 });
  g.key('KeyP');
  g.emit('window:pointerup', { pointerId: 7 });
  assert.equal(g.run('player.velocityY'), -13);
  g.key('KeyP');
  g.emit('window:pointerup', { pointerId: 7 });
  assert.equal(g.run('player.velocityY'), -13);
  g.run('startGame()');
  assert.equal(g.run('jumpInput'), null);
  g.key('Space');
  g.emit('window:pointerup', { pointerId: 7 });
  assert.equal(g.run('player.velocityY'), -13);
});

test('resume does not auto-jump and a fresh jump still has variable height', () => {
  const g = game();
  g.run('startGame()');
  g.key('Space');
  g.key('KeyP');
  g.emit('keyup', { code: 'Space' });
  g.key('KeyP');
  for (let tick = 1; tick <= 90; tick++) {
    g.key('Space', true);
    g.frame(1000 + tick * 1000 / 120);
  }
  assert.equal(g.run('player.grounded'), true);
  assert.equal(g.run('player.y'), 210);
  assert.equal(g.run('player.velocityY'), 0);
  g.key('ArrowUp');
  assert.equal(g.run('player.velocityY'), -13);
  g.emit('keyup', { code: 'ArrowUp' });
  assert.equal(g.run('player.velocityY'), -5);
});

test('manual pause, blur and hidden tab preserve duck pose and resume aligned', () => {
  for (const pause of ['manual', 'blur', 'hidden']) {
    const g = game();
    g.run('startGame()');
    g.key('ArrowDown');
    g.frame(1010);
    assert.equal(g.run('player.y'), 226);
    assert.ok(g.elements.get('dino').classList.contains('ducking'));
    const frozen = g.run('JSON.stringify(player)');
    if (pause === 'manual') g.key('KeyP');
    if (pause === 'blur') g.emit('window:blur');
    if (pause === 'hidden') {
      g.run('document.hidden=true');
      g.emit('visibilitychange');
    }
    g.emit('keyup', { code: 'ArrowDown' });
    g.emit('window:blur');
    g.run('updateScale()');
    g.frame(2000);
    assert.equal(g.run('JSON.stringify(player)'), frozen);
    assert.ok(g.elements.get('dino').classList.contains('ducking'));
    assert.equal(g.run('player.y + player.height'), 250);
    assert.equal(g.run('state'), 'paused');
    g.emit('restartButton:click');
    assert.equal(g.run('player.ducking'), false);
    assert.equal(g.run('player.height'), 40);
    assert.equal(g.run('player.y'), 210);
    assert.equal(g.run('player.y + player.height'), 250);
    assert.equal(g.elements.get('dino').classList.contains('ducking'), false);
    g.run('obstacles=[{x:60,y:215,width:20,height:10}]');
    assert.equal(g.run('detectCollision()'), true);
  }
});

test('airborne duck gravity freezes during pause and resumes with neutral input', () => {
  const g = game();
  g.run('startGame()');
  g.key('Space');
  g.key('ArrowDown');
  g.frame(1030);
  g.key('KeyP');
  const frozen = g.run('JSON.stringify(player)');
  g.emit('keyup', { code: 'ArrowDown' });
  g.frame(1500);
  assert.equal(g.run('JSON.stringify(player)'), frozen);
  g.key('KeyP');
  assert.equal(g.run('player.ducking'), false);
  assert.equal(g.run('player.y'), JSON.parse(frozen).y);
  assert.equal(g.run('player.velocityY'), JSON.parse(frozen).velocityY);
  assert.equal(g.run('player.height'), 40);
});

test('event collections expose duplicates and restart never registers more listeners', () => {
  const g = game();
  const counts = Object.fromEntries(Object.entries(g.events).map(([name, listeners]) => [name, listeners.length]));
  for (const count of Object.values(counts)) assert.equal(count, 1);
  for (let i = 0; i < 30; i++) {
    g.emit('restartButton:click');
    g.key('KeyP');
    g.emit('restartButton:click');
    g.run('endGame()');
  }
  for (const [name, listeners] of Object.entries(g.events)) assert.equal(listeners.length, counts[name]);
  let calls = 0;
  g.events.keyup.push(() => { calls++; });
  g.events.keyup.push(() => { calls++; });
  g.emit('keyup', { code: 'ArrowUp' });
  assert.equal(calls, 2, 'the mock retains and dispatches every registered listener');
});

for (const score of [4, 5, 6]) {
  test(`best-score announcement for score ${score} against previous best 5`, () => {
    const g = game();
    g.stored.set('dinoBest', '5');
    g.run(`best=loadBest(); startGame(); score=${score}; endGame()`);
    assert.equal(g.run('best'), Math.max(score, 5));
    assert.equal(Number(g.stored.get('dinoBest')), Math.max(score, 5));
    const message = g.elements.get('gameMessagep').textContent;
    assert.equal(message.includes('New best score'), score > 5);
    assert.match(g.elements.get('gameStatus').textContent, new RegExp(`Final score: ${score}`));
  });
}

function verifyObstacleSequence(scenario, source) {
  const g = game(source);
  // Instrument the production generator only to supply boundary random values.
  // All other random calls return zero, including the minimum-gap selection.
  g.run(`
    startGame(); speed=${scenario.speed}; score=${scenario.score};
    Math.random = () => 0;
    const generated = [];
    const productionCreateObstacle = createObstacle;
    createObstacle = () => {
      const minimumRandom = Math.random;
      Math.random = () => 1;
      productionCreateObstacle();
      Math.random = minimumRandom;
      generated.push(obstacles[obstacles.length - 1]);
    };
  `);
  let jumps = 0;
  let landings = 0;
  let wasGrounded = true;
  // A fresh full jump begins about 12 nominal frames before the next trunk
  // reaches the standing player's front edge. No early release or ducking.
  for (let tick = 1; tick <= 4000 && g.run('score') < scenario.score + 8; tick++) {
    const shouldJump = g.run(`player.grounded && obstacles.some(o =>
      !o.passed && o.x + o.width >= player.x && o.x <= player.x + player.width + speed * 12)`);
    if (shouldJump) {
      g.key('Space');
      jumps++;
      assert.equal(g.run('player.grounded'), false);
    }
    g.frame(1000 + tick * 1000 / 120);
    assert.equal(g.run('state'), 'playing', `unavoidable encounter at tick ${tick}`);
    assert.equal(g.run('detectCollision()'), false);
    const grounded = g.run('player.grounded');
    assert.ok(g.run('player.y + player.height') <= 250);
    if (grounded && !wasGrounded) {
      landings++;
      g.emit('keyup', { code: 'Space' });
      assert.equal(g.run('player.y'), 210);
    }
    wasGrounded = grounded;
  }
  assert.equal(g.run('score'), scenario.score + 8);
  assert.ok(jumps >= 8);
  assert.ok(landings >= 7);
  assert.ok(g.run('generated.length') >= 8);
  assert.equal(g.run('generated.every(o => o.height === 50 && o.width === 25)'), true);
  assert.equal(g.run('generated.filter(o => o.passed).length'), 8);
  if (scenario.speed === 5) assert.ok(g.run('speed') > 5, 'crossed the five-point difficulty milestone');
  else assert.equal(g.run('speed'), 11);
  assert.equal(g.frames.size, 1);
}

for (const scenario of [
  { name: 'base speed and natural difficulty transition', speed: 5, score: 0 },
  { name: 'maximum speed', speed: 11, score: 0 },
  { name: 'immediate difficulty transition', speed: 5, score: 4 }
]) {
  test(`generated maximum-size, minimum-gap sequence: ${scenario.name}`, () => {
    verifyObstacleSequence(scenario);
  });
}

test('sequence fairness check rejects an artificially shortened spawn gap', () => {
  const production = fs.readFileSync('script.js', 'utf8');
  const broken = production.replace('speed * (65 + Math.random() * 25)', 'speed * 5');
  assert.notEqual(broken, production);
  assert.throws(() => verifyObstacleSequence({ speed: 5, score: 0 }, broken), /unavoidable encounter/);
});
