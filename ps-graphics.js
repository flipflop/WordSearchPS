/**
 * ps-graphics.js — PostScript Graphics Engine
 * Canvas rendering using per-operation Y negation (reference PostCanvas approach).
 * Origin is translated to bottom-left; Y is negated in each draw call.
 */
const PSGraphics = (() => {
  'use strict';

  class GraphicsState {
    constructor() {
      this.color = [0, 0, 0];
      this.lineWidth = 1;
      this.currentX = 0;
      this.currentY = 0;
      this.font = null;           // {entry, size, scaleX}
      this.lineCap = 'butt';
      this.lineJoin = 'miter';
      this.pathSegments = [];     // track path ops so fill/gsave/grestore can replay
    }

    clone() {
      const s = new GraphicsState();
      s.color = [...this.color];
      s.lineWidth = this.lineWidth;
      s.currentX = this.currentX;
      s.currentY = this.currentY;
      s.font = this.font ? { ...this.font } : null;
      s.lineCap = this.lineCap;
      s.lineJoin = this.lineJoin;
      s.pathSegments = this.pathSegments.map(seg => ({ op: seg.op, args: [...seg.args] }));
      return s;
    }
  }

  class GraphicsEngine {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.stateStack = [];
      this.gstateStack = [];
      this.state = new GraphicsState();
      this.psWidth = 1000;
      this.psHeight = 800;
      this.scale = 1;
      this._setupCoordinates();
    }

    _setupCoordinates() {
      const dpr = window.devicePixelRatio || 1;
      const displayW = this.canvas.clientWidth;
      const displayH = this.canvas.clientHeight;
      this.canvas.width = displayW * dpr;
      this.canvas.height = displayH * dpr;

      const scaleX = (displayW * dpr) / this.psWidth;
      const scaleY = (displayH * dpr) / this.psHeight;
      this.scale = Math.min(scaleX, scaleY);

      // Fill entire canvas with the PS background color (light cyan)
      // so any area outside the PS coordinate space isn't white
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.fillStyle = '#e5ffff';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      // Scale then translate origin to bottom-left (like reference)
      this.ctx.scale(this.scale, this.scale);
      this.ctx.translate(0, this.psHeight);
    }

    clear() {
      this.ctx.save();
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.restore();
    }

    reset() {
      this.stateStack = [];
      this.gstateStack = [];
      this.state = new GraphicsState();
      this.clear();
      this._setupCoordinates();
    }

    // --- Graphics state save/restore ---
    gsave() {
      this.ctx.save();
      this.gstateStack.push(this.state.clone());
    }

    grestore() {
      this.ctx.restore();
      if (this.gstateStack.length > 0) {
        this.state = this.gstateStack.pop();
        // Canvas restore does NOT restore the path — replay from saved segments
        if (this.state.pathSegments.length > 0) {
          this._replayPath(this.state.pathSegments);
        }
      }
    }

    _replayPath(segments) {
      this.ctx.beginPath();
      for (const seg of segments) {
        switch (seg.op) {
          case 'moveTo':    this.ctx.moveTo(seg.args[0], -seg.args[1]); break;
          case 'lineTo':    this.ctx.lineTo(seg.args[0], -seg.args[1]); break;
          case 'curveTo':   this.ctx.bezierCurveTo(seg.args[0], -seg.args[1], seg.args[2], -seg.args[3], seg.args[4], -seg.args[5]); break;
          case 'arc': {
            const [x, y, r, sa, ea, ccw] = seg.args;
            this.ctx.arc(x, -y, r, -sa * Math.PI / 180, -ea * Math.PI / 180, !ccw);
            break;
          }
          case 'closePath': this.ctx.closePath(); break;
        }
      }
    }

    // --- Color ---
    setColor(r, g, b) {
      this.state.color = [r, g, b];
      const css = this._cssColor();
      // Reference sets both simultaneously
      this.ctx.fillStyle = css;
      this.ctx.strokeStyle = css;
    }

    _cssColor() {
      const [r, g, b] = this.state.color;
      return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
    }

    setLineWidth(w) {
      this.state.lineWidth = w;
      this.ctx.lineWidth = w;
    }

    setLineCap(cap) {
      const caps = ['butt', 'round', 'square'];
      this.ctx.lineCap = caps[cap] || 'butt';
    }

    setLineJoin(join) {
      const joins = ['miter', 'round', 'bevel'];
      this.ctx.lineJoin = joins[join] || 'miter';
    }

    // --- Path operations (Y negated per-call, like reference) ---
    // All path ops are recorded in state.pathSegments so gsave/grestore
    // can restore the path (canvas ctx.save/restore does NOT save paths).
    newPath() {
      this.ctx.beginPath();
      this.state.pathSegments = [];
    }

    moveTo(x, y) {
      this.state.currentX = x;
      this.state.currentY = y;
      this.state.pathSegments.push({ op: 'moveTo', args: [x, y] });
      this.ctx.moveTo(x, -y);
    }

    lineTo(x, y) {
      this.state.currentX = x;
      this.state.currentY = y;
      this.state.pathSegments.push({ op: 'lineTo', args: [x, y] });
      this.ctx.lineTo(x, -y);
    }

    curveTo(x1, y1, x2, y2, x3, y3) {
      this.state.currentX = x3;
      this.state.currentY = y3;
      this.state.pathSegments.push({ op: 'curveTo', args: [x1, y1, x2, y2, x3, y3] });
      this.ctx.bezierCurveTo(x1, -y1, x2, -y2, x3, -y3);
    }

    arc(x, y, r, startAngle, endAngle, counterclockwise) {
      const sa = -startAngle * Math.PI / 180;
      const ea = -endAngle * Math.PI / 180;
      this.state.pathSegments.push({ op: 'arc', args: [x, y, r, startAngle, endAngle, counterclockwise] });
      this.ctx.arc(x, -y, r, sa, ea, !counterclockwise);
      this.state.currentX = x + r * Math.cos(endAngle * Math.PI / 180);
      this.state.currentY = y + r * Math.sin(endAngle * Math.PI / 180);
    }

    closePath() {
      this.state.pathSegments.push({ op: 'closePath', args: [] });
      this.ctx.closePath();
    }

    // --- Painting (reference: beginPath + moveTo after paint) ---
    fill() {
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.moveTo(this.state.currentX, -this.state.currentY);
      this.state.pathSegments = [];
    }

    stroke() {
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(this.state.currentX, -this.state.currentY);
      this.state.pathSegments = [];
    }

    eofill() {
      this.ctx.fill('evenodd');
      this.ctx.beginPath();
      this.ctx.moveTo(this.state.currentX, -this.state.currentY);
      this.state.pathSegments = [];
    }

    clip() {
      this.ctx.clip();
    }

    // --- Rect convenience ---
    rectPath(x, y, w, h) {
      this.ctx.rect(x, -y - h, w, h);
    }

    rectFill(x, y, w, h) {
      this.ctx.fillRect(x, -y - h, w, h);
    }

    rectStroke(x, y, w, h) {
      this.ctx.strokeRect(x, -y - h, w, h);
    }

    // --- Font ---
    setFont(fontEntry, size) {
      this.state.font = { entry: fontEntry, size, scaleX: 1 };
      PSFonts.applyToContext(this.ctx, fontEntry, size);
    }

    setFontMatrix(fontEntry, matrix) {
      const sx = Math.abs(matrix[0]);
      const sy = Math.abs(matrix[3]);
      this.state.font = { entry: fontEntry, size: sy, scaleX: sx / sy };
    }

    // --- Text ---
    showText(text) {
      if (!this.state.font) return;
      const { entry, size, scaleX } = this.state.font;
      const x = this.state.currentX;
      const y = this.state.currentY;

      this.ctx.save();
      this.ctx.translate(x, -y);
      if (scaleX && scaleX !== 1) {
        this.ctx.scale(scaleX, 1);
      }
      PSFonts.applyToContext(this.ctx, entry, size);
      this.ctx.fillStyle = this._cssColor();
      this.ctx.textBaseline = 'alphabetic';
      this.ctx.fillText(text, 0, 0);
      const metrics = this.ctx.measureText(text);
      this.ctx.restore();

      // Advance current point by measured width scaled back to PS coords
      this.state.currentX = x + metrics.width * (scaleX && scaleX !== 1 ? scaleX : 1);
    }

    // --- Transform ---
    translate(x, y) {
      this.ctx.translate(x, -y);
    }

    scale(sx, sy) {
      this.ctx.scale(sx, sy);
    }

    rotate(angleDeg) {
      this.ctx.rotate(-angleDeg * Math.PI / 180);
    }

    concat(m) {
      if (Array.isArray(m) && m.length === 6) {
        this.ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
      }
    }

    // --- Pattern (tiled background) ---
    // Renders the "Word Search" rotated text tile for the background pattern.
    // Uses an offscreen canvas sized to fit the full text, then scales
    // down via the pattern matrix to create the repeating tile.
    createTilePattern(patternDict, matrix) {
      const tileCanvas = document.createElement('canvas');
      const tw = 520, th = 200;
      tileCanvas.width = tw;
      tileCanvas.height = th;
      const tc = tileCanvas.getContext('2d');

      tc.fillStyle = 'rgba(0, 178, 178, 0.55)';
      tc.save();
      tc.translate(0, th);
      tc.rotate(-40 * Math.PI / 180);
      tc.font = '700 76px "Merriweather", serif';
      tc.fillText('Word Search', 0, 0);
      tc.restore();

      // Scale down by the pattern matrix (0.04)
      const pmx = Array.isArray(matrix) ? matrix : [0.04, 0, 0, 0.04, 0, 0];
      const scale = Math.abs(pmx[0]) || 0.04;
      const patternCanvas = document.createElement('canvas');
      const pw = Math.round(tw * scale * 25);
      const ph = Math.round(th * scale * 25);
      patternCanvas.width = pw;
      patternCanvas.height = ph;
      const pc = patternCanvas.getContext('2d');
      pc.drawImage(tileCanvas, 0, 0, pw, ph);

      return this.ctx.createPattern(patternCanvas, 'repeat');
    }

    setPattern(pattern) {
      this.ctx.fillStyle = pattern;
    }
  }

  return { GraphicsEngine, GraphicsState };
})();

if (typeof module !== 'undefined') module.exports = PSGraphics;
