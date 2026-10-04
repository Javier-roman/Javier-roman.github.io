#!/usr/bin/env node
/*
  Generador de páginas estáticas a partir de content/es.json.
  Uso:  node _tools/build.cjs               (desde la raíz del repo)
  No es obligatorio para publicar: el HTML generado se versiona tal cual.
  Genera: index.html, trabajos/<slug>.html, cv/cv.html, 404.html
*/
const fs = require('fs');
const path = require('path');

const V2 = path.resolve(__dirname, '..');
const LANG = process.argv[2] || 'es';
const C = JSON.parse(fs.readFileSync(path.join(V2, 'content', `${LANG}.json`), 'utf8'));
const P = C.person;
const UI = C.ui;
const SITE = C.meta.siteUrl.replace(/\/$/, '') + '/';
// Ruta base del 404 (GitHub Pages lo sirve en cualquier ruta)
const BASE_404 = process.env.BASE_404 || '/';

/* ---------------------------------------------------------------- utilidades */
// (un punto medio nunca abre línea: espacio de no separación delante de « · »)
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/ · /g, ' · ');
// Nombres que no deben partirse al final de línea (fuera de etiquetas y atributos)
const nw = (h) => h.replace(/(<[^>]*>)|ENTI-UB/g, (m, tag) => tag || '<span class="nw">ENTI-UB</span>');
// Marcado mínimo en el contenido: **negrita**, `código`, [texto](url)
function md(s = '') {
  let h = esc(s);
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
  h = h.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  return nw(h);
}
// Títulos display: "LO QUE|{HAGO}" -> líneas separadas por | y palabra de acento entre {}
function displayTitle(t) {
  return t.split('|').map((line) => {
    const inner = esc(line).replace(/\{(.+?)\}/g, '<span class="accent">$1</span>');
    return `<span class="line">${inner}</span>`;
  }).join(' ');
}
const plain = (t) => t.replace(/[{}]/g, '').replace(/\|/g, ' ');
const sentenceCase = (t) => t.charAt(0) + t.slice(1).toLowerCase();

const ICON = {
  arrow: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M1 8h13M9 3l5 5-5 5" stroke="currentColor" stroke-width="1.5"/></svg>',
  arrowUR: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 12 12 4M5.5 4H12v6.5" stroke="currentColor" stroke-width="1.5"/></svg>',
  down: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 1v13M3 9l5 5 5-5" stroke="currentColor" stroke-width="1.5"/></svg>',
  chevron: '<svg viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 4.5 6 8.5l4-4" stroke="currentColor" stroke-width="1.5"/></svg>',
  github: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4v11.75H3V9.75Zm6.5 0h3.84v1.6h.05c.53-1.01 1.84-2.08 3.79-2.08 4.05 0 4.8 2.67 4.8 6.14v6.09h-4v-5.4c0-1.29-.02-2.95-1.8-2.95-1.8 0-2.08 1.4-2.08 2.86v5.49h-4V9.75Z"/></svg>',
};

const BRAND = (prefix) => `<a class="brand" href="${prefix}#inicio" aria-label="${esc(P.brand)}: ir al inicio"><span>${esc(P.brand)}</span><span class="brand__path">~$</span><span class="brand__caret" aria-hidden="true"></span></a>`;

/* ---------------------------------------------------------------- <head> común */
function head({ prefix, title, description, canonical, ogType = 'website', importmap = false, preloadImg = null }) {
  const og = SITE + C.meta.ogImage;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: P.name,
    url: SITE,
    jobTitle: P.role,
    email: 'mailto:' + P.email,
    address: { '@type': 'PostalAddress', addressLocality: 'Badalona', addressRegion: 'Barcelona', addressCountry: 'ES' },
    sameAs: [P.githubUrl, P.linkedinUrl],
    alumniOf: [{ '@type': 'CollegeOrUniversity', name: 'ENTI-UB · Universitat de Barcelona' }, { '@type': 'EducationalOrganization', name: 'IFP Barcelona' }],
    knowsLanguage: ['es', 'ca', 'en', 'de'],
  };
  return `<!doctype html>
<html lang="${C.meta.lang}" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta name="theme-color" content="${C.meta.themeColor}">
<meta name="color-scheme" content="dark">
<meta name="author" content="${esc(P.name)}">
<meta property="og:type" content="${ogType}">
<meta property="og:locale" content="${C.meta.locale}">
<meta property="og:site_name" content="${esc(P.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(C.meta.ogAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${og}">
<link rel="icon" href="${prefix}assets/favicon.ico" sizes="32x32">
<link rel="icon" href="${prefix}assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${prefix}assets/apple-touch-icon.png">
<link rel="preload" href="${prefix}fonts/archivo-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${prefix}fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>
${preloadImg ? preloadImg + '\n' : ''}<link rel="stylesheet" href="${prefix}css/main.css">
<script>(function(d,w){var h=d.documentElement,m=function(q){return w.matchMedia(q).matches};h.classList.remove('no-js');h.classList.add('js');var r=m('(prefers-reduced-motion: reduce)');if(!r)h.classList.add('motion');if(!r&&m('(min-width: 1000px) and (min-height: 600px)')&&d.querySelector&&${importmap ? 'true' : 'false'})h.classList.add('pin');})(document,window);</script>
${importmap ? `<script type="importmap">{"imports":{"three":"./vendor/three/three.module.min.js","three/addons/":"./vendor/three/addons/"}}</script>\n` : ''}<script type="module" src="${prefix}js/main.js"></script>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>`;
}

