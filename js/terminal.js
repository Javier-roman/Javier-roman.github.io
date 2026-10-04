// Terminal animado que se dibuja en un <canvas> y se usa como textura del monitor.
// Contenido neutro y personal (whoami, lema, proyectos, git log). Pausado y legible.

const COLORS = {
  bgTop: '#17121f',
  bgBottom: '#0c0a11',
  bar: 'rgba(255,255,255,0.045)',
  barText: '#8b8b95',
  dot: '#3b3644',
  prompt: '#b4a5ff',
  cmd: '#ededef',
  out: '#c4c0d2',
  cursor: '#b4a5ff',
};

export class TerminalScreen {
  // scale: resolución extra del lienzo (se dibuja en coordenadas de 1024×640 y se ve nítido de cerca)
  constructor({ prompt = '~$', script = [], width = 1024, height = 640, title = 'terminal', scale = 1.5 } = {}) {
    this.prompt = prompt;
    this.script = script;
    this.title = title;
    this.canvas = document.createElement('canvas');
    this.W = width;
    this.H = height;
    this.k = scale;
    this.canvas.width = Math.round(width * scale);
    this.canvas.height = Math.round(height * scale);
    this.ctx = this.canvas.getContext('2d');
    this.font = 26;
    this.lineH = 38;
    this.padX = 40;
    this.top = 84;
    this.rows = Math.floor((height - this.top - 26) / this.lineH);
    this.isTyping = false;
    this.hold = false;   // en pausa mientras el personaje saluda: no avanza el guion
    this.typedCount = 0; // cada carácter tecleado (la escena hunde una tecla)
    this.blinkT = 0;
    this.cursorOn = true;
    this.reset();
  }

  async ready() {
    try { await document.fonts.load(`500 ${this.font}px "JetBrains Mono"`); } catch (e) { /* fallback mono */ }
    this.draw();
  }

  reset() {
    this.lines = [];
    this.idx = 0;
    this.phase = 'prompt';
    this.timer = 0.5;
    this.typed = 0;
    this.outIdx = 0;
    this.isTyping = false;
  }

  get current() { return this.script[this.idx]; }

  pushLine(segments) {
    this.lines.push(segments);
    if (this.lines.length > this.rows) this.lines.shift();
  }

  // Avanza la animación. Devuelve true si hay que actualizar la textura.
  update(dt) {
    let dirty = false;
    this.blinkT += dt;
    const on = (this.blinkT % 1.06) < 0.6 || (this.isTyping && !this.hold);
    if (on !== this.cursorOn) { this.cursorOn = on; dirty = true; }
    if (this.hold) { if (dirty) this.draw(); return dirty; }   // solo parpadea el cursor

    this.timer -= dt;
    let guard = 0;
    while (this.timer <= 0 && guard++ < 50) {
      const step = this.current;
      switch (this.phase) {
        case 'prompt':
          this.pushLine([{ t: this.prompt + ' ', c: COLORS.prompt }, { t: '', c: COLORS.cmd }]);
          this.typed = 0;
          this.phase = 'type';
          this.timer += 0.45;
          break;
        case 'type': {
          const cmd = step.cmd;
          if (this.typed < cmd.length) {
            this.typed++;
            this.typedCount++;
            this.lines[this.lines.length - 1][1].t = cmd.slice(0, this.typed);
            this.isTyping = true;
            const ch = cmd[this.typed - 1];
            this.timer += 0.055 + Math.random() * 0.075 + (ch === ' ' ? 0.08 : 0);
          } else {
            this.isTyping = false;
            this.phase = 'enter';
            this.timer += 0.38;
          }
          break;
        }
        case 'enter':
          this.phase = 'out';
          this.outIdx = 0;
          this.timer += 0.1;
          break;
        case 'out':
          if (this.outIdx < step.out.length) {
            this.pushLine([{ t: step.out[this.outIdx], c: COLORS.out }]);
            this.outIdx++;
            this.timer += 0.075;
          } else {
            this.idx++;
            if (this.idx >= this.script.length) { this.phase = 'hold'; this.timer += 4.2; }
            else { this.phase = 'prompt'; this.timer += 1.05; }
          }
          break;
        case 'hold':
          this.reset();
          this.timer += 0.4;
          break;
      }
      dirty = true;
    }
    if (dirty) this.draw();
    return dirty;
  }

  // Avanza N segundos sin dibujar (para capturas estáticas)
  fastForward(seconds) {
    const rnd = Math.random;
    let seed = 7;
    Math.random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const dt = 1 / 60;
    for (let s = 0; s < seconds; s += dt) {
      this.update(dt);
    }
    Math.random = rnd;
    this.isTyping = false;
    this.cursorOn = true;
    this.draw();
  }

  draw() {
    const { ctx } = this;
    const W = this.W, H = this.H;
    ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
    // fondo
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, COLORS.bgTop);
    g.addColorStop(1, COLORS.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // brillo suave inferior
    const r = ctx.createRadialGradient(W * 0.5, H * 1.05, 10, W * 0.5, H * 1.05, H * 0.9);
    r.addColorStop(0, 'rgba(242,182,236,0.10)');
    r.addColorStop(1, 'rgba(242,182,236,0)');
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, W, H);
    // barra de título
    ctx.fillStyle = COLORS.bar;
    ctx.fillRect(0, 0, W, 52);
    ctx.fillStyle = COLORS.dot;
    [30, 56, 82].forEach((x) => { ctx.beginPath(); ctx.arc(x, 26, 8, 0, Math.PI * 2); ctx.fill(); });
    ctx.font = `500 19px "JetBrains Mono", ui-monospace, monospace`;
    ctx.fillStyle = COLORS.barText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.title, W / 2, 27);
    // texto
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `500 ${this.font}px "JetBrains Mono", ui-monospace, monospace`;
    const charW = ctx.measureText('M').width;
    let y = this.top + this.font * 0.82;
    let cursorX = this.padX, cursorY = y;
    this.lines.forEach((segs, i) => {
      let x = this.padX;
      segs.forEach((s) => {
        ctx.fillStyle = s.c;
        ctx.fillText(s.t, x, y);
        x += s.t.length * charW;
      });
      if (i === this.lines.length - 1) { cursorX = x; cursorY = y; }
      y += this.lineH;
    });
    // cursor de bloque
    const waiting = this.phase === 'prompt' || this.phase === 'type' || this.phase === 'enter';
    if (this.cursorOn && waiting && this.lines.length) {
      ctx.fillStyle = COLORS.cursor;
      ctx.fillRect(cursorX + 2, cursorY - this.font * 0.8, charW * 0.62, this.font * 0.98);
    }
  }
}
