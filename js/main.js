// Javier Roman Heider — portfolio
// Interacciones comunes a todas las páginas. Sin dependencias.

const root = document.documentElement;
const mq = (q) => window.matchMedia(q);
const motionOK = !mq('(prefers-reduced-motion: reduce)').matches;
const finePointer = mq('(pointer: fine)').matches;

/* ---------- Cabecera: estado al hacer scroll ---------- */
let scrolled = false;
function onScrollHeader() {
  const s = window.scrollY > 40;
  if (s !== scrolled) { scrolled = s; root.classList.toggle('is-scrolled', s); }
}
window.addEventListener('scroll', onScrollHeader, { passive: true });
onScrollHeader();

/* ---------- Al llegar al pie, se ocultan redes y CV fijos (evita solaparse) ---------- */
const footerEl = document.querySelector('.site-footer');
if (footerEl && 'IntersectionObserver' in window) {
  new IntersectionObserver(([en]) => root.classList.toggle('at-footer', en.isIntersecting), { rootMargin: '0px 0px -40px 0px' }).observe(footerEl);
}

/* ---------- Menú móvil ---------- */
const menuBtn = document.querySelector('.menu-toggle');
const menu = document.getElementById('mobile-menu');
if (menuBtn && menu) {
  const setOpen = (open) => {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.querySelector('.menu-toggle__label').textContent = open ? menuBtn.dataset.close : menuBtn.dataset.open;
    menu.hidden = !open;
    root.style.overflow = open ? 'hidden' : '';
    if (open) menu.querySelector('a')?.focus();
  };
  menuBtn.addEventListener('click', () => setOpen(menuBtn.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) { setOpen(false); menuBtn.focus(); }
  });
  mq('(min-width: 1000px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });
}

/* ---------- Navegación: sección actual ---------- */
const navLinks = [...document.querySelectorAll('.nav a[href^="#"]')];
if (navLinks.length && 'IntersectionObserver' in window) {
  const map = new Map(navLinks.map((a) => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      const a = map.get(en.target.id);
      if (!a) return;
      if (en.isIntersecting) {
        navLinks.forEach((l) => l.removeAttribute('aria-current'));
        a.setAttribute('aria-current', 'location');
      } else if (a.hasAttribute('aria-current')) {
        a.removeAttribute('aria-current');
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
}

/* ---------- Scramble / decrypt de títulos (una vez, rápido) ---------- */
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+<>/=';
function scramble(el, { duration = 640 } = {}) {
  if (!motionOK || !el || el.dataset.scrambled) return;
  // Se mide cada letra: esperar a las fuentes web (medidas correctas y sin forzar un layout
  // con las de reserva mientras se evalúa el módulo)
  if (document.fonts && document.fonts.status !== 'loaded') {
    document.fonts.ready.then(() => scramble(el, { duration }));
    return;
  }
  el.dataset.scrambled = '1';
  const original = el.innerHTML;
  const label = el.textContent.replace(/\s+/g, ' ').trim();

  // 1) envolver cada carácter visible para medirlo
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  const spans = [];
  textNodes.forEach((node) => {
    const frag = document.createDocumentFragment();
    for (const ch of node.textContent) {
      if (/\s/.test(ch)) { frag.appendChild(document.createTextNode(ch)); continue; }
      const s = document.createElement('span');
      s.className = 'sc';
      s.textContent = ch;
      s.dataset.ch = ch;
      frag.appendChild(s);
      spans.push(s);
    }
    node.parentNode.replaceChild(frag, node);
  });
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = label;
  [...el.childNodes].forEach((n) => { if (n.nodeType === 1) n.setAttribute('aria-hidden', 'true'); });
  el.appendChild(sr);

  // 2) fijar anchuras (lectura en bloque, escritura en bloque)
  const widths = spans.map((s) => s.getBoundingClientRect().width);
  spans.forEach((s, i) => { s.style.width = widths[i] + 'px'; });

  // 3) animar
  const n = spans.length;
  const reveal = spans.map((_, i) => (i / Math.max(1, n - 1)) * duration * 0.55 + Math.random() * duration * 0.4);
  const start = performance.now();
  let last = 0;
  function frame(now) {
    const t = now - start;
    if (now - last > 42) {
      last = now;
      spans.forEach((s, i) => {
        if (t >= reveal[i]) {
          if (!s.dataset.done) { s.textContent = s.dataset.ch; s.classList.remove('sc--x'); s.dataset.done = '1'; }
        } else {
          s.textContent = GLYPHS[(Math.random() * GLYPHS.length) | 0];
          s.classList.toggle('sc--x', Math.random() < 0.18);
        }
      });
    }
    if (t < duration + 60) requestAnimationFrame(frame);
    else el.innerHTML = original;
  }
  requestAnimationFrame(frame);
}

if (motionOK && 'IntersectionObserver' in window) {
  const scrIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { scramble(en.target); scrIO.unobserve(en.target); }
    });
  }, { threshold: 0.6 });
  // los títulos del hero fijado los dispara hero.js al activarse cada paso
  document.querySelectorAll('[data-scramble]').forEach((el) => {
    if (root.classList.contains('pin') && el.closest('.hero')) return;
    scrIO.observe(el);
  });

  /* ---------- Revelado suave ---------- */
  const revIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('is-in'); revIO.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach((el) => revIO.observe(el));
} else {
  document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in'));
}