/* ---------------------------------------------------------------- chrome */
function chrome(prefix, inPage) {
  const navHref = (id) => (inPage ? `#${id}` : `${prefix}#${id}`);
  const nav = UI.nav.map((n) => `<a href="${navHref(n.id)}">${esc(n.label)}</a>`).join('');
  const mnav = UI.nav.map((n) => `<a class="mobile-menu__item" href="${navHref(n.id)}">${esc(n.label)}</a>`).join('');
  return `<a class="skip-link" href="#main">${esc(UI.skip)}</a>
<div class="atmos" aria-hidden="true"></div>
<header class="site-header">
  ${BRAND(inPage ? '' : prefix)}
  <nav class="nav" aria-label="Principal">${nav}</nav>
  <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-menu" data-open="${esc(UI.menu)}" data-close="${esc(UI.close)}"><span class="menu-toggle__label">${esc(UI.menu)}</span><span class="menu-toggle__bars" aria-hidden="true"></span></button>
</header>
<div class="mobile-menu" id="mobile-menu" hidden>
  <nav aria-label="Menú móvil">${mnav}</nav>
  <div class="mobile-menu__meta">
    <a href="${P.githubUrl}" target="_blank" rel="noopener">GitHub</a>
    <a href="${P.linkedinUrl}" target="_blank" rel="noopener">LinkedIn</a>
    <a href="${prefix}${P.cvFile}" download="${P.cvDownloadName}">${esc(UI.cvLabel)}</a>
  </div>
</div>
<nav class="social-rail" aria-label="Redes">
  <a href="${P.githubUrl}" target="_blank" rel="noopener" aria-label="${esc(UI.githubLabel)}">${ICON.github}</a>
  <a href="${P.linkedinUrl}" target="_blank" rel="noopener" aria-label="${esc(UI.linkedinLabel)}">${ICON.linkedin}</a>
</nav>
<aside aria-label="CV"><a class="cv-link" href="${prefix}${P.cvFile}" download="${P.cvDownloadName}" aria-label="${esc(UI.cvLabel)}">${esc(UI.cv)} ${ICON.down}</a></aside>`;
}

function footer(prefix, inPage) {
  const F = C.footer;
  return `<footer class="site-footer">
  <div class="container site-footer__row">
    <span class="site-footer__exit">${esc(P.brand)} ${esc(F.exit)}</span>
    <span>${esc(F.line)}</span>
    <span>${esc(F.copy)}</span>
    <a href="${inPage ? '' : prefix}#inicio">${esc(UI.toTop)} ↑</a>
  </div>
</footer>
<div class="grain" aria-hidden="true"></div>`;
}

/* ---------------------------------------------------------------- piezas */
const tags = (list) => `<ul class="tags">${list.map((t) => `<li class="tag">${md(t)}</li>`).join('')}</ul>`;
const corners = () => ['tl', 'tr', 'bl', 'br'].map((c) => `<span class="rcard__corner rcard__corner--${c}" aria-hidden="true"></span>`).join('');
const chip = (item) => `<span class="chip chip--${item.statusKind}">${esc(item.status)}</span>`;
const photo = ({ prefix, src, w, h, alt, cls = '', loading = 'lazy', caption = '' }) => `<figure class="duo ${cls}">
  <picture>
    <source srcset="${prefix}assets/${src}.webp" type="image/webp">
    <img src="${prefix}assets/${src}.jpg" alt="${esc(alt)}" width="${w}" height="${h}" loading="${loading}" decoding="async">
  </picture>
  <span class="duo__veil" aria-hidden="true"></span>
  <span class="duo__frame" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
  ${caption ? `<figcaption class="duo__cap">${esc(caption)}</figcaption>` : ''}
</figure>`;

/* ---------------------------------------------------------------- diagramas SVG */
function wrapWords(text, max) {
  const words = text.split(' ');
  const lines = [''];
  words.forEach((w) => {
    const cur = lines[lines.length - 1];
    if ((cur + ' ' + w).trim().length > max && cur) lines.push(w); else lines[lines.length - 1] = (cur + ' ' + w).trim();
  });
  return lines;
}
function svgText(x, y, lines, cls, lh) {
  return lines.map((l, i) => `<text x="${x}" y="${y + i * lh}" class="${cls}" text-anchor="middle">${esc(l)}</text>`).join('');
}
const SVG_STYLE = `<style>.n{fill:#0d0d10;stroke:rgba(237,237,239,.34);stroke-width:1}.n2{fill:rgba(180,165,255,.1);stroke:#b4a5ff;stroke-width:1}.l{font:700 15px Archivo,system-ui,sans-serif;fill:#ededef}.s{font:500 11.5px 'JetBrains Mono',monospace;fill:#8b8b95}.a{stroke:#b4a5ff;stroke-width:1.4;fill:none}.ah{fill:#b4a5ff}.g{fill:none;stroke:rgba(237,237,239,.22);stroke-dasharray:4 5}.c{font:500 12px 'JetBrains Mono',monospace;fill:#b4a5ff}.e{stroke:rgba(237,237,239,.45);stroke-width:1.2;fill:none}.e2{stroke:#b4a5ff;stroke-width:1.2;fill:none}</style>`;

