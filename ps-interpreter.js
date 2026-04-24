/**
 * ps-interpreter.js — PostScript Interpreter Core
 * Stack machine, dictionary stack, operator dispatch, built-in operators.
 */
const PSInterpreter = (() => {
  'use strict';

  const MARK = Symbol('MARK');

  class Interpreter {
    constructor(graphics, logger) {
      this.gfx = graphics;
      this.log = logger || (() => {});
      this.operandStack = [];
      this.dictStack = [{}];
      this.patterns = {};
      this.executionDepth = 0;
      this.maxDepth = 1000;
      this._registerBuiltins();
    }

    push(v) { this.operandStack.push(v); }
    pop() {
      if (this.operandStack.length === 0) {
        this.log('Stack underflow', 'warn');
        return null;
      }
      return this.operandStack.pop();
    }
    peek() { return this.operandStack[this.operandStack.length - 1]; }

    currentDict() { return this.dictStack[this.dictStack.length - 1]; }
    define(name, value) { this.currentDict()[name] = value; }
    lookup(name) {
      for (let i = this.dictStack.length - 1; i >= 0; i--) {
        if (Object.prototype.hasOwnProperty.call(this.dictStack[i], name)) {
          return this.dictStack[i][name];
        }
      }
      return undefined;
    }

    execute(program) {
      for (const node of program) {
        this._execNode(node);
      }
    }

    _execNode(node) {
      if (++this.executionDepth > this.maxDepth) {
        this.executionDepth--;
        throw new Error('Execution depth exceeded');
      }
      try {
        switch (node.type) {
          case 'NUMBER':
          case 'STRING':
            this.push(node.value);
            break;
          case 'LITERAL_NAME':
            this.push({ literalName: node.value });
            break;
          case 'PROCEDURE':
            this.push({ procedure: node.body });
            break;
          case 'MARK':
            this.push(MARK);
            break;
          case 'BUILD_ARRAY': {
            const arr = [];
            while (this.operandStack.length > 0) {
              const v = this.pop();
              if (v === MARK) break;
              arr.unshift(v);
            }
            this.push(arr);
            break;
          }
          case 'EXECUTABLE_NAME':
            this._execName(node.value);
            break;
        }
      } finally {
        this.executionDepth--;
      }
    }

    _execName(name) {
      // User-defined takes priority (allows overriding builtins like 'print')
      const val = this.lookup(name);
      if (val !== undefined) {
        if (val && val.procedure) {
          this.execute(val.procedure);
        } else {
          this.push(val);
        }
        return;
      }
      const builtin = this._builtins[name];
      if (builtin) { builtin.call(this); return; }
      this.log(`Unknown: ${name}`, 'warn');
    }

    runSource(source) {
      const program = PSParser.compile(source);
      this.execute(program);
    }

    reset() {
      this.operandStack = [];
      this.dictStack = [{}];
      this.patterns = {};
      this.executionDepth = 0;
      this._registerBuiltins();
      this.gfx.reset();
    }

    _registerBuiltins() {
      const gfx = this.gfx;
      const self = this;

      this._builtins = {
        // --- Stack ---
        'pop':   () => { self.pop(); },
        'dup':   () => { const a = self.pop(); self.push(a); self.push(a); },
        'exch':  () => { const a = self.pop(); const b = self.pop(); self.push(a); self.push(b); },
        'copy':  () => {
          const n = self.pop();
          const items = self.operandStack.slice(-n);
          self.operandStack.push(...items);
        },
        'index': () => {
          const n = self.pop();
          self.push(self.operandStack[self.operandStack.length - 1 - n]);
        },
        'roll':  () => {
          const j = self.pop();
          const n = self.pop();
          const idx = self.operandStack.length - n;
          const sub = self.operandStack.splice(idx);
          const shift = ((j % n) + n) % n;
          const rolled = [...sub.slice(sub.length - shift), ...sub.slice(0, sub.length - shift)];
          self.operandStack.push(...rolled);
        },
        'clear': () => { self.operandStack = []; },
        'count': () => { self.push(self.operandStack.length); },
        'mark':  () => { self.push(MARK); },

        // --- Arithmetic ---
        'add': () => { const b = self.pop(); const a = self.pop(); self.push(a + b); },
        'sub': () => { const b = self.pop(); const a = self.pop(); self.push(a - b); },
        'mul': () => { const b = self.pop(); const a = self.pop(); self.push(a * b); },
        'div': () => { const b = self.pop(); const a = self.pop(); self.push(a / b); },
        'mod': () => { const b = self.pop(); const a = self.pop(); self.push(a % b); },
        'neg': () => { self.push(-self.pop()); },
        'abs': () => { self.push(Math.abs(self.pop())); },
        'ceiling': () => { self.push(Math.ceil(self.pop())); },
        'floor':   () => { self.push(Math.floor(self.pop())); },
        'round':   () => { self.push(Math.round(self.pop())); },
        'sqrt':    () => { self.push(Math.sqrt(self.pop())); },
        'sin':     () => { self.push(Math.sin(self.pop() * Math.PI / 180)); },
        'cos':     () => { self.push(Math.cos(self.pop() * Math.PI / 180)); },
        'atan':    () => { const x = self.pop(); const y = self.pop(); self.push(Math.atan2(y, x) * 180 / Math.PI); },
        'ln':      () => { self.push(Math.log(self.pop())); },
        'log':     () => { self.push(Math.log10(self.pop())); },
        'exp':     () => { const e = self.pop(); const b = self.pop(); self.push(Math.pow(b, e)); },
        'rand':    () => { self.push(Math.floor(Math.random() * 2147483647)); },

        // --- Comparison ---
        'eq': () => { const b = self.pop(); const a = self.pop(); self.push(a === b); },
        'ne': () => { const b = self.pop(); const a = self.pop(); self.push(a !== b); },
        'gt': () => { const b = self.pop(); const a = self.pop(); self.push(a > b); },
        'lt': () => { const b = self.pop(); const a = self.pop(); self.push(a < b); },
        'ge': () => { const b = self.pop(); const a = self.pop(); self.push(a >= b); },
        'le': () => { const b = self.pop(); const a = self.pop(); self.push(a <= b); },
        'and': () => { const b = self.pop(); const a = self.pop(); self.push(a && b); },
        'or':  () => { const b = self.pop(); const a = self.pop(); self.push(a || b); },
        'not': () => { self.push(!self.pop()); },
        'true':  () => { self.push(true); },
        'false': () => { self.push(false); },

        // --- Control ---
        'if': () => {
          const proc = self.pop();
          const cond = self.pop();
          if (cond && proc && proc.procedure) self.execute(proc.procedure);
        },
        'ifelse': () => {
          const elseProc = self.pop();
          const ifProc = self.pop();
          const cond = self.pop();
          if (cond) { if (ifProc && ifProc.procedure) self.execute(ifProc.procedure); }
          else { if (elseProc && elseProc.procedure) self.execute(elseProc.procedure); }
        },
        'for': () => {
          const proc = self.pop();
          const limit = self.pop();
          const inc = self.pop();
          const init = self.pop();
          if (inc > 0) {
            for (let i = init; i <= limit; i += inc) {
              self.push(i);
              if (proc && proc.procedure) self.execute(proc.procedure);
            }
          } else {
            for (let i = init; i >= limit; i += inc) {
              self.push(i);
              if (proc && proc.procedure) self.execute(proc.procedure);
            }
          }
        },
        'repeat': () => {
          const proc = self.pop();
          const n = self.pop();
          for (let i = 0; i < n; i++) {
            if (proc && proc.procedure) self.execute(proc.procedure);
          }
        },
        'loop': () => {
          const proc = self.pop();
          try {
            while (true) { if (proc && proc.procedure) self.execute(proc.procedure); }
          } catch (e) { if (e.message !== 'exit') throw e; }
        },
        'exit': () => { throw new Error('exit'); },
        'stopped': () => {
          const proc = self.pop();
          try {
            if (proc && proc.procedure) self.execute(proc.procedure);
            self.push(false);
          } catch (e) { self.push(true); }
        },

        // --- Dictionary ---
        'def': () => {
          if (self.operandStack.length < 2) return;
          const value = self.pop();
          const key = self.pop();
          if (key && key.literalName) self.define(key.literalName, value);
        },
        'dict': () => { self.pop(); self.push({}); },
        'begin': () => {
          const d = self.pop();
          self.dictStack.push(
            (d && typeof d === 'object' && !Array.isArray(d) && !d.procedure && !d.literalName) ? d : {}
          );
        },
        'end': () => { if (self.dictStack.length > 1) self.dictStack.pop(); },
        'load': () => {
          const key = self.pop();
          const name = (key && key.literalName) || key;
          const val = self.lookup(name);
          self.push(val !== undefined ? val : null);
        },
        'where': () => {
          const key = self.pop();
          const name = (key && key.literalName) || key;
          for (let i = self.dictStack.length - 1; i >= 0; i--) {
            if (Object.prototype.hasOwnProperty.call(self.dictStack[i], name)) {
              self.push(self.dictStack[i]);
              self.push(true);
              return;
            }
          }
          self.push(false);
        },
        'known': () => {
          const key = self.pop();
          const dict = self.pop();
          const name = (key && key.literalName) || key;
          self.push(dict && typeof dict === 'object' && name in dict);
        },
        'currentdict': () => { self.push(self.currentDict()); },

        // --- String / Text ---
        'show': () => {
          const text = self.pop();
          gfx.showText(String(text));
        },
        'stringwidth': () => {
          const text = self.pop();
          if (gfx.state.font) {
            const m = PSFonts.measure(gfx.ctx, String(text), gfx.state.font.entry, gfx.state.font.size);
            self.push(m.width);
            self.push(0);
          } else {
            self.push(0); self.push(0);
          }
        },
        'length': () => {
          const v = self.pop();
          self.push(typeof v === 'string' ? v.length : (Array.isArray(v) ? v.length : 0));
        },

        // --- Type ---
        'type': () => {
          const v = self.pop();
          if (typeof v === 'number') self.push('integertype');
          else if (typeof v === 'string') self.push('stringtype');
          else if (typeof v === 'boolean') self.push('booleantype');
          else if (v && v.procedure) self.push('arraytype');
          else if (v && v.literalName) self.push('nametype');
          else self.push('nulltype');
        },
        'cvs': () => { self.pop(); const v = self.pop(); self.push(String(v)); },

        // --- Array ---
        'array': () => { const n = self.pop(); self.push(new Array(n).fill(0)); },
        'aload': () => {
          const arr = self.pop();
          if (Array.isArray(arr)) arr.forEach(v => self.push(v));
          self.push(arr);
        },
        'astore': () => {
          const arr = self.pop();
          if (Array.isArray(arr)) {
            for (let i = arr.length - 1; i >= 0; i--) arr[i] = self.pop();
            self.push(arr);
          }
        },
        'get': () => {
          const idx = self.pop();
          const arr = self.pop();
          if (Array.isArray(arr)) self.push(arr[idx]);
          else if (typeof arr === 'object' && arr) self.push(arr[(idx && idx.literalName) || idx]);
          else self.push(null);
        },
        'put': () => {
          const val = self.pop();
          const idx = self.pop();
          const arr = self.pop();
          if (Array.isArray(arr)) arr[idx] = val;
          else if (typeof arr === 'object' && arr) arr[(idx && idx.literalName) || idx] = val;
        },
        'forall': () => {
          const proc = self.pop();
          const collection = self.pop();
          if (Array.isArray(collection)) {
            for (const item of collection) {
              self.push(item);
              if (proc && proc.procedure) self.execute(proc.procedure);
            }
          }
        },

        // --- Graphics State ---
        'gsave':    () => { gfx.gsave(); },
        'grestore': () => { gfx.grestore(); },
        'setrgbcolor': () => {
          const b = self.pop(); const g = self.pop(); const r = self.pop();
          gfx.setColor(r, g, b);
        },
        'sethsbcolor': () => {
          const bv = self.pop(); const s = self.pop(); const h = self.pop();
          const [r, g, b] = hsbToRgb(h, s, bv);
          gfx.setColor(r, g, b);
        },
        'setgray': () => {
          const g = self.pop();
          gfx.setColor(g, g, g);
        },
        'setlinewidth': () => { gfx.setLineWidth(self.pop()); },
        'setlinecap':   () => { gfx.setLineCap(self.pop()); },
        'setlinejoin':  () => { gfx.setLineJoin(self.pop()); },
        'setdash':      () => { self.pop(); self.pop(); },
        'currentpoint': () => {
          self.push(gfx.state.currentX);
          self.push(gfx.state.currentY);
        },

        // --- Path ---
        'newpath':   () => { gfx.newPath(); },
        'moveto':    () => { const y = self.pop(); const x = self.pop(); gfx.moveTo(x, y); },
        'rmoveto':   () => {
          const dy = self.pop(); const dx = self.pop();
          gfx.moveTo(gfx.state.currentX + dx, gfx.state.currentY + dy);
        },
        'lineto':    () => { const y = self.pop(); const x = self.pop(); gfx.lineTo(x, y); },
        'rlineto':   () => {
          const dy = self.pop(); const dx = self.pop();
          gfx.lineTo(gfx.state.currentX + dx, gfx.state.currentY + dy);
        },
        'curveto':   () => {
          const y3 = self.pop(); const x3 = self.pop();
          const y2 = self.pop(); const x2 = self.pop();
          const y1 = self.pop(); const x1 = self.pop();
          gfx.curveTo(x1, y1, x2, y2, x3, y3);
        },
        'arc':       () => {
          const ea = self.pop(); const sa = self.pop();
          const r = self.pop(); const y = self.pop(); const x = self.pop();
          gfx.arc(x, y, r, sa, ea, false);
        },
        'arcn':      () => {
          const ea = self.pop(); const sa = self.pop();
          const r = self.pop(); const y = self.pop(); const x = self.pop();
          gfx.arc(x, y, r, sa, ea, true);
        },
        'closepath': () => { gfx.closePath(); },
        'clip':      () => { gfx.clip(); },
        'clippath':  () => { gfx.ctx.rect(0, 0, gfx.psWidth, -gfx.psHeight); },
        'pathbbox':  () => { self.push(0); self.push(0); self.push(gfx.psWidth); self.push(gfx.psHeight); },

        // --- Painting ---
        'fill':       () => { gfx.fill(); },
        'stroke':     () => { gfx.stroke(); },
        'eofill':     () => { gfx.eofill(); },
        'rectfill':   () => {
          const h = self.pop(); const w = self.pop();
          const y = self.pop(); const x = self.pop();
          gfx.rectFill(x, y, w, h);
        },
        'rectstroke': () => {
          const h = self.pop(); const w = self.pop();
          const y = self.pop(); const x = self.pop();
          gfx.rectStroke(x, y, w, h);
        },
        'showpage':   () => { self.log('--- showpage ---', 'info'); },

        // --- Font ---
        'findfont': () => {
          const name = self.pop();
          const fontName = (typeof name === 'string') ? name : ((name && name.literalName) || 'Helvetica');
          const entry = PSFonts.resolve(fontName);
          self.push({ fontEntry: entry, fontName });
        },
        'scalefont': () => {
          const size = self.pop();
          const font = self.pop();
          if (font && font.fontEntry) {
            self.push({ ...font, fontSize: size });
          } else {
            self.push({ fontEntry: PSFonts.resolve('Helvetica'), fontName: 'Helvetica', fontSize: size });
          }
        },
        'makefont': () => {
          const matrix = self.pop();
          const font = self.pop();
          if (font && font.fontEntry) {
            self.push({ ...font, fontMatrix: matrix });
          } else {
            self.push({ fontEntry: PSFonts.resolve('Helvetica'), fontName: 'Helvetica', fontMatrix: matrix });
          }
        },
        'setfont': () => {
          const font = self.pop();
          if (!font || !font.fontEntry) return;
          if (font.fontMatrix) {
            gfx.setFontMatrix(font.fontEntry, font.fontMatrix);
          } else {
            gfx.setFont(font.fontEntry, font.fontSize || 12);
          }
        },
        'selectfont': () => {
          const size = self.pop();
          const name = self.pop();
          const fontName = (typeof name === 'string') ? name : ((name && name.literalName) || 'Helvetica');
          gfx.setFont(PSFonts.resolve(fontName), size);
        },

        // --- Pattern (disabled for now) ---
        'makepattern': () => {
          self.pop(); // matrix
          self.pop(); // dict
          self.push({ psPattern: null });
        },
        'setpattern': () => {
          self.pop(); // discard pattern
          // Set fill to transparent so the subsequent fill is invisible
          gfx.ctx.fillStyle = 'rgba(0,0,0,0)';
        },

        // --- Transform ---
        'translate': () => {
          const firstOp = self.pop();
          const secondOp = self.pop();
          if (Array.isArray(firstOp)) {
            // translate with matrix operand — return matrix
            self.push([1, 0, 0, 1, secondOp, self.pop()]);
          } else {
            gfx.translate(secondOp, firstOp);
          }
        },
        'scale': () => {
          const firstOp = self.pop();
          const secondOp = self.pop();
          if (Array.isArray(firstOp)) {
            self.push([secondOp, 0, 0, self.pop(), 0, 0]);
          } else {
            gfx.scale(secondOp, firstOp);
          }
        },
        'rotate': () => {
          const firstOp = self.pop();
          if (Array.isArray(firstOp)) {
            const angle = self.pop();
            const c = Math.cos(angle * Math.PI / 180);
            const s = Math.sin(angle * Math.PI / 180);
            self.push([c, s, -s, c, 0, 0]);
          } else {
            gfx.rotate(firstOp);
          }
        },
        'concat':         () => { gfx.concat(self.pop()); },
        'matrix':         () => { self.push([1, 0, 0, 1, 0, 0]); },
        'currentmatrix':  () => { self.pop(); self.push([1, 0, 0, 1, 0, 0]); },
        'setmatrix':      () => { self.pop(); },
        'identmatrix':    () => { /* no-op */ },

        // --- colorbar (US/UK spelling variants in the PS file) ---
        'colorbar': () => {
          const y = self.pop(); const x = self.pop();
          gfx.rectFill(x, y, 250, 50);
        },
        'colourbar': () => {
          const y = self.pop(); const x = self.pop();
          gfx.rectFill(x, y, 250, 50);
        },

        // --- Misc ---
        'bind':    () => { /* optimization hint, no-op */ },
        'null':    () => { self.push(null); },
        'version': () => { self.push('WebPS 1.0'); },
        'print':   () => { self.log(String(self.pop()), 'info'); },
        '=':       () => { self.log(String(self.pop()), 'info'); },
        '==':      () => { self.log(JSON.stringify(self.pop()), 'info'); },
        'pstack':  () => {
          self.operandStack.forEach((v, i) => self.log(`[${i}] ${formatValue(v)}`, 'info'));
        },
        'stack':   () => {
          for (let i = self.operandStack.length - 1; i >= 0; i--) {
            self.log(formatValue(self.operandStack[i]), 'info');
          }
        },
      };
    }
  }

  function hsbToRgb(h, s, v) {
    let r, g, b;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      case 5: r = v; g = p; b = q; break;
    }
    return [r, g, b];
  }

  function formatValue(v) {
    if (v === MARK) return '--mark--';
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') return String(v);
    if (v.literalName) return `/${v.literalName}`;
    if (v.procedure) return '{...}';
    if (v.psPattern) return '--pattern--';
    if (v.fontEntry) return `--font(${v.fontName})--`;
    if (Array.isArray(v)) return `[${v.map(formatValue).join(' ')}]`;
    return JSON.stringify(v);
  }

  return { Interpreter, MARK, formatValue };
})();

if (typeof module !== 'undefined') module.exports = PSInterpreter;
