(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const shell = document.getElementById('gameShell');
  const intro = document.getElementById('introScreen');
  const message = document.getElementById('messageScreen');
  const playButton = document.getElementById('playButton');
  const resumeButton = document.getElementById('resumeButton');
  const restartButton = document.getElementById('restartButton');
  const coinCountEl = document.getElementById('coinCount');
  const powerFill = document.getElementById('powerFill');
  const powerText = document.getElementById('powerText');
  const distanceText = document.getElementById('distanceText');
  const statusText = document.getElementById('statusText');
  const toast = document.getElementById('toast');
  const bottomHint = document.getElementById('bottomHint');
  const soundButton = document.getElementById('soundButton');
  const soundIcon = document.getElementById('soundIcon');
  const pauseButton = document.getElementById('pauseButton');
  const pressed = { left: false, right: false, jump: false };
  const keyboardHolds = new Set();
  const touchHolds = new Map();
  const worldWidth = 4280;
  const coinPositions = [
    [255, 0], [430, 1], [630, 2], [835, 0], [1030, 1], [1220, 2],
    [1430, 0], [1640, 1], [1830, 2], [2045, 0], [2250, 1], [2460, 2],
    [2670, 0], [2880, 1], [3100, 2], [3330, 0], [3550, 1], [3790, 2]
  ];
  const platforms = [
    [340, 112, 115], [530, 162, 110], [730, 216, 112], [930, 118, 110],
    [1130, 169, 112], [1335, 224, 118], [1535, 113, 112], [1740, 172, 115],
    [1940, 224, 116], [2150, 116, 115], [2350, 168, 112], [2560, 224, 118],
    [2770, 116, 114], [2980, 171, 118], [3210, 223, 118], [3440, 119, 112],
    [3660, 174, 116], [3890, 225, 125]
  ];
  const bugs = [
    { x: 690, a: 660, b: 790, dir: 1, speed: 47 },
    { x: 1510, a: 1460, b: 1600, dir: -1, speed: 54 },
    { x: 2380, a: 2320, b: 2480, dir: 1, speed: 58 },
    { x: 3260, a: 3190, b: 3370, dir: -1, speed: 52 }
  ];
  let W = 0, H = 0, dpr = 1, groundY = 0, cameraX = 0, cameraY = 0;
  let player, coins, collected = 0, state = 'intro', soundOn = true, audio = null;
  let lastTime = 0, worldTime = 0, toastTimer = 0, particles = [], clouds = [];
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const rand = (a, b) => a + Math.random() * (b - a);

  function resize() {
    const rect = shell.getBoundingClientRect();
    W = rect.width; H = rect.height; dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    groundY = H - (W < 700 ? 52 : 70);
    if (player && (state === 'intro' || state === 'won')) { player.y = groundY - player.h; }
    clouds = Array.from({ length: 10 }, (_, i) => ({ x: i * 510 + rand(-100, 100), y: rand(70, Math.max(130, H * .56)), s: rand(.65, 1.35) }));
  }
  function freshGame() {
    collected = 0; cameraX = 0; cameraY = 0; worldTime = 0; particles = [];
    coins = coinPositions.map((c, i) => ({ x: c[0], y: groundY - [83, 137, 190][c[1]], id: i, got: false, phase: i * .72 }));
    player = { x: 66, y: groundY - 42, w: 31, h: 43, vx: 0, vy: 0, grounded: true, facing: 1, coyote: .11, jumpBuffer: 0, anim: 0, invuln: 0, checkpoint: 65 };
    bugs.forEach(b => { b.x = (b.a + b.b) / 2; b.dir = 1; });
    updateHud();
  }
  function startGame() {
    freshGame(); state = 'playing'; intro.classList.add('hidden'); message.classList.add('hidden');
    bottomHint.style.opacity = '1'; bottomHint.style.display = 'block'; statusText.textContent = 'THE SKY IS YOURS';
    if (W < 700) document.getElementById('touchControls').style.display = 'flex';
    bottomHint.style.display = 'none';
    lastTime = performance.now();
  }
  function togglePause() {
    if (state === 'playing') {
      state = 'paused'; showMessage('TAKE YOUR TIME', 'Paused.', 'Catch your breath. The sky isn’t going anywhere.', 'KEEP GOING'); statusText.textContent = 'PAUSED';
    } else if (state === 'paused') {
      state = 'playing'; message.classList.add('hidden'); statusText.textContent = 'THE SKY IS YOURS'; lastTime = performance.now();
    }
  }
  function showMessage(kicker, title, body, action) {
    document.getElementById('messageKicker').textContent = kicker;
    document.getElementById('messageTitle').textContent = title;
    document.getElementById('messageBody').textContent = body;
    resumeButton.querySelector('span').textContent = action;
    message.classList.remove('hidden');
  }
  function updateHud() {
    coinCountEl.textContent = String(collected).padStart(2, '0');
    const power = 1 + collected * .075;
    powerText.textContent = `×${power.toFixed(1)}`;
    powerFill.style.width = `${Math.min(100, 7 + collected * 5.15)}%`;
    distanceText.textContent = String(Math.floor(Math.max(0, (player?.x || 66) - 66) / 10)).padStart(3, '0');
  }
  function playTone(freq, duration, type = 'sine', volume = .055, slide = 1) {
    if (!soundOn) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq, audio.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), audio.currentTime + duration);
      gain.gain.setValueAtTime(volume, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
      osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(audio.currentTime + duration);
    } catch (_) { /* Audio is an optional browser enhancement. */ }
  }
  function showToast(text) {
    toast.textContent = text; toast.classList.add('show'); toastTimer = 1.05;
  }
  function burst(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) particles.push({ x, y, vx: rand(-125, 125), vy: rand(-165, 25), life: rand(.35, .75), max: .75, size: rand(2, 5), color });
  }
  function jump() {
    player.vy = -(565 + collected * 34);
    player.grounded = false; player.coyote = 0;
    burst(player.x + player.w / 2, player.y + player.h, '#fff3cf', 5);
    playTone(265 + collected * 8, .14, 'triangle', .025, 1.65);
  }
  function update(dt) {
    if (state !== 'playing') return;
    worldTime += dt;
    const p = player;
    p.anim += dt * (Math.abs(p.vx) > 20 ? 12 : 2);
    p.invuln = Math.max(0, p.invuln - dt);
    if (p.grounded) p.coyote = .11; else p.coyote -= dt;
    p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
    const direction = (pressed.right ? 1 : 0) - (pressed.left ? 1 : 0);
    if (direction) { p.vx += direction * 2100 * dt; p.facing = direction; }
    else p.vx *= Math.pow(p.grounded ? .0008 : .12, dt);
    p.vx = clamp(p.vx, -235, 235);
    if (p.jumpBuffer > 0 && p.coyote > 0) { jump(); p.jumpBuffer = 0; }
    if (!pressed.jump && p.vy < -100) p.vy += 1200 * dt;
    p.vy += 1480 * dt;
    p.vy = Math.min(p.vy, 1050);
    const oldBottom = p.y + p.h;
    p.x = clamp(p.x + p.vx * dt, 0, worldWidth - p.w);
    p.y += p.vy * dt;
    p.grounded = false;
    const surfaces = [{ x: 0, y: groundY, w: worldWidth, h: H + 100 }, ...platforms.map(pl => ({ x: pl[0], y: groundY - pl[1], w: pl[2], h: 13 }))];
    for (const s of surfaces) {
      if (p.vy >= 0 && oldBottom <= s.y + 3 && p.y + p.h >= s.y && p.x + p.w > s.x + 3 && p.x < s.x + s.w - 3) {
        p.y = s.y - p.h; p.vy = 0; p.grounded = true;
      } else if (p.vy < 0 && p.y < s.y + s.h && p.y + p.h > s.y + s.h && p.x + p.w > s.x && p.x < s.x + s.w) {
        p.y = s.y + s.h; p.vy = 0;
      }
    }
    for (const c of coins) {
      if (c.got) continue;
      const cy = c.y + Math.sin(worldTime * 2.8 + c.phase) * 4;
      const dx = (p.x + p.w / 2) - c.x, dy = (p.y + p.h / 2) - cy;
      if (dx * dx + dy * dy < 29 * 29) {
        c.got = true; collected++;
        burst(c.x, cy, '#ffc94f', 13);
        playTone(540 + collected * 31, .23, 'sine', .04, 1.5);
        showToast(`+ JUMP POWER  ·  ×${(1 + collected * .075).toFixed(1)}`);
        updateHud();
      }
    }
    for (const bug of bugs) {
      bug.x += bug.dir * bug.speed * dt;
      if (bug.x > bug.b) { bug.x = bug.b; bug.dir = -1; }
      if (bug.x < bug.a) { bug.x = bug.a; bug.dir = 1; }
      const by = groundY - 18;
      if (p.invuln <= 0 && p.x + p.w > bug.x - 14 && p.x < bug.x + 14 && p.y + p.h > by - 15 && p.y + p.h < by + 17 && p.vy > 0) {
        p.vy = -(410 + collected * 20); p.invuln = .55; burst(bug.x, by, '#9d6242', 8); playTone(145, .16, 'square', .018, .55);
      } else if (p.invuln <= 0 && p.x + p.w > bug.x - 12 && p.x < bug.x + 12 && p.y + p.h > by - 10 && p.y < by + 10) {
        p.x = p.checkpoint; p.y = groundY - p.h; p.vx = 0; p.vy = 0; p.invuln = 1.2;
        cameraX = clamp(p.x - W * .34, 0, worldWidth - W); cameraY = 0;
        showToast('BONK! Coins kept. Try again.');
      }
    }
    if (p.x > 1080) p.checkpoint = Math.max(p.checkpoint, 1050);
    if (p.x > 2140) p.checkpoint = Math.max(p.checkpoint, 2100);
    if (p.x > 3200) p.checkpoint = Math.max(p.checkpoint, 3160);
    if (p.y > groundY + 260) {
      p.x = p.checkpoint; p.y = groundY - p.h; p.vx = 0; p.vy = 0;
      cameraX = clamp(p.x - W * .34, 0, worldWidth - W); cameraY = 0;
      showToast('Back on your feet!');
    }
    const targetX = clamp(p.x - W * .34, 0, worldWidth - W);
    cameraX += (targetX - cameraX) * Math.min(1, dt * 5.5);
    // Keep the hero above the HUD and lift the camera during high coin-powered jumps.
    const upperSafeY = H < 620 ? H * .34 : H * .4;
    if (p.y - cameraY < upperSafeY) cameraY = Math.max(0, p.y - upperSafeY);
    const targetY = Math.max(0, p.y - H * .52);
    cameraY += (targetY - cameraY) * Math.min(1, dt * 3.2);
    if (toastTimer > 0 && (toastTimer -= dt) <= 0) toast.classList.remove('show');
    for (const particle of particles) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vy += 400 * dt; particle.life -= dt; }
    particles = particles.filter(particle => particle.life > 0);
    if (p.x > worldWidth - 180) {
      state = 'won'; statusText.textContent = 'YOU MADE IT';
      showMessage('THE SKY WAS NEVER THE LIMIT', 'You made it!', `${collected} coins collected · jump power ×${(1 + collected * .075).toFixed(1)} · ${Math.floor((p.x - 66) / 10)}m travelled.`, 'PLAY AGAIN');
    }
    updateHud();
  }

  function drawSky() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#83d5f3'); sky.addColorStop(.65, '#b8eced'); sky.addColorStop(1, '#e0edce');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.save();
    for (const c of clouds) {
      const x = ((c.x - cameraX * .18) % (worldWidth + 450) + worldWidth + 450) % (worldWidth + 450) - 90;
      const y = c.y - cameraY * .13;
      drawCloud(x, y, c.s);
    }
    ctx.restore();
    // distant rolling hills
    drawHillLayer('#8ed5bd', .12, H * .73, 110, 0);
    drawHillLayer('#63bd9b', .21, H * .84, 74, 0);
    drawHillLayer('#3e9e76', .33, H + 12, 45, 0);
  }
  function drawCloud(x, y, s) {
    ctx.fillStyle = '#ffffffb9'; ctx.beginPath();
    ctx.ellipse(x, y, 34 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 18 * s, y + 3 * s, 17 * s, 9 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 13 * s, y - 6 * s, 18 * s, 16 * s, 0, 0, Math.PI * 2); ctx.fill();
  }
  function drawHillLayer(color, factor, base, amplitude, phase) {
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W + 12; x += 12) {
      const wx = x + cameraX * factor;
      const y = base + Math.sin(wx * .002 + phase) * amplitude * .38 + Math.sin(wx * .0009 + phase + 1) * amplitude * .42 - cameraY * .08;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  }
  function rr(x, y, w, h, r) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  }
  function drawWorld() {
    ctx.save(); ctx.translate(-cameraX, -cameraY);
    // low sun glow
    const sunX = cameraX + W * .83, sunY = cameraY + H * .2;
    ctx.fillStyle = '#fff4bd75'; ctx.beginPath(); ctx.arc(sunX, sunY, 42, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff5c9'; ctx.beginPath(); ctx.arc(sunX, sunY, 25, 0, Math.PI * 2); ctx.fill();
    // ground
    ctx.fillStyle = '#277b56'; ctx.fillRect(0, groundY, worldWidth, H + cameraY + 250);
    ctx.fillStyle = '#53b86c'; ctx.fillRect(0, groundY, worldWidth, 10);
    ctx.fillStyle = '#83cf6e'; ctx.fillRect(0, groundY, worldWidth, 3);
    for (let x = Math.floor(cameraX / 42) * 42; x < cameraX + W + 50; x += 42) {
      ctx.fillStyle = ((x / 42) % 2 < 1) ? '#337f55' : '#318253';
      ctx.fillRect(x, groundY + 30 + (x % 3) * 8, 18, 3);
      ctx.fillStyle = '#9bce68'; ctx.fillRect(x + 7, groundY + 16 + (x % 4) * 5, 3, 5);
    }
    // stepping stones/platforms
    for (let i = 0; i < platforms.length; i++) {
      const [x, height, width] = platforms[i], y = groundY - height;
      ctx.fillStyle = '#357651'; rr(x, y + 8, width, 15, 5); ctx.fill();
      ctx.fillStyle = '#b98257'; rr(x, y + 5, width, 10, 4); ctx.fill();
      ctx.fillStyle = '#65c977'; rr(x - 2, y, width + 4, 10, 5); ctx.fill();
      ctx.fillStyle = '#a1e279'; rr(x + 4, y, width - 8, 3, 2); ctx.fill();
      for (let j = 0; j < Math.floor(width / 28); j++) {
        ctx.fillStyle = '#8b634b'; ctx.fillRect(x + 15 + j * 28, y + 13, 12, 3);
      }
    }
    // checkpoint pennants
    for (const cp of [1050, 2100, 3160]) drawCheckpoint(cp);
    // coins
    for (const c of coins) if (!c.got) drawCoin(c);
    // little beetles
    bugs.forEach(drawBug);
    // finish marker
    drawFinish();
    drawPlayer();
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.restore();
  }
  function drawCoin(c) {
    const bob = Math.sin(worldTime * 2.8 + c.phase) * 4;
    const x = c.x, y = c.y + bob;
    ctx.fillStyle = '#da922e55'; ctx.beginPath(); ctx.ellipse(x, y + 15, 13, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d7922b'; ctx.beginPath(); ctx.ellipse(x + 1, y, 9, 14, -.08, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd566'; ctx.beginPath(); ctx.ellipse(x, y - 1, 8, 13, -.08, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff0a4'; ctx.beginPath(); ctx.ellipse(x - 2, y - 4, 2, 6, -.08, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2b640'; ctx.fillRect(x - 1, y - 3, 2, 7);
  }
  function drawBug(b) {
    const x = b.x, y = groundY - 13 + Math.sin(worldTime * 8 + b.x) * 1.3;
    ctx.fillStyle = '#245944'; ctx.beginPath(); ctx.ellipse(x, y + 10, 17, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b9684b'; ctx.beginPath(); ctx.ellipse(x, y, 13, 10, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#d77b56'; ctx.beginPath(); ctx.ellipse(x - 1, y - 2, 10, 6, 0, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = '#633f38'; ctx.lineWidth = 1.5;
    for (const side of [-1, 1]) for (let i = 0; i < 2; i++) {
      ctx.beginPath(); ctx.moveTo(x + side * 7, y + 5); ctx.lineTo(x + side * (13 + i * 3), y + 10 + (i % 2) * 2); ctx.stroke();
    }
    ctx.fillStyle = '#fff0c8'; ctx.beginPath(); ctx.arc(x + b.dir * 5, y - 1, 2.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#243f3a'; ctx.beginPath(); ctx.arc(x + b.dir * 6, y - 1, 1.3, 0, Math.PI * 2); ctx.fill();
  }
  function drawCheckpoint(x) {
    ctx.fillStyle = '#dfd4a9'; ctx.fillRect(x, groundY - 58, 3, 58);
    ctx.fillStyle = '#ef7956'; ctx.beginPath(); ctx.moveTo(x + 3, groundY - 57); ctx.lineTo(x + 25, groundY - 49); ctx.lineTo(x + 3, groundY - 41); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f9e3a8'; ctx.beginPath(); ctx.arc(x + 1.5, groundY - 59, 3.2, 0, Math.PI * 2); ctx.fill();
  }
  function drawFinish() {
    const x = worldWidth - 155;
    ctx.fillStyle = '#edf0cb'; ctx.fillRect(x, groundY - 203, 5, 203);
    ctx.fillStyle = '#ec7453'; ctx.beginPath(); ctx.moveTo(x + 5, groundY - 200); ctx.lineTo(x + 77, groundY - 179); ctx.lineTo(x + 5, groundY - 158); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff3c8'; ctx.font = '700 11px "DM Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText('THE TOP', x + 34, groundY - 181);
    ctx.fillStyle = '#f4c652'; ctx.beginPath(); ctx.arc(x + 2.5, groundY - 208, 6, 0, Math.PI * 2); ctx.fill();
  }
  function drawPlayer() {
    const p = player;
    const x = p.x, y = p.y;
    const running = Math.abs(p.vx) > 35 && p.grounded;
    const step = running ? Math.sin(p.anim) * 3 : 0;
    ctx.save();
    if (p.invuln > 0 && Math.floor(worldTime * 16) % 2 === 0) ctx.globalAlpha = .45;
    // shadow
    ctx.fillStyle = '#164a3e45'; ctx.beginPath(); ctx.ellipse(x + 16, y + p.h + 3, p.grounded ? 18 : 12, 4, 0, 0, Math.PI * 2); ctx.fill();
    // boots/legs
    ctx.fillStyle = '#3e5950'; rr(x + 5, y + 34 + step, 10, 9, 3); ctx.fill();
    rr(x + 18, y + 34 - step, 10, 9, 3); ctx.fill();
    ctx.fillStyle = '#f57855'; rr(x + 2, y + 39 + step, 14, 6, 3); ctx.fill();
    rr(x + 17, y + 39 - step, 14, 6, 3); ctx.fill();
    // torso
    ctx.fillStyle = '#f2b941'; rr(x + 4, y + 20, 25, 19, 6); ctx.fill();
    ctx.fillStyle = '#ea7655'; rr(x + 2, y + 20, 8, 17, 4); ctx.fill();
    // face
    ctx.fillStyle = '#ffd89e'; rr(x + 6, y + 7, 23, 19, 8); ctx.fill();
    // hair curl
    ctx.fillStyle = '#543e37'; ctx.beginPath(); ctx.arc(x + 10, y + 8, 6, Math.PI, Math.PI * 1.75); ctx.fill();
    // cap
    ctx.fillStyle = '#ed7654'; rr(x + 3, y + 1, 25, 9, 5); ctx.fill();
    ctx.fillStyle = '#d45e49'; ctx.fillRect(x + 11, y + 7, 22, 4);
    // eye on facing side
    ctx.fillStyle = '#25413d'; ctx.beginPath(); ctx.ellipse(x + (p.facing > 0 ? 22 : 12), y + 16, 1.7, 2.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#df8067'; ctx.beginPath(); ctx.arc(x + (p.facing > 0 ? 25 : 9), y + 20, 2, 0, Math.PI * 2); ctx.fill();
    // backpack strap
    ctx.strokeStyle = '#fff0bc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 10, y + 23); ctx.lineTo(x + 15, y + 35); ctx.stroke();
    ctx.restore();
  }
  function render() {
    ctx.clearRect(0, 0, W, H); drawSky(); drawWorld();
  }
  function frame(now) {
    const dt = Math.min(.033, Math.max(0, (now - lastTime) / 1000 || 0));
    lastTime = now;
    if (state === 'playing') update(dt);
    else if (state === 'intro') { worldTime += dt; cameraX = 0; cameraY = 0; if (player) { player.x = 130; player.y = groundY - player.h + Math.sin(worldTime * 2) * 3; player.anim += dt * 2; } }
    render(); requestAnimationFrame(frame);
  }
  function queueJump() { if (state === 'playing') player.jumpBuffer = .14; }
  function controlForKey(key) {
    if (key === 'ArrowLeft' || key.toLowerCase() === 'a') return 'left';
    if (key === 'ArrowRight' || key.toLowerCase() === 'd') return 'right';
    if (key === ' ' || key === 'ArrowUp' || key.toLowerCase() === 'w') return 'jump';
    return null;
  }
  function updateControl(control) {
    const wasDown = pressed[control];
    const touchPointers = touchHolds.get(control);
    const keyboardDown = [...keyboardHolds].some(key => controlForKey(key) === control);
    pressed[control] = keyboardDown || Boolean(touchPointers?.size);
    if (control === 'jump' && pressed.jump && !wasDown) queueJump();
  }
  function clearControls() {
    keyboardHolds.clear();
    touchHolds.clear();
    for (const control of Object.keys(pressed)) pressed[control] = false;
  }
  window.addEventListener('keydown', e => {
    if (state === 'intro' && (e.key === 'Enter' || e.key === ' ')) {
      if (e.key === ' ') e.preventDefault();
      startGame();
      return;
    }
    const control = controlForKey(e.key);
    if (control) {
      e.preventDefault();
      if (!keyboardHolds.has(e.key)) {
        keyboardHolds.add(e.key);
        updateControl(control);
      }
      return;
    }
    if (e.key === 'Escape' || e.key.toLowerCase() === 'p') { togglePause(); return; }
    if (state === 'intro' && e.key === 'Enter') startGame();
  });
  window.addEventListener('keyup', e => {
    const control = controlForKey(e.key);
    if (!control) return;
    keyboardHolds.delete(control);
    updateControl(control);
  });
  window.addEventListener('blur', clearControls);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearControls(); });
  document.querySelectorAll('.touch-button').forEach(button => {
    const control = button.dataset.key;
    button.addEventListener('pointerdown', e => {
      e.preventDefault();
      button.setPointerCapture(e.pointerId);
      if (!touchHolds.has(control)) touchHolds.set(control, new Set());
      touchHolds.get(control).add(e.pointerId);
      updateControl(control);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => button.addEventListener(type, e => {
      const pointers = touchHolds.get(control);
      pointers?.delete(e.pointerId);
      if (pointers?.size === 0) touchHolds.delete(control);
      updateControl(control);
    }));
  });
  playButton.addEventListener('click', startGame);
  resumeButton.addEventListener('click', () => {
    if (state === 'won') { startGame(); return; }
    state = 'playing'; message.classList.add('hidden'); statusText.textContent = 'THE SKY IS YOURS'; lastTime = performance.now();
  });
  restartButton.addEventListener('click', startGame);
  pauseButton.addEventListener('click', togglePause);
  soundButton.addEventListener('click', () => {
    soundOn = !soundOn; soundIcon.textContent = soundOn ? '♫' : '♪'; soundButton.querySelector('.sound-label').textContent = soundOn ? 'SOUND ON' : 'SOUND OFF';
    if (soundOn) playTone(440, .12, 'sine', .02, 1.2);
  });
  window.addEventListener('resize', resize);
  resize(); freshGame(); requestAnimationFrame(frame);
})();