function flowSVG(d, id) {
  const nodes = d.nodes, n = nodes.length;
  const bw = 168, bh = 86, gap = 40, rowGap = 48;
  const rows = n > 4 ? 2 : 1, cols = Math.ceil(n / rows);
  const W = cols * bw + (cols - 1) * gap, H = rows * bh + (rows - 1) * rowGap + 4;
  const desc = nodes.map((x) => `${x.label} (${x.sub})`).join(' → ');
  let h = `<svg class="d-h" viewBox="0 0 ${W} ${H}" style="max-width:${W}px" role="img" aria-labelledby="${id}-t ${id}-d"><title id="${id}-t">${esc(d.title)}</title><desc id="${id}-d">${esc(desc)}</desc>${SVG_STYLE}`;
  const pos = (i) => { const r = Math.floor(i / cols), c = i % cols; return { r, x: (r % 2 ? cols - 1 - c : c) * (bw + gap), y: 2 + r * (bh + rowGap) }; };
  nodes.forEach((node, i) => {
    const { r, x, y } = pos(i);
    const last = i === n - 1;
    h += `<rect x="${x + 0.5}" y="${y + 0.5}" width="${bw - 1}" height="${bh - 1}" class="${last ? 'n2' : 'n'}"/>`;
    const lab = wrapWords(node.label, 18), sub = wrapWords(node.sub, 22);
    const total = lab.length * 18 + sub.length * 15 + 4;
    const y0 = y + (bh - total) / 2 + 14;
    h += svgText(x + bw / 2, y0, lab, 'l', 18);
    h += svgText(x + bw / 2, y0 + lab.length * 18 + 4, sub, 's', 15);
    if (!last) {
      const nx = pos(i + 1);
      if (nx.r !== r) {                       // bajada a la fila siguiente
        const ax = x + bw / 2, ay = y + bh + 5;
        h += `<path class="a" d="M${ax} ${ay}v${rowGap - 14}"/><path class="ah" d="M${ax - 4} ${ay + rowGap - 10}l4 6 4-6z"/>`;
      } else if (r % 2 === 0) {               // fila par: izquierda → derecha
        const ax = x + bw + 5, ay = y + bh / 2;
        h += `<path class="a" d="M${ax} ${ay}h${gap - 14}"/><path class="ah" d="M${ax + gap - 10} ${ay - 4}l6 4-6 4z"/>`;
      } else {                                // fila impar: derecha → izquierda
        const ax = x - 5, ay = y + bh / 2;
        h += `<path class="a" d="M${ax} ${ay}h${-(gap - 14)}"/><path class="ah" d="M${ax - gap + 10} ${ay - 4}l-6 4 6 4z"/>`;
      }
    }
  });
  h += '</svg>';
  // versión vertical (móvil)
  const vw = 300, vbh = 64, vgap = 30, VH = n * vbh + (n - 1) * vgap + 4;
  let v = `<svg class="d-v" viewBox="0 0 ${vw} ${VH}" role="img" aria-labelledby="${id}-vt ${id}-vd"><title id="${id}-vt">${esc(d.title)}</title><desc id="${id}-vd">${esc(desc)}</desc>${SVG_STYLE}`;
  nodes.forEach((node, i) => {
    const y = 2 + i * (vbh + vgap);
    const last = i === n - 1;
    v += `<rect x="0.5" y="${y + 0.5}" width="${vw - 1}" height="${vbh - 1}" class="${last ? 'n2' : 'n'}"/>`;
    v += svgText(vw / 2, y + 27, [node.label], 'l', 16);
    v += svgText(vw / 2, y + 46, [node.sub], 's', 14);
    if (!last) {
      const ay = y + vbh + 5;
      v += `<path class="a" d="M${vw / 2} ${ay}v${vgap - 14}"/><path class="ah" d="M${vw / 2 - 4} ${ay + vgap - 10}l4 6 4-6z"/>`;
    }
  });
  v += '</svg>';
  return h + v;
}

function box(x, y, w, h, label, sub, strong) {
  let s = `<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" class="${strong ? 'n2' : 'n'}"/>`;
  const subs = Array.isArray(sub) ? sub : (sub ? [sub] : []);
  const total = 16 + subs.length * 14;
  const y0 = y + (h - total) / 2 + 12;
  s += svgText(x + w / 2, y0, [label], 'l', 16);
  s += svgText(x + w / 2, y0 + 18, subs, 's', 14);
  return s;
}
function topologySVG(d, id) {
  const W = 900, H = 470;
  const desc = 'Router con OSPF (área 0) conectado a un switch intermedio. Del switch intermedio cuelgan los switches de cada oficina, cada una con su VLAN y su subred /27 (Informática VLAN 901 192.168.2.0/27, Facturación y Mantenimiento VLAN 921 192.168.2.32/27, Gerencia VLAN 911 192.168.2.64/27, otras oficinas VLAN 881 y 891), cada oficina con 6 PCs y un punto de acceso Wi-Fi. El servidor ATENEA está en la VLAN 870, unido a MNEMOSINE (copias de seguridad) mediante LACP; HESTIA es el puesto de administración.';
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}-t ${id}-d"><title id="${id}-t">${esc(d.title)}</title><desc id="${id}-d">${esc(desc)}</desc>${SVG_STYLE}`;
  // router
  s += box(330, 6, 240, 58, 'Router', 'OSPF · área 0 · proceso 10', false);
  s += `<path class="e" d="M450 64v40"/>`;
  s += box(330, 104, 240, 58, 'Switch intermedio', 'trunk con todas las VLAN', false);
  // oficinas
  const offices = [
    ['Informática', ['VLAN 901', '192.168.2.0/27']],
    ['Facturación', ['VLAN 921', '192.168.2.32/27']],
    ['Gerencia', ['VLAN 911', '192.168.2.64/27']],
    ['Otras oficinas', ['VLAN 881 · 891', 'una /27 por oficina']],
  ];
  const ow = 162, og = 18, ox0 = 6, oy = 236;
  offices.forEach(([lab, sub], i) => {
    const x = ox0 + i * (ow + og);
    s += `<path class="e" d="M450 162V200H${x + ow / 2}V${oy}"/>`;
    s += box(x, oy, ow, 74, lab, sub, false);
    s += `<path class="e" d="M${x + ow / 2} ${oy + 74}v24"/>`;
    s += box(x + 10, oy + 98, ow - 20, 50, '6 PCs + AP', 'Wi-Fi propio', false);
  });
  // servidores
  const sx = 732;
  s += `<path class="e" d="M570 133H${sx + 80}V${oy}"/>`;
  s += box(sx, oy, 160, 74, 'ATENEA', ['VLAN 870', 'DNS · DHCP · LDAP · BD'], true);
  s += `<path class="e2" d="M${sx + 72} ${oy + 74}v52M${sx + 88} ${oy + 74}v52"/>`;
  s += `<text x="${sx + 96}" y="${oy + 104}" class="c">LACP</text>`;
  s += box(sx, oy + 126, 160, 50, 'MNEMOSINE', 'copias de seguridad', false);
  s += box(sx, oy + 196, 160, 36, 'HESTIA', '', false);
  s += `<path class="e" d="M${sx - 10} ${oy + 214}H${sx}"/><path class="e" d="M${sx - 10} ${oy + 37}V${oy + 214}"/><path class="e" d="M${sx - 10} ${oy + 37}H${sx}"/>`;
  s += '</svg>';
  return `<div class="diagram__scroll" tabindex="0" role="region" aria-label="${esc(d.title)} (desplazable)">${s}</div>`;
}