/* ---------- Tarjetas expandibles (aria-expanded) ---------- */
document.querySelectorAll('.rcard__toggle').forEach((btn) => {
  const panel = document.getElementById(btn.getAttribute('aria-controls'));
  if (!panel) return;
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    if (open) panel.removeAttribute('data-closed'); else panel.setAttribute('data-closed', '');
    panel.toggleAttribute('inert', !open);
  });
});

/* ---------- Filtro de trabajos ---------- */
const filterBtns = [...document.querySelectorAll('.filter[data-filter]')];
const workCards = [...document.querySelectorAll('.work [data-cat]')];
const live = document.getElementById('work-live');
if (filterBtns.length) {
  filterBtns.forEach((btn) => btn.addEventListener('click', () => {
    const f = btn.dataset.filter;
    filterBtns.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    let shown = 0;
    workCards.forEach((card) => {
      const match = f === 'all' || card.dataset.cat === f;
      const wasHidden = card.hidden;
      card.hidden = !match;
      if (match) {
        shown++;
        if (wasHidden && motionOK) {
          card.classList.remove('is-entering');
          void card.offsetWidth;
          card.classList.add('is-entering');
        }
      }
    });
    if (live) live.textContent = `${shown} ${shown === 1 ? 'trabajo' : 'trabajos'}${f === 'all' ? '' : ' en ' + btn.textContent.trim()}`;
  }));
}

/* ---------- Historia: línea de tiempo que avanza con el scroll ---------- */
const story = document.querySelector('.story');
if (story) {
  const marks = [...story.querySelectorAll('.timeline__mark')];
  const chapters = [...story.querySelectorAll('.chapter')];
  const body = story.querySelector('.story__chapters');
  let ticking = false;
  const update = () => {
    ticking = false;
    const r = body.getBoundingClientRect();
    const vh = window.innerHeight;
    const p = Math.min(1, Math.max(0, (vh * 0.5 - r.top) / Math.max(1, r.height)));
    story.style.setProperty('--p', p.toFixed(4));
    let active = -1;
    chapters.forEach((c, i) => {
      const cr = c.getBoundingClientRect();
      if (cr.top < vh * 0.55) active = i;
    });
    marks.forEach((m, i) => {
      m.classList.toggle('is-active', i === active);
      m.classList.toggle('is-past', i < active);
    });
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
}

/* ---------- Orbe lila con inercia (solo puntero fino y con movimiento) ---------- */
if (finePointer && motionOK) {
  const orb = document.createElement('div');
  orb.className = 'orb';
  orb.setAttribute('aria-hidden', 'true');
  document.body.appendChild(orb);
  let tx = -100, ty = -100, x = -100, y = -100, raf = 0, on = false;
  const loop = () => {
    x += (tx - x) * 0.14;
    y += (ty - y) * 0.14;
    orb.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    raf = (Math.abs(tx - x) + Math.abs(ty - y) > 0.2) ? requestAnimationFrame(loop) : 0;
  };
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    tx = e.clientX + 16; ty = e.clientY + 14;
    if (!on) { on = true; x = tx; y = ty; orb.classList.add('is-on'); }
    orb.classList.toggle('is-hot', !!e.target.closest('a, button'));
    if (!raf) raf = requestAnimationFrame(loop);
  }, { passive: true });
  document.addEventListener('pointerleave', () => { on = false; orb.classList.remove('is-on'); });
  window.addEventListener('blur', () => { on = false; orb.classList.remove('is-on'); });
}

/* ---------- Hero fijado: escena 3D + pasos (solo escritorio con movimiento) ---------- */
if (root.classList.contains('pin') && document.querySelector('.hero')) {
  import('./hero.js').then((m) => m.initHero({ scramble })).catch(() => {
    // si algo falla, volvemos al layout apilado con la imagen estática
    root.classList.remove('pin');
  });
}
