// Saludo del personaje al visitante (solo escritorio con movimiento: html.pin).
// · El scroll solo lo DISPARA, al cruzar un umbral bajando. La animación va por tiempo en scene.js
//   (máquina de estados idle → waving → returning → idle, un único timeline reutilizado).
// · Re-armado con histéresis: hay que volver arriba del todo Y que pasen 5 s desde el último saludo.
// · Burbuja «¡Hola! Soy Javi»: overlay HTML (texto nítido), un único elemento reutilizado,
//   atado a la misma máquina de estados. Decorativa (aria-hidden).

const TRIGGER_F = 0.12;      // disparo: 12 % del primer paso del hero (≈ 120–140 px de scroll)
const REARM_F = 0.03;        // «arriba del todo» para re-armar (por encima del umbral de disparo)
const COOLDOWN_MS = 5000;    // mínimo desde el final del último saludo
const LATE_MAX_F = 0.5;      // si la escena aún cargaba al cruzar: saluda al estar lista, si sigue en el paso 1
const LATE_TTL_MS = 4000;
const TEXT = '¡Hola! Soy Javi';
const CHAR_S = 0.034;        // segundos por letra: completa en ~0,5 s, mucho antes de acabar el saludo

export function createWave({ hero, steps }) {
  const root = document.documentElement;
  const stage = hero.querySelector('.hero__stage');
  const n = steps.length;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const enabled = () => !reduce && root.classList.contains('pin');
  const bubble = createBubble(stage, steps);
  let scene = null;
  let prevF = null, prevY = window.scrollY, lastF = 0;
  let vw = innerWidth, vh = innerHeight, resizedAt = 0;
  let lateAt = 0;

  // ¿Cargó arriba del todo? En recargas, «atrás» o con ancla el navegador puede restaurar el scroll
  // después: en esos casos se decide con la primera interacción real (antes de que mueva nada)
  const nav = performance.getEntriesByType?.('navigation')?.[0];
  const fresh = (!nav || nav.type === 'navigate') && !location.hash;
  let atTop = fresh && window.scrollY < 4;
  if (!fresh) {
    const evs = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
    const first = () => { if (window.scrollY < 4) atTop = true; evs.forEach((e) => removeEventListener(e, first, true)); };
    evs.forEach((e) => addEventListener(e, first, { capture: true, passive: true }));
  }
  addEventListener('resize', () => { resizedAt = performance.now(); bubble.invalidate(); }, { passive: true });

  const lastEnd = () => (scene ? scene.wave.lastEnd : -Infinity);

  function crossed() {
    const ok = atTop && enabled() && performance.now() - lastEnd() >= COOLDOWN_MS;
    atTop = false;                                   // el cruce consume el re-armado, salude o no
    if (!ok) return;
    if (scene) scene.wave.trigger();                 // si no está en idle, la escena lo ignora
    else lateAt = performance.now();                 // la escena aún se está cargando
  }

  // progress: 0..1 del hero fijado (ScrollTrigger). Solo cuenta un cruce real hacia abajo:
  // nunca al subir ni por un refresh/resize (cambia el progreso sin que el usuario haga scroll).
  function onScroll(progress) {
    const f = progress * (n - 1);
    const y = window.scrollY;
    const now = performance.now();
    if (innerWidth !== vw || innerHeight !== vh) { vw = innerWidth; vh = innerHeight; resizedAt = now; }
    const refreshing = !!window.ScrollTrigger?.isRefreshing || now - resizedAt < 300;
    if (f <= REARM_F) atTop = true;
    if (prevF === null) {
      // primera lectura: si venía de arriba y ya pasó el umbral mientras cargaba GSAP, cuenta como cruce
      if (!refreshing && f >= TRIGGER_F && f <= LATE_MAX_F) crossed();
    } else if (!refreshing && y > prevY && prevF < TRIGGER_F && f >= TRIGGER_F) {
      crossed();
    }
    if (lateAt && (f < TRIGGER_F || f > LATE_MAX_F)) lateAt = 0;
    prevF = f; prevY = y; lastF = f;
  }

  function attach(s) {
    scene = s;
    s.onWave(onFrame);
    if (lateAt) {
      const at = lateAt;
      lateAt = 0;
      setTimeout(() => {   // deja que el canvas aparezca antes de saludar
        if (performance.now() - at < LATE_TTL_MS && lastF >= TRIGGER_F && lastF <= LATE_MAX_F && enabled()) s.wave.trigger();
      }, 350);
    }
  }

  // El saludo deja de verse (fling más allá del hero, cambio a layout móvil): vuelve a la pose
  // normal con una transición suave (se completa en cuanto la escena se vuelva a pintar) y la burbuja se va con él
  function cancel() {
    lateAt = 0;
    scene?.wave.cancel();
    bubble.hide();
  }

  function onFrame(info) {
    if (!enabled() || !info.bubble || !info.visible) { bubble.hide(); return; }
    const chars = Math.min(TEXT.length, Math.max(1, Math.floor((info.t - info.bubbleAt) / CHAR_S) + 1));
    bubble.show(chars);
    bubble.place(info);
  }

  return { onScroll, attach, cancel };
}