function composeSVG(d, id) {
  const W = 880, H = 330;
  const desc = 'Red interna demo. La app (Node.js, puerto 3000) y phpMyAdmin (puerto 8080) se conectan a MySQL 8 (puerto 3306). n8n (puerto 5678) usa PostgreSQL 16; n8n-import importa credenciales y flujos al arrancar.';
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}-t ${id}-d"><title id="${id}-t">${esc(d.title)}</title><desc id="${id}-d">${esc(desc)}</desc>${SVG_STYLE}`;
  s += `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" class="g"/><text x="20" y="26" class="c" text-anchor="start">red: demo</text>`;
  s += box(40, 52, 200, 70, 'app (aupy-node)', ['Node.js · Express 5', ':3000'], true);
  s += box(40, 200, 200, 70, 'phpmyadmin', ':8080', false);
  s += box(330, 126, 200, 70, 'mysql', ['MySQL 8.0', ':3306'], false);
  s += `<path class="e" d="M240 87H285V161H330M240 235H285V161"/>`;
  s += box(620, 52, 220, 70, 'n8n', ['automatización', ':5678'], false);
  s += box(620, 200, 220, 70, 'postgres', 'PostgreSQL 16', false);
  s += `<path class="e" d="M730 122V200"/>`;
  s += box(420, 250, 150, 46, 'n8n-import', 'arranque', false);
  s += `<path class="e" d="M570 273H620"/>`;
  s += '</svg>';
  return `<div class="diagram__scroll" tabindex="0" role="region" aria-label="${esc(d.title)} (desplazable)">${s}</div>`;
}

function diagram(d, id) {
  if (!d) return '';
  const body = d.type === 'topology' ? topologySVG(d, id) : d.type === 'compose' ? composeSVG(d, id) : flowSVG(d, id);
  return `<figure class="diagram">${body}<figcaption>${esc(d.title)}</figcaption></figure>`;
}

