/* Robert Chitic, portfolio. Plain JS + GSAP 3 (ScrollTrigger, SplitText, Draggable, Inertia, ScrambleText). */
(() => {
  'use strict';
  gsap.registerPlugin(ScrollTrigger, Draggable, InertiaPlugin, ScrambleTextPlugin);

  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const mouse = { x: innerWidth * 0.62, y: innerHeight * 0.45, inside: false };
  let paused = false; // "Pause animations" control in the footer
  addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.inside = true; }, { passive: true });
  document.addEventListener('pointerleave', () => { mouse.inside = false; });

  /* ------------------------------------------------------------------
     1. Colour worlds: each section owns a palette; the page morphs between them
  ------------------------------------------------------------------ */
  const THEMES = {
    night:    { bg:'#0E0B26', fg:'#F3F0FF', muted:'#A39CD6', line:'#2E2860', accent:'#8B7BFF', accent2:'#FF5FCB', hi:'#4DF2C3', panel:'rgba(255,255,255,0.04)' },
    lavender: { bg:'#E6E1FF', fg:'#160F45', muted:'#5B5395', line:'#C5BCF5', accent:'#4B2CFF', accent2:'#E5007E', hi:'#4B2CFF', panel:'rgba(22,15,69,0.04)' },
    orange:   { bg:'#FF6B2C', fg:'#1C0A00', muted:'#4A1A02', line:'#E8551A', accent:'#1C0A00', accent2:'#FFF0E3', hi:'#FFE14D', panel:'rgba(28,10,0,0.06)' },
    lime:     { bg:'#D6FF4D', fg:'#0F1405', muted:'#4A5A17', line:'#B4DB2E', accent:'#3A2BFF', accent2:'#E5007E', hi:'#3A2BFF', panel:'rgba(0,0,0,0.04)' },
    pink:     { bg:'#FFC4EC', fg:'#2B0624', muted:'#7D3870', line:'#F09FD8', accent:'#C4007F', accent2:'#4B2CFF', hi:'#C4007F', panel:'rgba(0,0,0,0.04)' },
  };
  const metaTheme = $('meta[name="theme-color"]');
  let currentTheme = 'night';
  function setTheme(name, instant) {
    if (name === currentTheme && !instant) return;
    currentTheme = name;
    const t = THEMES[name];
    const vars = { '--bg':t.bg, '--fg':t.fg, '--muted':t.muted, '--line':t.line, '--accent':t.accent, '--accent-2':t.accent2, '--hi':t.hi, '--panel':t.panel };
    gsap.to(root, { ...vars, duration: instant || reduce ? 0 : 0.8, ease: 'power2.out', overwrite: 'auto' });
    metaTheme.setAttribute('content', t.bg);
    root.style.colorScheme = name === 'night' ? 'dark' : 'light';
  }
  const navLinks = $$('.nav nav a');
  $$('main > section').forEach(sec => {
    ScrollTrigger.create({
      trigger: sec, start: 'top 40%', end: 'bottom 40%',
      onToggle: self => {
        if (!self.isActive) return;
        setTheme(sec.dataset.theme);
        navLinks.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + sec.id));
      }
    });
  });

  /* ------------------------------------------------------------------
     2. WebGL field: domain-warped contour map that bends around the cursor
  ------------------------------------------------------------------ */
  const glCanvas = $('#gl');
  const field = (() => {
    const gl = glCanvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) { root.classList.add('no-gl'); glCanvas.remove(); return null; }
    const vs = `#version 300 es
      in vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
    const fs = `#version 300 es
      precision highp float;
      uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse; uniform float uHover;
      out vec4 o;
      vec2 hash(vec2 p){ p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3))); return -1.0 + 2.0*fract(sin(p)*43758.5453123); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p), u = f*f*(3.0-2.0*f);
        return mix(mix(dot(hash(i),f), dot(hash(i+vec2(1,0)),f-vec2(1,0)), u.x),
                   mix(dot(hash(i+vec2(0,1)),f-vec2(0,1)), dot(hash(i+vec2(1,1)),f-vec2(1,1)), u.x), u.y);
      }
      float fbm(vec2 p){ float v = 0.0, a = 0.5; mat2 r = mat2(0.8,0.6,-0.6,0.8);
        for (int i = 0; i < 4; i++){ v += a*noise(p); p = r*p*2.03 + vec2(1.7,9.2); a *= 0.5; } return v; }
      vec3 ramp(float t){
        t = clamp(t, 0.0, 1.0) * 4.0;
        vec3 c0 = vec3(0.36,0.33,1.00), c1 = vec3(1.00,0.31,0.80), c2 = vec3(1.00,0.52,0.24), c3 = vec3(1.00,0.88,0.30), c4 = vec3(0.30,0.95,0.76);
        if (t < 1.0) return mix(c0,c1,t); if (t < 2.0) return mix(c1,c2,t-1.0); if (t < 3.0) return mix(c2,c3,t-2.0); return mix(c3,c4,t-3.0);
      }
      void main(){
        vec2 uv = gl_FragCoord.xy / uRes;
        vec2 asp = vec2(uRes.x/uRes.y, 1.0);
        vec2 p = (uv - 0.5) * asp * 2.4;
        vec2 m = (uMouse/uRes - 0.5) * asp * 2.4;
        vec2 dm = p - m; float d = length(dm);
        float bump = exp(-d*d*2.6) * uHover;
        float a = bump * 1.8; mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
        vec2 q = m + rot*dm;
        float t = uTime * 0.045;
        vec2 w = vec2(fbm(q*0.85 + vec2(t, -t)), fbm(q*0.85 + vec2(4.0 - t, 1.3 + t)));
        float h = fbm(q*0.75 + w*1.7 + vec2(0.0, t*0.5)) + bump*0.32;
        float N = 15.0;
        float hv = h*N;
        float fw = fwidth(hv);
        float dist = abs(fract(hv - 0.5) - 0.5);
        float line = 1.0 - smoothstep(0.0, fw*1.6, dist);
        float major = 1.0 - smoothstep(0.0, fw*2.6, abs(fract(hv/5.0 - 0.5) - 0.5)*5.0);
        vec3 col = ramp(h*1.15 + 0.5 + bump*0.25);
        vec3 bg = vec3(0.055, 0.043, 0.149);
        float glow = 0.42 + 0.9*bump;
        vec3 c = bg + col*0.05 + col*line*glow*0.85 + col*major*0.35;
        c += col * bump * 0.10;
        float v = smoothstep(1.25, 0.2, length((uv - vec2(0.5,0.55))*vec2(1.0,1.15)));
        c = mix(bg, c, 0.35 + 0.65*v);
        o = vec4(c, 1.0);
      }`;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram();
    try { gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog); }
    catch (err) { console.warn(err); root.classList.add('no-gl'); glCanvas.remove(); return null; }
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = n => gl.getUniformLocation(prog, n);
    const uRes = U('uRes'), uTime = U('uTime'), uMouse = U('uMouse'), uHover = U('uHover');
    let scale = 1, W = 0, H = 0, on = true, raf = 0, simT = 8, lastNow = 0;
    const sm = { x: mouse.x, y: mouse.y, h: 0.55 };
    function resize() {
      scale = Math.min(devicePixelRatio || 1, innerWidth < 760 ? 1 : 1.5);
      W = Math.round(innerWidth * scale); H = Math.round(innerHeight * scale);
      glCanvas.width = W; glCanvas.height = H; gl.viewport(0, 0, W, H);
      if (reduce) frame(performance.now());
    }
    function frame(now) {
      const k = reduce ? 1 : 0.08;
      sm.x += (mouse.x - sm.x) * k; sm.y += (mouse.y - sm.y) * k;
      sm.h += ((mouse.inside ? 1 : 0.55) - sm.h) * 0.04;
      gl.uniform2f(uRes, W, H);
      if (!reduce && !paused && lastNow) simT += Math.min(0.05, (now - lastNow) / 1000);
      lastNow = now;
      gl.uniform1f(uTime, simT);
      gl.uniform2f(uMouse, sm.x * scale, (innerHeight - sm.y) * scale);
      gl.uniform1f(uHover, sm.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function loop(now) { frame(now); raf = on ? requestAnimationFrame(loop) : 0; }
    function show(v) {
      if (v === on) return; on = v;
      gsap.to(glCanvas, { opacity: v ? 1 : 0, duration: 0.6, ease: 'power2.out' });
      if (v && !reduce && !raf) raf = requestAnimationFrame(loop);
    }
    addEventListener('resize', resize); resize();
    if (!reduce) raf = requestAnimationFrame(loop);
    if (reduce) addEventListener('pointermove', () => on && frame(performance.now()), { passive: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { on = false; } else if (glOnWanted) { on = true; if (!reduce && !raf) raf = requestAnimationFrame(loop); } });
    return { show };
  })();
  let heroOn = true, contactOn = false, glOnWanted = true;
  const syncGL = () => { glOnWanted = heroOn || contactOn; field && field.show(glOnWanted); };
  ScrollTrigger.create({ trigger: '.hero', start: 'top bottom', end: 'bottom 15%', onToggle: s => { heroOn = s.isActive; syncGL(); } });
  ScrollTrigger.create({ trigger: '#contact', start: 'top 45%', end: 'bottom top', onToggle: s => { contactOn = s.isActive; syncGL(); } });

  /* ------------------------------------------------------------------
     3. Name: letters stretch and thicken as the cursor passes (variable font axes)
  ------------------------------------------------------------------ */
  const chars = [];
  $$('.name-line').forEach(line => {
    const txt = line.textContent; line.textContent = '';
    for (const ch of txt) { const s = document.createElement('span'); s.className = 'ch'; s.textContent = ch; line.appendChild(s); chars.push({ el: s, w: 75, g: 600, cx: 0, cy: 0 }); }
  });
  function measureChars() {
    chars.forEach(c => { c.el.style.setProperty('--w', 75); c.el.style.setProperty('--g', 600); });
    chars.forEach(c => { const r = c.el.getBoundingClientRect(); c.cx = r.left + r.width / 2; c.cy = r.top + r.height / 2 + scrollY; c.w = 75; c.g = 600; });
  }
  if (!reduce) {
    gsap.ticker.add(() => {
      if (!heroOn) return;
      const R = Math.max(180, innerWidth * 0.16);
      for (const c of chars) {
        const dx = mouse.x - c.cx, dy = mouse.y - (c.cy - scrollY);
        const d = Math.hypot(dx, dy * 1.4);
        const k = mouse.inside ? Math.max(0, 1 - d / R) : 0;
        const e = k * k * (3 - 2 * k);
        c.w += (75 + 25 * e - c.w) * 0.14; c.g += (600 + 100 * e - c.g) * 0.14;
        c.el.style.setProperty('--w', c.w.toFixed(2)); c.el.style.setProperty('--g', c.g.toFixed(1));
      }
    });
  }

  /* intro: one orchestrated entrance */
  function intro() {
    measureChars();
    if (reduce) { gsap.set('#hint', { opacity: 1 }); return; }
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.from(chars.map(c => c.el), { yPercent: 110, opacity: 0, duration: 1.3, stagger: 0.045 })
      .from('.hero-foot > *', { y: 24, opacity: 0, duration: 1, stagger: 0.09 }, '-=0.9')
      .from('.nav > *', { y: -16, opacity: 0, duration: 0.8, stagger: 0.08 }, '<')
      .to('#hint', { opacity: 1, duration: 1 }, '-=0.4');
  }

  /* ------------------------------------------------------------------
     4. Cursor, magnetic buttons, tilt panels (fine pointers only)
  ------------------------------------------------------------------ */
  if (finePointer && !reduce) {
    root.classList.add('has-cursor');
    const cur = $('.cursor'), ring = $('.cursor-ring'), dot = $('.cursor-dot'), label = $('.cursor-label');
    const rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' }), ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' });
    const dx = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'power3' }), dy = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'power3' });
    gsap.set([ring, dot], { x: mouse.x, y: mouse.y });
    addEventListener('pointermove', e => { rx(e.clientX); ry(e.clientY); dx(e.clientX); dy(e.clientY); }, { passive: true });
    document.addEventListener('pointerleave', () => gsap.to(cur, { opacity: 0, duration: 0.2 }));
    document.addEventListener('pointerenter', () => gsap.to(cur, { opacity: 1, duration: 0.2 }));
    addEventListener('pointerdown', () => cur.classList.add('is-down'));
    addEventListener('pointerup', () => cur.classList.remove('is-down'));
    document.addEventListener('pointerover', e => {
      const t = e.target.closest('[data-cursor], a, button, [data-tilt], .matrix th[tabindex], .laptop');
      cur.classList.remove('is-hover', 'is-label');
      if (!t) return;
      if (t.dataset.cursor) { label.textContent = t.dataset.cursor; cur.classList.add('is-label'); }
      else cur.classList.add('is-hover');
    });

    $$('[data-magnetic]').forEach(el => {
      const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.45)' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.45)' });
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.35); yTo((e.clientY - (r.top + r.height / 2)) * 0.35);
      });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });

    $$('[data-tilt]').forEach(el => {
      const rX = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3' }), rY = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3' });
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        rY((px - 0.5) * 9); rX((0.5 - py) * 9);
        el.style.setProperty('--gx', (px * 100).toFixed(1) + '%'); el.style.setProperty('--gy', (py * 100).toFixed(1) + '%'); el.style.setProperty('--go', 1);
      });
      el.addEventListener('pointerleave', () => { rX(0); rY(0); el.style.setProperty('--go', 0); });
    });
  }

  /* ------------------------------------------------------------------
     6. Research: unit chart, score bars, pipeline progress
  ------------------------------------------------------------------ */
  const grid = $('#unitsGrid');
  const squares = [];
  for (let i = 0; i < 100; i++) { const s = document.createElement('span'); if (i < 55) s.className = 'hit'; grid.appendChild(s); squares.push(s); }
  let unitsReady = reduce;
  if (!reduce) {
    gsap.from(squares, {
      scale: 0, rotation: -45, duration: 0.6, ease: 'back.out(2)',
      stagger: { grid: [10, 10], from: 'start', amount: 0.9 },
      scrollTrigger: { trigger: grid, start: 'top 80%', once: true },
      onComplete: () => { unitsReady = true; }
    });
    const sTo = squares.map(s => gsap.quickTo(s, 'scale', { duration: 0.4, ease: 'power3' }));
    const units = $('#units');
    let centres = [];
    const measure = () => { centres = squares.map(s => { const r = s.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); };
    units.addEventListener('pointermove', e => {
      if (!unitsReady) return;
      if (!centres.length) measure();
      centres.forEach(([cx, cy], i) => sTo[i](1 + 0.45 * Math.max(0, 1 - Math.hypot(e.clientX - cx, e.clientY - cy) / 110)));
    });
    addEventListener('scroll', () => { centres = []; }, { passive: true });
    units.addEventListener('pointerleave', () => sTo.forEach(f => f(1)));

    $$('.bar i').forEach(i => gsap.fromTo(i, { scaleX: 0 }, {
      scaleX: parseFloat(i.style.getPropertyValue('--w')), duration: 1.4, ease: 'expo.out',
      scrollTrigger: { trigger: '#score', start: 'top 85%', once: true }
    }));
  }
  const steps = $$('.pipe li');
  gsap.to('#pipeFill', {
    scaleX: 1, ease: 'none',
    scrollTrigger: {
      trigger: '#pipeline', start: 'top 80%', end: 'bottom 60%', scrub: reduce ? true : 0.6,
      onUpdate: self => steps.forEach((li, i) => li.classList.toggle('lit', self.progress >= i / (steps.length - 1) - 0.02))
    }
  });

  /* ------------------------------------------------------------------
     7. Count-ups
  ------------------------------------------------------------------ */
  $$('[data-count]').forEach(el => {
    const to = +el.dataset.count;
    if (reduce) return;
    const o = { v: 0 };
    gsap.to(o, { v: to, duration: 1.6, ease: 'power3.out', onUpdate: () => { el.textContent = Math.round(o.v); },
      scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
    el.textContent = '0';
  });

  /* ------------------------------------------------------------------
     8. DDoS demo: hover a layer to send attack traffic at the filter
  ------------------------------------------------------------------ */
  (function ddos() {
    const cv = $('#ddosCanvas'), ctx = cv.getContext('2d'), out = $('#blocked');
    const INK = '#1C0A00', CREAM = '#FFF0E3', FLASH = '#FFE14D';
    const LAYERS = [['Layer 7', 'Application'], ['Layer 4', 'Transport'], ['Layer 3', 'Network']];
    let W, H, dpr, labelW, shieldX, laneH, packets = [], hot = -1, hotUntil = 0, blocked = 0, running = false, last = 0;
    const flash = [0, 0, 0], acc = [0, 0, 0], accU = [0, 0, 0];
    function size() {
      const r = cv.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, 2);
      W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      labelW = Math.min(150, W * 0.24); shieldX = labelW + (W - labelW) * 0.64; laneH = H / 3;
      if (!running) draw();
    }
    function spawn(lane, type) {
      const y = lane * laneH + laneH * (0.22 + Math.random() * 0.56);
      packets.push({ lane, type, x: labelW - 10, y, vx: type === 'atk' ? 150 + Math.random() * 170 : 110 + Math.random() * 60, vy: 0, a: 1, st: 'fly' });
    }
    function step(dt, now) {
      for (let l = 0; l < 3; l++) {
        const isHot = l === hot || now < hotUntil && l === hot;
        acc[l] += dt * (isHot ? 34 : 2.4); accU[l] += dt * 1.6;
        while (acc[l] >= 1) { acc[l] -= 1; spawn(l, 'atk'); }
        while (accU[l] >= 1) { accU[l] -= 1; spawn(l, 'usr'); }
        flash[l] = Math.max(0, flash[l] - dt * 3);
      }
      for (const p of packets) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.st === 'fly' && p.type === 'atk' && p.x >= shieldX - 6) {
          p.st = 'hit'; p.x = shieldX - 6; p.vx = -(40 + Math.random() * 120); p.vy = (Math.random() - 0.5) * 220;
          flash[p.lane] = 1; blocked++;
        }
        if (p.st === 'hit') { p.a -= dt * 1.8; p.vy *= 0.96; }
      }
      packets = packets.filter(p => p.a > 0 && p.x < W + 10 && p.x > labelW - 20);
      if (packets.length > 900) packets.splice(0, packets.length - 900);
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.font = `600 ${W < 500 ? 14 : 16}px "Instrument Sans", system-ui, sans-serif`;
      for (let l = 0; l < 3; l++) {
        const y0 = l * laneH;
        if (l) { ctx.fillStyle = 'rgba(28,10,0,0.18)'; ctx.fillRect(16, y0, W - 32, 1); }
        if (l === hot) { ctx.fillStyle = 'rgba(28,10,0,0.07)'; ctx.fillRect(0, y0, W, laneH); }
        ctx.fillStyle = INK; ctx.font = `700 ${W < 500 ? 14 : 17}px "Instrument Sans", system-ui, sans-serif`;
        ctx.fillText(LAYERS[l][0], 20, y0 + laneH / 2 - 2);
        ctx.font = `500 ${W < 500 ? 12 : 13}px "Instrument Sans", system-ui, sans-serif`; ctx.fillStyle = 'rgba(28,10,0,0.7)';
        ctx.fillText(LAYERS[l][1], 20, y0 + laneH / 2 + 18);
        // filter
        const f = flash[l];
        ctx.fillStyle = f > 0.02 ? FLASH : CREAM;
        ctx.shadowColor = FLASH; ctx.shadowBlur = 24 * f;
        const sh = laneH * 0.62; roundRect(shieldX - 3, y0 + (laneH - sh) / 2, 6, sh, 3); ctx.fill();
        ctx.shadowBlur = 0;
      }
      // origin
      ctx.fillStyle = 'rgba(28,10,0,0.55)'; ctx.font = `600 12px "Instrument Sans", system-ui, sans-serif`;
      ctx.textAlign = 'right'; ctx.fillText('Origin', W - 18, 22); ctx.textAlign = 'left';
      for (const p of packets) {
        ctx.globalAlpha = Math.max(0, p.a);
        if (p.type === 'atk') { ctx.fillStyle = INK; ctx.fillRect(p.x - 3, p.y - 3, 6, 6); }
        else { ctx.fillStyle = CREAM; ctx.beginPath(); ctx.arc(p.x, p.y, 4.2, 0, 6.283); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
    }
    function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    let shown = 0;
    function loop(now) {
      if (!running) return;
      const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
      if (hot >= 0 && hotUntil && now > hotUntil) { hot = -1; hotUntil = 0; }
      if (!paused) step(dt, now);
      draw();
      if (blocked !== shown) { shown = blocked; out.textContent = blocked.toLocaleString('en-GB'); }
      requestAnimationFrame(loop);
    }
    const laneAt = e => { const r = cv.getBoundingClientRect(); return Math.min(2, Math.max(0, Math.floor((e.clientY - r.top) / laneH))); };
    cv.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { hot = laneAt(e); hotUntil = 0; } });
    cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hot = -1; });
    cv.addEventListener('pointerdown', e => { hot = laneAt(e); hotUntil = performance.now() + 1800; });
    cv.addEventListener('keydown', e => {
      const lane = { '7': 0, '4': 1, '3': 2 }[e.key];
      if (lane === undefined) return;
      e.preventDefault(); hot = lane; hotUntil = performance.now() + 1800;
    });
    addEventListener('resize', size); size();
    if (reduce) {
      for (let l = 0; l < 3; l++) for (let k = 0; k < 14; k++) { spawn(l, k % 4 ? 'atk' : 'usr'); const p = packets[packets.length - 1]; p.x = labelW + Math.random() * (shieldX - labelW - 10); }
      draw(); return;
    }
    ScrollTrigger.create({ trigger: cv, start: 'top bottom', end: 'bottom top',
      onToggle: s => { running = s.isActive; if (running) { last = 0; requestAnimationFrame(loop); } } });
  })();

  /* ------------------------------------------------------------------
     9. Projects: sepsis pins, coordinator election demo
  ------------------------------------------------------------------ */
  if (!reduce) $$('#sepsisPlot .pin').forEach((g, i) => gsap.from(g, {
    x: -(+g.dataset.x - 20), opacity: 0, duration: 1.4, delay: i * 0.15, ease: 'expo.out',
    scrollTrigger: { trigger: '#sepsisPlot', start: 'top 85%', once: true }
  }));

  (function election() {
    const svg = $('#chatPlot'), status = $('#chatStatus'), NS = 'http://www.w3.org/2000/svg';
    const el = (n, a, parent = svg) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); parent.appendChild(e); return e; };
    const nodes = [
      { id: 1, name: 'A', x: 62, y: 44 }, { id: 2, name: 'B', x: 258, y: 44 },
      { id: 3, name: 'C', x: 62, y: 156 }, { id: 4, name: 'D', x: 258, y: 156 },
    ];
    const linkG = el('g', {}), clientG = el('g', {}), msgG = el('g', {}), nodeG = el('g', {});
    const halo = el('circle', { r: 30, class: 'halo' }, nodeG);
    nodes.forEach(n => {
      n.alive = true;
      const out = Math.atan2(n.y - 100, n.x - 160);
      for (let k = 0; k < 5; k++) {
        const a = out + (k - 2) * 0.42;
        el('line', { x1: n.x, y1: n.y, x2: n.x + Math.cos(a) * 36, y2: n.y + Math.sin(a) * 36, class: 'link' }, clientG);
        el('circle', { cx: n.x + Math.cos(a) * 36, cy: n.y + Math.sin(a) * 36, r: 3.2, class: 'client' }, clientG);
      }
      n.g = el('g', { class: 'laptop', tabindex: 0, role: 'button' }, nodeG);
      el('rect', { x: n.x - 17, y: n.y - 13, width: 34, height: 26, rx: 6 }, n.g);
      const t = el('text', { x: n.x, y: n.y + 4.5, 'text-anchor': 'middle' }, n.g); t.textContent = n.name;
      n.g.addEventListener('click', () => toggle(n));
      n.g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(n); } });
    });
    let coord = nodes[3];
    function render() {
      linkG.innerHTML = '';
      nodes.forEach(n => {
        n.g.classList.toggle('coord', n === coord && n.alive);
        n.g.classList.toggle('off', !n.alive);
        n.g.setAttribute('aria-label', `Laptop ${n.name}, ${!n.alive ? 'offline' : n === coord ? 'coordinator' : 'online'}. Press to ${n.alive ? 'take offline' : 'bring back online'}.`);
        if (n.alive && n !== coord && coord) el('line', { x1: n.x, y1: n.y, x2: coord.x, y2: coord.y, class: 'link' }, linkG);
      });
      if (coord) gsap.to(halo, { attr: { cx: coord.x, cy: coord.y }, duration: reduce ? 0 : 0.6, ease: 'expo.out' });
      halo.style.display = coord ? '' : 'none';
    }
    function toggle(n) {
      const alive = nodes.filter(x => x.alive);
      if (n.alive && alive.length === 1) { status.textContent = 'At least one laptop has to stay online.'; return; }
      n.alive = !n.alive;
      if (!n.alive && n === coord) {
        coord = null; render();
        status.textContent = `Laptop ${n.name} went offline. Electing a new coordinator…`;
        setTimeout(() => {
          coord = nodes.filter(x => x.alive).sort((a, b) => b.id - a.id)[0];
          render(); status.textContent = `Laptop ${coord.name} is the new coordinator. Messages keep flowing.`;
        }, 900);
      } else {
        render();
        status.textContent = n.alive ? `Laptop ${n.name} rejoined.` : `Laptop ${n.name} went offline. Click it to bring it back.`;
      }
    }
    render();
    if (!reduce) gsap.to(halo, { attr: { r: 36 }, opacity: 0.15, duration: 1.1, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    let timer = null;
    function send() {
      const alive = nodes.filter(x => x.alive && x !== coord);
      if (paused || !coord || alive.length < 1) return;
      const src = alive[Math.floor(Math.random() * alive.length)];
      const targets = nodes.filter(x => x.alive && x !== src && x !== coord);
      const dst = targets.length ? targets[Math.floor(Math.random() * targets.length)] : null;
      const m = el('circle', { r: 4, class: 'msg', cx: src.x, cy: src.y }, msgG);
      const tl = gsap.timeline({ onComplete: () => m.remove() });
      tl.to(m, { attr: { cx: coord.x, cy: coord.y }, duration: 0.55, ease: 'power2.inOut' });
      if (dst) tl.to(m, { attr: { cx: dst.x, cy: dst.y }, duration: 0.55, ease: 'power2.inOut' });
      tl.to(m, { opacity: 0, duration: 0.2 });
    }
    if (!reduce) ScrollTrigger.create({ trigger: svg, start: 'top bottom', end: 'bottom top',
      onToggle: s => { clearInterval(timer); if (s.isActive) timer = setInterval(send, 520); } });
  })();

  /* ------------------------------------------------------------------
     10. Toolkit matrix
  ------------------------------------------------------------------ */
  (function matrix() {
    const projects = [['bias', 'Bias detector'], ['sepsis', 'Sepsis model'], ['cfsupport', 'Cloudflare support'], ['onboard', 'Onboarding tool'], ['hack', 'Hackathon'], ['events', 'Event planner'], ['chat', 'Chat system']];
    const pname = Object.fromEntries(projects);
    const prose = { bias: 'the bias detector', sepsis: 'the sepsis model', cfsupport: 'debugging at Cloudflare', onboard: 'the onboarding tool', hack: 'the hackathon', events: 'the event planner', chat: 'the chat system' };
    const tools = [
      ['Python', ['bias', 'sepsis', 'cfsupport', 'onboard']], ['PyTorch', ['bias', 'sepsis']], ['scikit-learn', ['sepsis']],
      ['pandas and NumPy', ['sepsis']], ['FastAPI', ['bias']], ['Workers AI', ['hack']], ['MCP servers', ['onboard']],
      ['HTML and CSS', ['onboard']], ['Shell scripting', ['cfsupport']], ['Networking tools', ['cfsupport']],
      ['DDoS, WAF, TLS', ['cfsupport']], ['JIRA, PagerDuty', ['cfsupport']], ['Kotlin', ['events']], ['Scala', ['events']],
      ['SQLite, JDBC', ['events']], ['Java, sockets', ['chat']], ['JUnit', ['chat']],
    ];
    const blurb = {
      bias: 'Python, PyTorch and FastAPI, behind a Chrome extension.', sepsis: 'Python, PyTorch, scikit-learn, pandas and NumPy.',
      cfsupport: 'Python and shell scripts, networking tools, DDoS, WAF and TLS labs, JIRA and PagerDuty.',
      onboard: 'Python, HTML and CSS, plus an MCP server linking it to an internal AI assistant.', hack: 'Built on Workers AI in a team of four.',
      events: 'Kotlin and Scala, with SQLite through JDBC.', chat: 'Java and sockets, tested with JUnit.',
    };
    const m = $('#matrix');
    let h = '<thead><tr><td></td>' + projects.map(([id, n]) => `<th scope="col" data-p="${id}" tabindex="0"><span>${n}</span></th>`).join('') + '</tr></thead><tbody>';
    tools.forEach(([name, used], ri) => {
      h += `<tr><th scope="row" data-t="${ri}" tabindex="0">${name}</th>` + projects.map(([id]) =>
        `<td data-p="${id}" data-t="${ri}">${used.includes(id) ? `<span class="dot" role="img" aria-label="${name} used in ${pname[id]}"></span>` : ''}</td>`).join('') + '</tr>';
    });
    m.insertAdjacentHTML('beforeend', h + '</tbody>');
    const title = $('#traceTitle'), text = $('#traceText');
    const list = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
    const clear = () => { m.classList.remove('dim'); $$('.hl,.hl-cell,.on', m).forEach(e => e.classList.remove('hl', 'hl-cell', 'on')); };
    function showTool(ri) {
      clear(); m.classList.add('dim');
      const [name, used] = tools[ri];
      $$(`[data-t="${ri}"]`, m).forEach(e => { e.classList.add(e.tagName === 'TH' ? 'hl' : 'hl-cell'); const d = $('.dot', e); d && d.classList.add('on'); });
      used.forEach(p => $(`thead [data-p="${p}"] span`, m).classList.add('hl'));
      title.textContent = name; text.textContent = 'Used in ' + list(used.map(p => prose[p])) + '.';
    }
    function showProj(p) {
      clear(); m.classList.add('dim');
      $$(`[data-p="${p}"]`, m).forEach(e => {
        if (e.tagName === 'TH') $('span', e).classList.add('hl');
        else { e.classList.add('hl-cell'); const d = $('.dot', e); if (d) { d.classList.add('on'); $(`tbody th[data-t="${e.dataset.t}"]`, m).classList.add('hl'); } }
      });
      title.textContent = pname[p]; text.textContent = blurb[p];
    }
    const pick = e => { const c = e.target.closest('[data-t],[data-p]'); if (!c) return; c.dataset.t !== undefined ? showTool(+c.dataset.t) : showProj(c.dataset.p); };
    m.addEventListener('pointerover', pick); m.addEventListener('focusin', pick);
    m.addEventListener('pointerleave', clear); m.addEventListener('focusout', clear);
  })();

  /* ------------------------------------------------------------------
     11. Timeline: draggable with inertia
  ------------------------------------------------------------------ */
  (function timeline() {
    const SPAN = 23, pct = v => (v / SPAN * 100) + '%', now = 21 + 9 / 30;
    const MONTHS = ['Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const C = { proj: '#4DF2C3', diss: '#8B7BFF', cf: '#FF6B2C', com: '#FF5FCB' };
    const lanes = [
      { name: 'Projects', rows: [
        [{ s: 0, e: 3, l: 'Distributed chat system', c: C.proj, tip: 'Feb to Apr 2025. Java, sockets and JUnit.' }, { s: 8, e: 18, l: 'Political bias dissertation', c: C.diss, in: 1, tip: 'Oct 2025 to Jul 2026. Recommended for publication.' }],
        [{ s: 8, e: 11, l: 'Sepsis prediction', c: C.proj, tip: 'Oct to Dec 2025. PyTorch LSTM on 5,044 ICU stays.' }],
        [{ s: 8, e: 11, l: 'Event planner, as team lead', c: C.proj, tip: 'Oct to Dec 2025. Led a team of three.' }],
      ] },
      { name: 'Work', rows: [[{ s: 17, e: 20, l: 'Cloudflare', c: C.cf, in: 1, tip: 'Jul to Sep 2026. Technical Support Engineer Intern.' }]] },
      { name: 'Community', rows: [
        [{ s: 7, e: 18, l: 'Greenwich Debate Society', c: C.com, in: 1, ring: 1, tip: 'Sep 2025 to Jul 2026.' }],
        [{ s: 20, e: now, l: 'Guest speaker at Greenwich', c: C.com, open: 1, left: 1, tip: 'Since Oct 2026. Talks for Data Science master’s students.' }],
      ] },
      { name: 'Milestones', rows: [[{ ms: 18, l: 'Graduated with First-Class Honours', tip: 'July 2026. BSc Computer Science, University of Greenwich.' }], [{ ms: 21, l: 'AWS Cloud Essentials badge', tip: 'October 2026.' }]] },
    ];
    const tl = $('#tl');
    let h = '<div class="tl-axis">';
    for (let i = 0; i <= SPAN; i++) h += `<i class="tick${i === 11 ? ' y' : ''}" style="left:${pct(i)}"></i>`;
    MONTHS.forEach((m, i) => { h += `<span class="mo" style="left:${pct(i + 0.5)}">${m}</span>`; });
    h += `<span class="yr" style="left:0;bottom:30px">2025</span><span class="yr" style="left:${pct(11)};bottom:30px">2026</span></div>`;
    lanes.forEach(L => {
      h += `<div class="tl-lane"><span class="tl-lane-name">${L.name}</span>`;
      L.rows.forEach(row => {
        h += '<div class="tl-row">';
        row.forEach(b => {
          if (b.ms !== undefined) { h += `<div class="tl-ms" data-tip="${b.tip}" style="left:${pct(b.ms)}"><span>${b.l}</span></div>`; return; }
          const cls = 'tl-bar' + (b.ring ? ' ring' : '') + (b.open ? ' open' : '');
          h += `<div class="${cls}" data-tip="${b.tip}" style="--c:${b.c};left:${pct(b.s)};width:calc(${pct(b.e - b.s)} - 4px)">${b.in ? b.l : ''}</div>`;
          if (!b.in) h += `<span class="tl-lab${b.left ? ' left' : ''}" style="left:calc(${pct(b.left ? b.s : b.e)} ${b.left ? '- 12px' : '+ 10px'})">${b.l}</span>`;
        });
        h += '</div>';
      });
      h += '</div>';
    });
    h += `<div class="tl-now" style="left:calc(140px + (100% - 140px) * ${now / SPAN})"><span>Now</span></div>`;
    tl.innerHTML = h;
    const vp = $('#tlViewport'), hint = $('.tl-controls');
    // Drag only when the track is wider than the screen; otherwise it simply fits.
    const overflow = () => Math.max(0, tl.offsetWidth - vp.clientWidth);
    const [drag] = Draggable.create(tl, { type: 'x', inertia: true, bounds: { minX: -overflow(), maxX: 0 }, edgeResistance: 0.85, allowNativeTouchScrolling: true });
    function fit() {
      const o = overflow();
      drag.applyBounds({ minX: -o, maxX: 0 });
      if (o > 0) { drag.enable(); vp.dataset.cursor = 'Drag'; hint.hidden = false; }
      else { drag.disable(); gsap.set(tl, { x: 0 }); delete vp.dataset.cursor; hint.hidden = true; }
      return o;
    }
    addEventListener('resize', fit);
    // On narrow screens start at the most recent end, then nudge to show it moves.
    if (fit() > 0) {
      gsap.set(tl, { x: -overflow() }); drag.update();
      if (!reduce) ScrollTrigger.create({ trigger: vp, start: 'top 75%', once: true, onEnter: () => {
        gsap.timeline().to(tl, { x: -overflow() + 120, duration: 0.9, ease: 'power3.inOut' })
          .to(tl, { x: -overflow(), duration: 1, ease: 'elastic.out(1, 0.6)', onComplete: () => drag.update() });
      } });
    }
    // Keyboard and button alternatives to dragging
    const nudge = dir => {
      const o = overflow(); if (!o) return;
      const x = gsap.getProperty(tl, 'x') + dir * Math.max(200, vp.clientWidth * 0.6);
      gsap.to(tl, { x: Math.max(-o, Math.min(0, x)), duration: reduce ? 0 : 0.5, ease: 'power3.out', onComplete: () => drag.update() });
    };
    vp.addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault(); nudge(e.key === 'ArrowLeft' ? 1 : -1);
    });
    $('#tlPrev').addEventListener('click', () => nudge(1));
    $('#tlNext').addEventListener('click', () => nudge(-1));

    // Hover details that follow the cursor
    const tip = document.createElement('div'); tip.className = 'tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip);
    const tx = gsap.quickTo(tip, 'x', { duration: 0.25, ease: 'power3' }), ty = gsap.quickTo(tip, 'y', { duration: 0.25, ease: 'power3' });
    tl.addEventListener('pointermove', e => {
      const t = e.target.closest('[data-tip]');
      if (!t || e.pointerType !== 'mouse') { tip.classList.remove('on'); return; }
      tip.textContent = t.dataset.tip; tip.classList.add('on'); tx(e.clientX + 18); ty(e.clientY + 18);
    });
    tl.addEventListener('pointerleave', () => tip.classList.remove('on'));
  })();

  /* ------------------------------------------------------------------
     12. Contact: scramble, copy, live network trace
  ------------------------------------------------------------------ */
  const email = $('#email');
  if (!reduce) email.addEventListener('pointerenter', () => gsap.to(email, { duration: 0.9, scrambleText: { text: 'chiticrobert@yahoo.com', chars: '01', speed: 0.5, revealDelay: 0.15 }, overwrite: true }));
  const motionBtn = $('#motionToggle');
  if (reduce) motionBtn.hidden = true;
  motionBtn.addEventListener('click', () => {
    paused = !paused;
    root.classList.toggle('motion-paused', paused);
    motionBtn.setAttribute('aria-pressed', String(paused));
    motionBtn.textContent = paused ? 'Resume animations' : 'Pause animations';
  });
  const copy = $('#copy');
  copy.addEventListener('click', async () => {
    const status = $('#copyStatus');
    try { await navigator.clipboard.writeText('chiticrobert@yahoo.com'); copy.textContent = 'Copied'; status.textContent = 'Email address copied.'; }
    catch {
      copy.textContent = 'chiticrobert@yahoo.com';
      const r = document.createRange(); r.selectNodeContents(email); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      status.textContent = 'Copying is blocked here. The address is selected so you can copy it yourself.';
    }
    setTimeout(() => { copy.textContent = 'Copy email'; status.textContent = ''; }, 2200);
  });
  fetch('/cdn-cgi/trace', { cache: 'no-store' }).then(r => r.ok ? r.text() : null).then(txt => {
    if (!txt) return;
    const kv = Object.fromEntries(txt.trim().split('\n').map(l => l.split('=')));
    if (!kv.colo) return;
    const http = (kv.http || '').toUpperCase(), tls = (kv.tls || '').replace('TLSv', 'TLS ');
    const p = $('#trace');
    p.textContent = `This page reached you through Cloudflare’s ${kv.colo} data centre` + (http ? ` over ${http}` : '') + (tls ? ` and ${tls}` : '') + '.';
    p.hidden = false;
  }).catch(() => {});

  /* ------------------------------------------------------------------
     Go
  ------------------------------------------------------------------ */
  setTheme('night', true);
  document.fonts.ready.then(() => {
    intro();
    ScrollTrigger.refresh();
  });
  addEventListener('resize', () => { if (heroOn) measureChars(); });
})();
