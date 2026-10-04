// Hero fijado: la escena 3D queda fija (position: sticky, cero saltos de layout) y GSAP
// ScrollTrigger lleva el progreso. Los pasos y la cámara se mueven de forma CONTINUA con el
// scroll (sin snap, sin saltos), y Lenis suaviza la rueda del ratón en escritorio.
// Mejora progresiva: primero se pinta el póster (mismo fotograma que la escena) y GSAP,
// Lenis y three.js se cargan con la primera interacción (o a los 8 s).

const VENDOR = new URL('../vendor/', import.meta.url);

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function whenIdle(fn, timeout = 1500) {
  const go = () => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout }) : setTimeout(fn, 200));
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go, { once: true });
}

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export async function initHero({ scramble = null } = {}) {
  const root = document.documentElement;
  const hero = document.querySelector('.hero');
  const steps = [...hero.querySelectorAll('.step')];
  const ticks = [...hero.querySelectorAll('.hero__progress span')];
  const hint = hero.querySelector('.hero__hint');
  const canvas = hero.querySelector('.hero__canvas');
  const poster = hero.querySelector('.hero__poster');
  const anims = steps.map((s) => [...s.querySelectorAll('[data-anim]')]);
  const n = steps.length;
  let active = -1;
  let progress = 0;
  let scene = null;
  let inView = true;
  let lenis = null;
  let driven = false;
  // Saludo del personaje (el scroll solo lo dispara). Módulo aparte: no retrasa el arranque del hero
  let wave = null, st = null;
  import('./wave.js').then(({ createWave }) => {
    wave = createWave({ hero, steps });
    if (st) wave.onScroll(progress);
    if (scene) wave.attach(scene);
  }).catch(() => {});

  // Estado visual de cada paso en función del progreso (0..1): opacidad y parallax por elemento
  function render(p) {
    const f = p * (n - 1);
    steps.forEach((step, i) => {
      const d = f - i;                        // <0 aún no ha llegado · >0 ya se va
      const o = 1 - smoothstep(0.22, 0.5, Math.abs(d));
      step.style.opacity = o.toFixed(3);
      step.style.pointerEvents = o > 0.6 ? 'auto' : 'none';
      anims[i].forEach((el, k) => {
        el.style.transform = `translate3d(0, ${(-d * (70 + k * 16)).toFixed(1)}px, 0)`;
      });
    });
    const a = Math.min(n - 1, Math.max(0, Math.round(f)));
    if (a !== active) {
      active = a;
      steps.forEach((s, k) => s.classList.toggle('is-active', k === a));
      ticks.forEach((t, k) => t.classList.toggle('is-active', k === a));
      scramble?.(steps[a].querySelector('[data-scramble]'));
    }
    hint?.classList.toggle('is-hidden', p > 0.02);
  }
  render(0);
  // Los cambios de estilo van en el siguiente fotograma, no dentro del evento de scroll
  // (Firefox avisa de los efectos de posición ligados al scroll)
  let queued = false;
  const queueRender = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; render(progress); });
  };

  // Pantallas bajas (portátiles): las tarjetas del paso 2 arrancan plegadas para que quepan
  if (window.innerHeight < 860) {
    hero.querySelectorAll('.step--2 .rcard__toggle[aria-expanded="true"]').forEach((btn) => {
      btn.setAttribute('aria-expanded', 'false');
      const panel = document.getElementById(btn.getAttribute('aria-controls'));
      panel?.setAttribute('data-closed', '');
      panel?.setAttribute('inert', '');
    });
  }

  // Teclado: si el foco entra en un paso que no está visible, lo llevamos a pantalla
  hero.addEventListener('focusin', (e) => {
    const step = e.target.closest('.step');
    const i = steps.indexOf(step);
    if (i < 0 || i === active || !root.classList.contains('pin')) return;
    const top = hero.getBoundingClientRect().top + window.scrollY;
    const y = Math.round(top + (hero.offsetHeight - window.innerHeight) * (i / (n - 1)));
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo({ top: y, behavior: 'instant' });
    if (!driven) render(i / (n - 1));
  });

  // Hasta la primera interacción no se carga nada pesado
  await new Promise((resolve) => {
    const events = ['pointermove', 'pointerdown', 'wheel', 'scroll', 'keydown', 'touchstart'];
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      events.forEach((ev) => window.removeEventListener(ev, go));
      resolve();
    };
    events.forEach((ev) => window.addEventListener(ev, go, { passive: true }));
    if (window.scrollY > 4) go();
    setTimeout(() => { if (!document.hidden) go(); }, 8000);
  });

  await loadScript(new URL('gsap/gsap.min.js', VENDOR).href);
  await loadScript(new URL('gsap/ScrollTrigger.min.js', VENDOR).href);
  await loadScript(new URL('lenis/lenis.min.js', VENDOR).href).catch(() => {});
  const { gsap, ScrollTrigger, Lenis } = window;
  gsap.registerPlugin(ScrollTrigger);

  // Scroll suave de la rueda (solo escritorio con movimiento; el táctil sigue nativo)
  if (Lenis) {
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.95, smoothWheel: true, anchors: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  st = ScrollTrigger.create({
    trigger: hero,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate(self) {
      driven = true;
      progress = self.progress;
      queueRender();
      scene?.setProgress(progress);
      wave?.onScroll(progress);
    },
  });
  progress = st.progress;
  render(progress);
  wave?.onScroll(progress);

  // Si la ventana cambia a móvil, volvemos al layout apilado (y al revés)
  const pinMQ = window.matchMedia('(min-width: 1000px) and (min-height: 600px)');
  pinMQ.addEventListener('change', (e) => {
    root.classList.toggle('pin', e.matches);
    if (e.matches) { st.enable(); lenis?.start(); scene?.setRunning(inView && !document.hidden); }
    else {
      st.disable(); lenis?.stop(); wave?.cancel(); scene?.setRunning(false);
      steps.forEach((s) => { s.style.opacity = ''; s.style.pointerEvents = ''; });
      anims.flat().forEach((el) => { el.style.transform = ''; });
    }
    ScrollTrigger.refresh();
  });

  // Escena 3D en diferido, con el hilo principal libre
  whenIdle(async () => {
    try {
      const { createScene } = await import('./scene.js');
      const terminal = JSON.parse(document.getElementById('terminal-data')?.textContent || '{}');
      scene = await createScene({ canvas, terminal, avatarUrl: canvas.dataset.avatar || null });
      scene.setProgress(progress);
      canvas.classList.add('is-ready');
      poster?.classList.add('is-hidden');
      wave?.attach(scene);
      const io = new IntersectionObserver(([en]) => {
        inView = en.isIntersecting;
        if (!inView) wave?.cancel();   // fling más allá del hero: vuelve a la pose normal, sin quedarse a medias
        scene.setRunning(inView && !document.hidden && root.classList.contains('pin'));
      }, { rootMargin: '80px 0px' });
      io.observe(hero);
      document.addEventListener('visibilitychange', () => scene.setRunning(inView && !document.hidden && root.classList.contains('pin')));
      window.addEventListener('pointermove', (e) => {
        scene.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
      }, { passive: true });
    } catch (err) {
      // sin WebGL o sin escena: se queda el póster
    }
  });
}