/* ---------------------------------------------------------------- burbuja */
function createBubble(stage, steps) {
  let el = null, typedEl = null, restEl = null, tailEl = null;
  let visible = false, chars = -1, cand = -1, px = 0, py = 0, placed = false;
  let size = null, chrome = null;
  // direcciones candidatas alrededor de la cabeza (pantalla): arriba, arriba-dcha, arriba-izq, lados…
  const CANDS = [-90, -58, -122, -30, -150, 0, 180, 40, 140].map((d) => (d * Math.PI) / 180);
  const GAP = 20;

  function ensure() {
    if (el) return;
    el = stage.querySelector('.hero-bubble');        // como máximo un elemento, siempre reutilizado
    if (!el) {
      el = document.createElement('div');
      el.className = 'hero-bubble';
      el.setAttribute('aria-hidden', 'true');
      el.innerHTML = '<i class="hero-bubble__c hero-bubble__c--tl"></i><i class="hero-bubble__c hero-bubble__c--tr"></i>'
        + '<i class="hero-bubble__c hero-bubble__c--bl"></i><i class="hero-bubble__c hero-bubble__c--br"></i>'
        + '<span class="hero-bubble__text"><span class="hero-bubble__typed"></span><span class="hero-bubble__caret"></span><span class="hero-bubble__rest"></span></span>'
        + '<svg class="hero-bubble__tail" width="18" height="13" viewBox="0 0 18 13"><path class="hero-bubble__tailFill" d="M0 -1.5H18L9 13Z"/><path class="hero-bubble__tailLine" d="M0.5 0L9 12.3L17.5 0"/></svg>';
      stage.appendChild(el);
    }
    typedEl = el.querySelector('.hero-bubble__typed');
    restEl = el.querySelector('.hero-bubble__rest');
    tailEl = el.querySelector('.hero-bubble__tail');
  }

  function show(c) {
    ensure();
    if (c !== chars) {
      chars = c;
      typedEl.textContent = TEXT.slice(0, c);
      restEl.textContent = TEXT.slice(c);            // invisible: la caja tiene desde el principio su tamaño final
      el.classList.toggle('is-typing', c < TEXT.length);
    }
    if (!visible) { visible = true; placed = false; cand = -1; el.classList.add('is-visible'); }
  }

  function hide() {
    if (!visible) return;
    visible = false;
    el.classList.remove('is-visible');
  }

  function invalidate() { size = null; chrome = null; }

  // zona segura: bajo la cabecera, sin pisar redes, progreso, CV ni la pista inferior
  function safeArea(W, H) {
    if (!chrome) {
      const sr = stage.getBoundingClientRect();
      const r = (sel) => document.querySelector(sel)?.getBoundingClientRect();
      const header = r('.site-header'), rail = r('.social-rail'), prog = r('.hero__progress');
      chrome = {
        top: Math.max(12, (header ? header.bottom - sr.top : 72) + 8),
        left: Math.max(12, rail && rail.width ? rail.right - sr.left + 12 : 72),
        right: Math.min(W - 12, prog && prog.width ? prog.left - sr.left - 14 : W - 80),
        bottom: H - 72,
      };
    }
    return chrome;
  }

  // zonas que la burbuja no debe tapar: textos y tarjetas de los pasos visibles + la mano que saluda
  function avoidRects(sr, info, sx, sy) {
    const out = [];
    steps.forEach((step) => {
      if ((parseFloat(step.style.opacity) || 0) < 0.08) return;
      step.querySelectorAll('[data-anim]').forEach((a) => {
        const r = a.getBoundingClientRect();
        if (r.width && r.height) out.push({ x: r.left - sr.left - 12, y: r.top - sr.top - 12, w: r.width + 24, h: r.height + 24 });
      });
    });
    if (info.hr > 0) {
      const hr = info.hr * Math.max(sx, sy) * 1.25;
      out.push({ x: info.hx * sx - hr, y: info.hy * sy - hr, w: hr * 2, h: hr * 2 });
    }
    return out;
  }
  const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

  function rectAt(theta, hx, hy, r, bw, bh) {
    const c = Math.cos(theta), s = Math.sin(theta);
    const ext = Math.min(bw / 2 / Math.max(1e-3, Math.abs(c)), bh / 2 / Math.max(1e-3, Math.abs(s)));
    const d = r + GAP + ext;
    return { x: hx + c * d - bw / 2, y: hy + s * d - bh / 2, w: bw, h: bh };
  }

  function place(info) {
    const W = stage.clientWidth, H = stage.clientHeight;
    const sx = W / info.width, sy = H / info.height;  // píxeles del canvas → del escenario
    if (!size) size = { w: el.offsetWidth, h: el.offsetHeight };
    const { w: bw, h: bh } = size;
    const hx = info.x * sx, hy = info.y * sy, r = info.r * sx;
    const sr = stage.getBoundingClientRect();
    const safe = safeArea(W, H);
    const avoid = avoidRects(sr, info, sx, sy);
    const penalty = (rc) => {
      const out = Math.max(0, safe.left - rc.x) + Math.max(0, rc.x + rc.w - safe.right) + Math.max(0, safe.top - rc.y) + Math.max(0, rc.y + rc.h - safe.bottom);
      return out * 50 + avoid.reduce((sum, a) => sum + overlap(rc, a), 0);
    };
    // histéresis: se queda en su lado mientras sea válido; si no, el primero válido; si ninguno, el menos malo
    let best = cand, bestRect = cand >= 0 ? rectAt(CANDS[cand], hx, hy, r, bw, bh) : null;
    if (cand < 0 || penalty(bestRect) > 0) {
      let bestP = Infinity;
      CANDS.forEach((th, i) => {
        const rc = rectAt(th, hx, hy, r, bw, bh);
        const p = penalty(rc);
        if (p < bestP - 1e-6) { bestP = p; best = i; bestRect = rc; }
      });
      cand = best;
    }
    // siempre dentro de la zona segura (y por tanto del viewport)
    const tx = Math.min(Math.max(bestRect.x, safe.left), Math.max(safe.left, safe.right - bw));
    const ty = Math.min(Math.max(bestRect.y, safe.top), Math.max(safe.top, safe.bottom - bh));
    if (!placed || !info.dt) { px = tx; py = ty; placed = true; }
    else { const k = 1 - Math.exp(-info.dt * 18); px += (tx - px) * k; py += (ty - py) * k; }
    el.style.translate = `${px.toFixed(1)}px ${py.toFixed(1)}px`;

    // colita: sale del borde que mira a la cabeza y apunta a ella
    const cx = px + bw / 2, cy = py + bh / 2;
    const vx = hx - cx, vy = hy - cy;
    const tX = Math.abs(vx) > 1e-3 ? bw / 2 / Math.abs(vx) : Infinity, tY = Math.abs(vy) > 1e-3 ? bh / 2 / Math.abs(vy) : Infinity;
    let bx, by, base;
    if (tY <= tX) { by = vy > 0 ? bh : 0; bx = bw / 2 + vx * tY; base = vy > 0 ? 0 : 180; }
    else { bx = vx > 0 ? bw : 0; by = bh / 2 + vy * tX; base = vx > 0 ? -90 : 90; }
    const m = 14;
    if (base === 0 || base === 180) bx = Math.min(Math.max(bx, m), bw - m);
    else by = Math.min(Math.max(by, Math.min(m, bh / 2)), Math.max(bh - m, bh / 2));
    const ang = (Math.atan2(-(hx - (px + bx)), hy - (py + by)) * 180) / Math.PI;
    let dev = ((ang - base + 540) % 360) - 180;
    dev = Math.max(-50, Math.min(50, dev));
    tailEl.style.transform = `translate(${(bx - 10).toFixed(1)}px, ${(by - 1).toFixed(1)}px) rotate(${(base + dev).toFixed(1)}deg)`;
    el.style.transformOrigin = `${bx.toFixed(0)}px ${by.toFixed(0)}px`;
  }

  return { show, hide, place, invalidate };
}