/* ---------------------------------------------------------------- resaltado de código */
function highlight(code, lang) {
  return code.split('\n').map((line) => {
    let h = esc(line);
    if (lang === 'python') {
      h = h.replace(/(#.*)$/, '<span class="tok-c">$1</span>');
      h = h.replace(/\b(if|len|for|in|import|def|return)\b(?![^<]*<\/span>)/g, '<span class="tok-k">$1</span>');
      h = h.replace(/\b(\d+)\b(?![^<]*<\/span>)/g, '<span class="tok-n">$1</span>');
    } else if (lang === 'docker') {
      h = h.replace(/(#.*)$/, '<span class="tok-c">$1</span>');
      h = h.replace(/^(FROM|COPY|EXPOSE|CMD|RUN)\b/, '<span class="tok-k">$1</span>');
    } else if (lang === 'yaml') {
      h = h.replace(/^(\s*)([\w-]+):/, '$1<span class="tok-k">$2</span>:');
      h = h.replace(/(&quot;[^&]*&quot;)/g, '<span class="tok-s">$1</span>');
      h = h.replace(/(\$\{\w+\})/g, '<span class="tok-n">$1</span>');
    }
    return `<span class="ln">${h || ' '}</span>`;
  }).join('');
}
function codeBlock(v, file, { decorative = false } = {}) {
  // se puede desplazar en horizontal: tiene que poder enfocarse con el teclado (salvo la copia decorativa del destacado)
  const a11y = decorative ? '' : ` tabindex="0" role="region" aria-label="Código: ${esc(file)}"`;
  return `<div class="codeblock"${a11y}><div class="codeblock__bar"><span class="codeblock__dots" aria-hidden="true"><i></i><i></i><i></i></span><span>${esc(file)}</span></div><pre><code>${highlight(v.code, v.lang)}</code></pre></div>`;
}

/* ---------------------------------------------------------------- visual de cada caso */
function visual(item) {
  const v = item.visual;
  if (!v) return '';
  if (v.type === 'code') {
    const file = v.caption.split(': ')[0];
    return `<div class="case-visual__panel vis-code">
      ${codeBlock(v, file)}
      ${v.big ? `<div><p class="featured__big">${esc(v.big)}</p><p class="featured__bigLabel">${esc(v.bigLabel)}</p></div>` : ''}
    </div><p class="case-visual__cap">${esc(v.caption)}</p>`;
  }
  if (v.type === 'type') {
    return `<div class="case-visual__panel vis-type" aria-hidden="true">
      <p class="vis-type__big">${esc(v.big)}</p>
      <ul class="vis-type__lines">${v.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
    </div>`;
  }
  if (v.type === 'stats') {
    return `<div class="case-visual__panel"><dl class="vis-stats">${v.stats.map((s) => `<div><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join('')}</dl></div>`;
  }
  if (v.type === 'modules') {
    return `<div class="case-visual__panel"><ul class="vis-modules" aria-label="${esc(v.caption)}">${v.modules.map((m, i) => `<li><span>${String(i + 1).padStart(2, '0')}</span><b>${esc(m)}</b></li>`).join('')}<li class="is-core"><span>núcleo</span><b>Tauri v2 · Rust</b></li></ul></div><p class="case-visual__cap">${esc(v.caption)}${v.note ? ` · ${md(v.note)}` : ''}</p>`;
  }
  return '';
}

/* ================================================================= INDEX */
function buildIndex() {
  const prefix = '';
  const H = C.hero.steps;
  const W = C.work;
  const items = W.items;
  const feat = items.find((i) => i.slug === W.featured);
  const rest = items.filter((i) => i.slug !== W.featured);
  const avatar = fs.existsSync(path.join(V2, 'assets', 'avatar.glb')) ? 'assets/avatar.glb' : '';

  const step1 = `<div class="step step--1 is-active" data-step="0">
      <div class="step__body">
        <p class="kicker step__kicker" data-anim>${esc(H[0].kicker)}</p>
        <h1 class="display display--xl" data-scramble data-anim>${H[0].title.split('|').map((w, i, a) => `<span class="line">${esc(sentenceCase(w))}${i === a.length - 1 ? '<span class="caret-inline" aria-hidden="true"></span>' : ''}</span>`).join(' ')}</h1>
        <p class="step__tagline" data-anim>${esc(H[0].tagline)}</p>
        <p class="step__line" data-anim>${nw(esc(H[0].line))}</p>
        <div class="step__cta" data-anim>
          <a class="btn" href="${H[0].ctaHref}">${esc(H[0].cta)} ${ICON.arrow}</a>
          <span class="step__motto">${esc(H[0].motto)}</span>
        </div>
      </div>
    </div>`;

  const cards = H[1].cards.map((c, i) => {
    const open = i === 0;
    const pid = `que-hago-${i + 1}`;
    return `<article class="rcard" data-anim>
          ${corners()}
          <div class="rcard__head">
            <div>
              <h3 class="rcard__title">${esc(c.title)}</h3>
              <p class="rcard__sub">${esc(c.sub)}</p>
            </div>
            <button class="rcard__toggle" type="button" aria-expanded="${open}" aria-controls="${pid}"><span class="sr-only">${esc(c.tagsLabel)}: ${esc(c.title)}</span>${ICON.chevron}</button>
          </div>
          <p class="rcard__text">${md(c.text)}</p>
          <div class="rcard__more" id="${pid}"${open ? '' : ' data-closed inert'}><div>
            <p class="rcard__label">${esc(c.tagsLabel)}</p>
            ${tags(c.tags)}
          </div></div>
        </article>`;
  }).join('\n        ');

  const step2 = `<div class="step step--2" data-step="1">
      <div class="step__body">
        <div class="step__left">
          <p class="kicker step__kicker" data-anim>${esc(H[1].kicker)}</p>
          <h2 class="display display--l" data-scramble data-anim>${displayTitle(H[1].title)}</h2>
          <p class="step__intro" data-anim>${esc(H[1].intro)}</p>
        </div>
        <div class="step__cards">
        ${cards}
        </div>
      </div>
    </div>`;

  const s3 = H[2];
  const step3 = `<div class="step step--3" data-step="2">
      <div class="step__body">
        <p class="kicker step__kicker" data-anim>${esc(s3.kicker)}</p>
        <h2 class="display display--l" data-scramble data-anim>${displayTitle(s3.title)}</h2>
        <p class="now__lead" data-anim>${nw(esc(s3.lead))}</p>
        <p class="now__text" data-anim>${md(s3.text)}</p>
        <dl class="now__stats" data-anim>${s3.stats.map((s) => `<div><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join('')}</dl>
        <div class="now__learning" data-anim>
          <h3>${esc(s3.learningLabel)}</h3>
          ${tags(s3.learning)}
          ${s3.learningNote ? `<p class="now__note">${md(s3.learningNote)}</p>` : ''}
        </div>
        <p class="now__side" data-anim>${esc(s3.side)} <a class="link-arrow" href="${s3.sideLink.href}">${esc(s3.sideLink.label)} ${ICON.arrow}</a></p>
      </div>
    </div>`;

  const hero = `<section class="hero" id="inicio" aria-label="Presentación">
  <div class="hero__stage">
    <div class="hero__scene">
      <picture>
        <source media="(max-width: 999px)" srcset="assets/scene-mobile.webp" type="image/webp">
        <img class="hero__poster" src="assets/scene-desktop.webp" alt="${esc(UI.sceneAlt)}" width="1600" height="1000" fetchpriority="high" decoding="async">
      </picture>
      <canvas class="hero__canvas" aria-hidden="true"${avatar ? ` data-avatar="${avatar}"` : ''}></canvas>
      <div class="hero__shade" aria-hidden="true"></div>
    </div>
    ${step1}
    ${step2}
    ${step3}
    <div class="hero__progress" aria-hidden="true"><span>01</span><span>02</span><span>03</span></div>
    <div class="hero__hint" aria-hidden="true">${esc(UI.scrollHint)}</div>
  </div>
</section>
<script type="application/json" id="terminal-data">${JSON.stringify(C.terminal).replace(/</g, '\\u003c')}</script>`;

  const featured = `<article class="featured reveal" data-cat="${feat.category}">
      <div class="featured__body">
        <div class="featured__label"><span class="kicker">${esc(UI.featured)}</span><span class="chip">${esc(W.categories[feat.category])}</span>${chip(feat)}</div>
        <h3 class="featured__name">${esc(feat.name)}</h3>
        <p class="featured__text">${md(feat.featuredText || feat.oneLiner)}</p>
        ${tags(feat.tags)}
        <div class="featured__actions">
          <a class="btn" href="trabajos/${feat.slug}.html">${esc(UI.caseLink)} ${ICON.arrow}</a>
          <a class="link-arrow" href="${feat.repo}" target="_blank" rel="noopener">GitHub ${ICON.arrowUR}</a>
        </div>
      </div>
      <div class="featured__visual" aria-hidden="true">
        <div><p class="featured__big">${esc(feat.visual.big)}</p><p class="featured__bigLabel">${esc(feat.visual.bigLabel)}</p></div>
        ${codeBlock(feat.visual, 'entropy.py', { decorative: true })}
      </div>
    </article>`;

  // Rejilla de 12 columnas con anchos distintos por fila (7/5, 5/7, 6/6 y la idea a todo el ancho):
  // cada filtro sigue dejando filas completas
  const SPAN = { 'lava-market': 7, 'dental-clinic-manager': 5, 'hacking-labs-vol-1': 5, 'hacking-labs-vol-2': 7, 'network-web-infrastructure': 6, 'school-attendance-manager': 6 };
  const grid = rest.map((it, i) => `<li class="work-card rcard reveal${it.statusKind === 'idea' ? ' work-card--idea' : ''}" data-cat="${it.category}" style="--i:${i % 2};--span:${SPAN[it.slug] || 12}">
        ${corners()}
        <div class="work-card__top"><span class="work-card__cat">${esc(W.categories[it.category])}</span>${chip(it)}</div>
        <h3 class="work-card__name"><a href="trabajos/${it.slug}.html">${esc(it.name)}</a></h3>
        <p class="work-card__text">${md(it.oneLiner)}</p>
        ${tags(it.tags)}
        <div class="work-card__go" aria-hidden="true">${esc(UI.caseLink)} ${ICON.arrow}</div>
      </li>`).join('\n      ');

  const work = `<section class="section work" id="trabajos" aria-labelledby="trabajos-title">
  <div class="container">
    <header class="section-head section-head--split">
      <div>
        <p class="kicker reveal">${esc(W.kicker)}</p>
        <h2 class="display display--l" id="trabajos-title" data-scramble>${displayTitle(W.title)}</h2>
        <p class="section-head__intro reveal">${md(W.intro)}</p>
      </div>
      <div class="filters reveal" role="group" aria-label="${esc(W.filtersLabel)}">
        ${W.filters.map((f, i) => `<button class="filter" type="button" data-filter="${f.id}" aria-pressed="${i === 0}">${esc(f.label)}</button>`).join('\n        ')}
      </div>
    </header>
    ${featured}
    <p id="work-live" class="sr-only" aria-live="polite"></p>
    <ul class="work-grid" role="list">
      ${grid}
    </ul>
  </div>
</section>`;

  const S = C.story;
  const marks = S.chapters.map((ch) => `<p class="timeline__mark"><b>${esc(ch.n)}</b>${esc(ch.mark)}</p>`).join('');
  const chapters = S.chapters.map((ch) => {
    const textBlock = `<p class="chapter__num">${esc(ch.n)}</p>
          <h3 class="chapter__title">${esc(ch.title)}</h3>
          <p class="chapter__big">${md(ch.big)}</p>
          <p class="chapter__text">${md(ch.text)}</p>
          ${ch.path ? `<ol class="chapter__path">${ch.path.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>` : ''}
          ${ch.links ? `<div class="chapter__links">${ch.links.map((l) => `<a class="link-arrow" href="${l.href}">${esc(l.label)} ${ICON.arrow}</a>`).join('')}</div>` : ''}`;
    if (ch.photo) {
      return `<li class="chapter chapter--photo reveal" data-n="${esc(ch.n)}">
        <div class="chapter__grid">
          <div>
          ${textBlock}
          </div>
          ${photo({ prefix, src: 'photo-face-600', w: 600, h: 800, alt: C.about.photoAlt, cls: '', caption: 'Badalona' })}
        </div>
      </li>`;
    }
    return `<li class="chapter reveal" data-n="${esc(ch.n)}">
          ${textBlock}
      </li>`;
  }).join('\n      ');

  const story = `<section class="section story" id="historia" aria-labelledby="historia-title">
  <div class="container">
    <header class="section-head">
      <p class="kicker reveal">${esc(S.kicker)}</p>
      <h2 class="display display--l" id="historia-title" data-scramble>${displayTitle(S.title)}</h2>
      <p class="section-head__intro reveal">${md(S.intro)}</p>
    </header>
    <div class="story__layout">
      <div class="timeline" aria-hidden="true"><div class="timeline__track">${marks}</div></div>
      <ol class="story__chapters">
      ${chapters}
      </ol>
    </div>
  </div>
</section>`;

  const A = C.about;
  const about = `<section class="section about" id="sobre-mi" aria-labelledby="sobre-title">
  <div class="container">
    <header class="section-head">
      <p class="kicker reveal">${esc(A.kicker)}</p>
      <h2 class="display display--l" id="sobre-title" data-scramble>${displayTitle(A.title)}</h2>
    </header>
  </div>
  <div class="container about__grid">
    ${photo({ prefix, src: 'photo-800', w: 800, h: 1200, alt: A.photoAlt, cls: 'about__photo duo--reveal reveal' })}
    <div>
      <div class="about__words reveal">
        <p class="about__wordsIntro">${esc(A.wordsIntro)}</p>
        <ol class="about__wordsList">${A.words.map((w, i) => `<li><span>${String(i + 1).padStart(2, '0')}</span>${esc(w)}</li>`).join('')}</ol>
      </div>
      <div class="about__cols">
        <div class="about__block reveal">
          <h3>${esc(A.howTitle)}</h3>
          <dl class="howlist">${A.how.map((h) => `<div><dt>${esc(h.k)}</dt><dd>${esc(h.v)}</dd></div>`).join('')}</dl>
        </div>
        <div class="about__block reveal">
          <h3>${esc(A.outsideTitle)}</h3>
          ${typeof A.outside[0] === 'object' ? `<dl class="outside-list">${A.outside.map((o) => `<div><dt>${esc(o.k)}</dt><dd>${esc(o.v)}</dd></div>`).join('')}</dl>` : tags(A.outside)}
          <p class="about__outsideText">${esc(A.outsideText)}</p>
        </div>
        <div class="about__block reveal">
          <h3>${esc(A.langTitle)}</h3>
          <dl class="leaders">${A.languages.map((l) => `<div><dt>${esc(l.k)}</dt><span class="dots" aria-hidden="true"></span><dd>${esc(l.v)}</dd></div>`).join('')}</dl>
        </div>
        <div class="about__block reveal">
          <h3>${esc(A.placeTitle)}</h3>
          <p class="about__place">${esc(A.place)}</p>
          <p>${esc(A.placeSub)}</p>
        </div>
      </div>
    </div>
  </div>
</section>`;

  const E = C.education;
  const edu = `<section class="section edu" id="formacion" aria-labelledby="formacion-title">
  <div class="container">
    <header class="section-head">
      <p class="kicker reveal">${esc(E.kicker)}</p>
      <h2 class="display display--l" id="formacion-title" data-scramble>${displayTitle(E.title)}</h2>
    </header>
    <div class="edu__grid">
      <ol class="edu-list">
        ${E.items.map((it) => `<li class="edu-item${it.current ? ' edu-item--current' : ''} reveal">
          <p class="edu-item__when">${esc(it.when)}</p>
          <h3 class="edu-item__title">${esc(it.title)}</h3>
          <p class="edu-item__org">${esc(it.org)}</p>
          ${it.text ? `<p class="edu-item__text">${md(it.text)}</p>` : ''}
        </li>`).join('\n        ')}
      </ol>
      <div class="exp reveal">
        <h3 class="exp__title">${esc(E.expTitle)}</h3>
        ${E.experience.map((x) => `<article class="exp-item">
          <div class="exp-item__top"><h4 class="exp-item__title">${esc(x.title)}</h4><span class="exp-item__when">${esc(x.when)}</span></div>
          <p class="exp-item__org">${esc(x.org)}</p>
          <ul>${x.points.map((p) => `<li>${md(p)}</li>`).join('')}</ul>
        </article>`).join('\n        ')}
      </div>
    </div>
  </div>
</section>`;

  const K = C.contact;
  const contact = `<section class="section contact" id="contacto" aria-labelledby="contacto-title">
  <div class="container">
    <header class="section-head">
      <p class="kicker reveal">${esc(K.kicker)}</p>
      <h2 class="display display--xl" id="contacto-title" data-scramble>${displayTitle(K.title)}</h2>
    </header>
  </div>
  <div class="container contact__grid">
    <div>
      <p class="contact__avail reveal">${md(K.availability)}</p>
      <p class="contact__text reveal">${md(K.text)}</p>
      <div class="contact__actions reveal"><a class="btn" href="${P.cvFile}" download="${P.cvDownloadName}">${esc(K.cvCta)} ${ICON.down}</a></div>
    </div>
    <ul class="contact-list reveal">
      ${K.items.map((it) => `<li><a href="${it.href}"${it.external ? ' target="_blank" rel="noopener"' : ''}><span class="k">${esc(it.k)}</span><span class="v">${esc(it.v)}</span>${ICON.arrowUR}</a></li>`).join('\n      ')}
    </ul>
  </div>
</section>`;

  const preload = '<link rel="preload" as="image" href="assets/scene-desktop.webp" media="(min-width: 1000px)" fetchpriority="high">';
  const html = `${head({ prefix, title: C.meta.title, description: C.meta.description, canonical: SITE, importmap: true, preloadImg: preload })}
<body>
${chrome(prefix, true)}
<main id="main">
${hero}
${work}
${story}
${about}
${edu}
${contact}
</main>
${footer(prefix, true)}
</body>
</html>
`;
  fs.writeFileSync(path.join(V2, 'index.html'), html);
}

/* ================================================================= CASOS */
function buildCases() {
  const items = C.work.items;
  const W = C.work;
  const prefix = '../';
  fs.mkdirSync(path.join(V2, 'trabajos'), { recursive: true });
  items.forEach((it, i) => {
    const prev = items[(i - 1 + items.length) % items.length];
    const next = items[(i + 1) % items.length];
    const longest = Math.max(...it.name.split(/\s+/).map((w) => w.length));
    const sec = (n, title, body, id) => `<section class="case-sec reveal" aria-labelledby="${id}">
        <div class="case-sec__head"><div class="case-sec__sticky"><p class="case-sec__num">${n}</p><h2 class="case-sec__title" id="${id}">${esc(title)}</h2></div></div>
        <div>${body}</div>
      </section>`;
    const prose = (arr) => `<div class="prose">${arr.map((p) => `<p>${md(p)}</p>`).join('')}</div>`;
    const SEC = { ...W.sections, ...(it.sections || {}) };
    const related = it.related ? `<a class="link-arrow" href="${it.related.href}">${esc(it.related.label)} ${ICON.arrow}</a>` : '';
    const repoBtn = it.repo
      ? `<a class="btn" href="${it.repo}" target="_blank" rel="noopener">${esc(UI.repo)} ${ICON.arrowUR}</a>`
      : `<span class="chip chip--idea">${esc(UI.noCode || UI.repoMissing)}</span>`;
    const stack = `<div class="stack-groups">${it.stack.map((g) => `<div><h3>${esc(g.group)}</h3>${tags(g.items)}</div>`).join('')}</div>`;
    const learned = `<div class="case-learned"><h3>${esc({ ...W.sections, ...(it.sections || {}) }.learned)}</h3>${it.learned.map((p) => `<p>${md(p)}</p>`).join('')}</div>`;
    const desc = `${it.oneLiner} Caso de estudio de ${P.name}.`;
    const html = `${head({ prefix, title: `${it.name} — ${P.name}`, description: desc, canonical: `${SITE}trabajos/${it.slug}.html`, ogType: 'article' })}
<body>
${chrome(prefix, false)}
<main id="main">
  <article class="case">
    <header class="container case-hero">
      <nav class="crumbs" aria-label="Ruta">
        <a href="../#trabajos">${ICON.arrow} ${esc(UI.backToWork)}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">${esc(it.name)}</span>
      </nav>
      <div class="case-hero__chips"><span class="chip">${esc(W.categories[it.category])}</span>${chip(it)}</div>
      <h1 class="case-hero__title" style="--len:${longest}" data-scramble>${esc(it.name)}</h1>
      <p class="case-hero__one">${md(it.oneLiner)}</p>
      <dl class="facts">${it.facts.map((f) => `<div><dt>${esc(f.k)}</dt><dd>${md(f.v)}</dd></div>`).join('')}</dl>
      <div class="case-hero__actions">${repoBtn}${related}<a class="link-arrow" href="../#trabajos">${esc(UI.backToWork)} ${ICON.arrow}</a></div>
    </header>
    <div class="container case-visual reveal">
      ${visual(it)}
    </div>
    <div class="container case-body">
      ${sec('01', SEC.challenge, prose(it.challenge), 'reto')}
      ${sec('02', SEC.approach, prose(it.approach) + diagram(it.diagram, 'dg-' + it.slug), 'hice')}
      ${sec('03', SEC.stack, stack, 'stack')}
      ${sec('04', `${SEC.result} y ${SEC.learned.toLowerCase()}`, prose(it.result) + learned, 'resultado')}
    </div>
    <nav class="container pager" aria-label="Otros trabajos">
      <a href="${prev.slug}.html"><span>← ${esc(UI.prev)}</span><b>${esc(prev.name)}</b></a>
      <a href="${next.slug}.html"><span>${esc(UI.next)} →</span><b>${esc(next.name)}</b></a>
    </nav>
  </article>
</main>
${footer(prefix, false)}
</body>
</html>
`;
    fs.writeFileSync(path.join(V2, 'trabajos', `${it.slug}.html`), html);
  });
}

/* ================================================================= 404 */
function build404() {
  // 404 de GitHub Pages: se sirve en cualquier ruta; <base href> fija dónde resolver las rutas relativas
  const prefix = '';
  const html = `${head({ prefix, title: `${UI.notFoundTitle} — ${P.name}`, description: UI.notFoundText, canonical: SITE + '404.html' }).replace('<meta charset="utf-8">', `<meta charset="utf-8">
<base href="${BASE_404}">
<meta name="robots" content="noindex">`)}
<body>
${chrome(prefix, false)}
<main id="main" class="notfound">
  <div>
    <p class="notfound__code" aria-hidden="true">404</p>
    <h1 class="display display--m">${esc(UI.notFoundTitle)}</h1>
    <p class="notfound__term"><b>${esc(P.brand)} ~$</b> cd ruta-perdida<br>cd: no such file or directory</p>
    <p class="section-head__intro" style="margin-top:18px">${esc(UI.notFoundText)}</p>
    <p style="margin-top:28px"><a class="btn" href="./">${esc(UI.notFoundCta)} ${ICON.arrow}</a></p>
  </div>
</main>
<div class="grain" aria-hidden="true"></div>
</body>
</html>
`;
  fs.writeFileSync(path.join(V2, '404.html'), html);
}

/* ================================================================= CV */
function buildCV() {
  const CV = C.cv;
  const entry = (e, kind) => `<article class="cv-entry">
      <div class="cv-entry__row"><h3 class="cv-entry__title"><span>${md(e.title)}</span></h3><span class="cv-leader" aria-hidden="true"></span><span class="cv-entry__date">${esc(e.when || e.right)}</span></div>
      ${e.detail ? `<div class="cv-entry__sub"><p class="cv-entry__detail">${esc(e.detail)}</p>${e.where ? `<span class="cv-entry__place">${esc(e.where)}</span>` : ''}</div>` : (e.where ? `<span class="cv-entry__place cv-float">${esc(e.where)}</span>` : '')}
      ${e.points && e.points.length ? `<ul class="cv-bullets">${e.points.map((p) => `<li>${md(p)}</li>`).join('')}</ul>` : ''}
      ${e.href ? `<p class="cv-entry__link"><a href="${e.href}">${esc(e.link)}</a></p>` : ''}
    </article>`;
  const leaders = (list) => `<dl class="cv-leaders">${list.map((s) => `<div><dt>${esc(s.k)}</dt><span class="cv-leader" aria-hidden="true"></span><dd>${esc(s.v)}</dd></div>`).join('')}</dl>`;
  const sec = (title, body, cls = '') => `<section class="cv-sec ${cls}"><h2 class="cv-h"><span>${esc(title)}</span></h2>${body}</section>`;
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(CV.fileTitle)}</title>
<meta name="description" content="CV de ${esc(P.name)}: ${esc(CV.headline)}.">
<meta name="author" content="${esc(P.name)}">
<meta name="robots" content="noindex">
<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="cv.css">
</head>
<body>
<main class="page">
  <header class="cv-head">
    <h1 class="cv-name">${esc(P.name)}</h1>
    <p class="cv-title">${esc(CV.headline)}</p>
    <p class="cv-subline">${esc(CV.subline)}</p>
    <p class="cv-links">
      <a href="${P.portfolioUrl}"><span>Portfolio:</span> ${esc(P.portfolio)}</a>
      <span class="sep" aria-hidden="true">·</span>
      <a href="${P.githubUrl}"><span>GitHub:</span> ${esc(P.github)}</a>
      <span class="sep" aria-hidden="true">·</span>
      <a href="${P.linkedinUrl}"><span>LinkedIn:</span> ${esc(P.linkedin)}</a>
    </p>
    <div class="cv-contact">
      <a href="${P.phoneHref}">${esc(P.phoneIntl)}</a>
      <span>${esc(P.location)}</span>
      <a href="mailto:${P.email}">${esc(P.email)}</a>
    </div>
  </header>
  ${sec(CV.sections.profile, `<p class="cv-profile">${md(CV.profile)}</p>${CV.softSkills ? `<ul class="cv-soft">${CV.softSkills.map((s) => `<li><b>${esc(s.k)}</b><span>${esc(s.v)}</span></li>`).join('')}</ul>` : ''}`)}
  ${sec(CV.sections.portfolio, `<div class="cv-portfolio">
      <div>
        <p>${md(CV.portfolio)}</p>
        <p class="cv-urls"><a href="${P.portfolioUrl}">${esc(P.portfolio)}</a><span class="sep" aria-hidden="true">·</span><a href="${P.githubUrl}">${esc(P.github)}</a></p>
      </div>
      <img class="cv-qr" src="qr-portfolio.svg" alt="Código QR que enlaza a ${esc(P.portfolio)}" width="64" height="64">
    </div>`, 'cv-sec--framed')}
  ${sec(CV.sections.education, CV.education.map((e) => entry(e)).join(''))}
  ${sec(CV.sections.experience, CV.experience.map((e) => entry(e)).join(''))}
  ${sec(CV.sections.projects, CV.projects.map((e) => entry(e)).join(''))}
  ${sec(CV.sections.skills, leaders(CV.skills), 'cv-sec--cols')}
  ${sec(CV.sections.languages, leaders(CV.languages), 'cv-sec--cols cv-sec--langs')}
</main>
</body>
</html>
`;
  fs.writeFileSync(path.join(V2, 'cv', 'cv.html'), html);
}

buildIndex();
buildCases();
build404();
buildCV();
console.log('OK: index.html, trabajos/*.html (' + C.work.items.length + '), 404.html, cv/cv.html');
