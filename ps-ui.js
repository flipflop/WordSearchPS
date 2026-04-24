/**
 * ps-ui.js — UI Controller
 * Manages REPL, file loading, command history, output panel, and interactions.
 */
const PSUI = (() => {
  'use strict';

  class UIController {
    constructor(interpreter, graphics) {
      this.interpreter = interpreter;
      this.gfx = graphics;
      this.history = [];
      this.historyIndex = -1;
      this.psSource = '';
      this.foundWords = [];       // ordered list of found words for replay
      this._cacheDOM();
      this._bindEvents();
      this._printWelcome();
      this._loadFile();
    }

    _cacheDOM() {
      this.els = {
        input:      document.getElementById('ps-input'),
        runBtn:     document.getElementById('run-btn'),
        clearBtn:   document.getElementById('clear-btn'),
        resetBtn:   document.getElementById('reset-btn'),
        output:     document.getElementById('output'),
        stackView:  document.getElementById('stack-view'),
        fileInfo:   document.getElementById('file-info'),
        canvas:     document.getElementById('ps-canvas'),
        wordBtns:   document.querySelectorAll('.word-btn'),
        wordsList:  document.getElementById('words-list'),
        wordsToggle: document.getElementById('words-toggle'),
        editor:     document.getElementById('ps-editor'),
        editorRun:  document.getElementById('editor-run-btn'),
        tabBtns:    document.querySelectorAll('.tab-btn'),
        tabPanels:  document.querySelectorAll('.tab-panel'),
        aboutBtn:   document.getElementById('about-btn'),
        aboutModal: document.getElementById('about-modal'),
        aboutClose: document.getElementById('about-close'),
      };
    }

    _bindEvents() {
      this.els.runBtn.addEventListener('click', () => this._runInput());
      this.els.clearBtn.addEventListener('click', () => this._clearOutput());
      this.els.resetBtn.addEventListener('click', () => this._resetAll());
      if (this.els.editorRun) {
        this.els.editorRun.addEventListener('click', () => this._runEditor());
      }

      this.els.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this._runInput();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this._historyUp();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          this._historyDown();
        }
      });

      this.els.wordBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const word = btn.dataset.word;
          if (!this.foundWords.includes(word)) {
            this.foundWords.push(word);
          }
          btn.classList.add('found');
          btn.disabled = true;
          this._rerender();
          this._appendOutput(`Found: ${word.toUpperCase()}`, 'success');
          if (this.foundWords.length === 8) {
            this._appendOutput('🎉 WELL DONE — All 8 words found!', 'success');
          }
          this._updateStack();
        });
      });

      this.els.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => this._switchTab(btn.dataset.tab));
      });

      this.els.aboutBtn.addEventListener('click', () => {
        this.els.aboutModal.hidden = false;
      });
      this.els.aboutClose.addEventListener('click', () => {
        this.els.aboutModal.hidden = true;
      });
      this.els.aboutModal.addEventListener('click', (e) => {
        if (e.target === this.els.aboutModal) this.els.aboutModal.hidden = true;
      });

      this.els.wordsToggle.addEventListener('click', () => {
        const list = this.els.wordsList;
        const showing = !list.hidden;
        list.hidden = showing;
        this.els.wordsToggle.textContent = showing ? 'Show Words' : 'Hide Words';
      });

      // Resize observer for canvas
      let resizeTimer;
      const ro = new ResizeObserver(() => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (this.psSource) this._rerender();
        }, 100);
      });
      ro.observe(this.els.canvas);
    }

    /**
     * Full re-render: reset graphics, run base PS source, then replay
     * found words. The original GhostScript game showed one word at a
     * time — each new word overwrote the previous blue label. We match
     * that by drawing cross-out lines + red "WELL DONE" letters for ALL
     * found words, but only the LAST found word's blue label.
     *
     * Each word has two parts:
     *   - main proc (e.g. "modem"): draws cross-out line, then calls sub
     *   - sub proc (e.g. "modem1"): draws blue label + red letter
     *
     * For earlier words we call the sub (word + "1") to get the red
     * letter, then draw the cross-out line directly. For the last word
     * we call the full procedure so the blue label renders cleanly.
     */
    _rerender() {
      if (!this.psSource) return;
      this.gfx.reset();
      this.interpreter.reset();
      try {
        this.interpreter.runSource(this.psSource);

        for (let i = 0; i < this.foundWords.length; i++) {
          const word = this.foundWords[i];
          if (i < this.foundWords.length - 1) {
            // Earlier words: run the full procedure (line + label + letter)
            // then overpaint the label area so only the last word's label shows
            this.interpreter.runSource(word);
          } else {
            // Last word: clear the two label columns with the background,
            // then draw this word's full procedure cleanly on top
            this.interpreter.runSource(
              'gsave 0.9 1 1 setrgbcolor 485 385 250 230 rectfill 785 385 220 230 rectfill grestore'
            );
            // Re-draw only the red "WELL DONE" letters for earlier words
            for (let j = 0; j < i; j++) {
              this.interpreter.runSource(this.foundWords[j] + '1');
            }
            this.interpreter.runSource(word);
          }
        }
      } catch (e) {
        this._appendOutput(`Render error: ${e.message}`, 'error');
      }
    }

    _switchTab(tabId) {
      this.els.tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
      this.els.tabPanels.forEach(p => p.classList.toggle('active', p.id === `tab-${tabId}`));
    }

    _printWelcome() {
      this._appendOutput('WebPS Interpreter v1.0', 'info');
      this._appendOutput('Word Search for PostScript — Rozario Chivers, 1995', 'info');
      this._appendOutput('Find the 8 hidden words in the grid.', 'info');
    }

    _appendOutput(text, type = 'info') {
      const line = document.createElement('div');
      line.className = `output-line output-${type}`;
      line.textContent = text;
      this.els.output.appendChild(line);
      this.els.output.scrollTop = this.els.output.scrollHeight;
    }

    _clearOutput() {
      this.els.output.innerHTML = '';
    }

    _updateStack() {
      const stack = this.interpreter.operandStack;
      if (stack.length === 0) {
        this.els.stackView.innerHTML = '<div class="stack-empty">Stack empty</div>';
        return;
      }
      this.els.stackView.innerHTML = stack.slice().reverse().map((v, i) => {
        const idx = stack.length - 1 - i;
        return `<div class="stack-item"><span class="stack-idx">${idx}</span><span class="stack-val">${PSInterpreter.formatValue(v)}</span></div>`;
      }).join('');
    }

    _runInput() {
      const src = this.els.input.value.trim();
      if (!src) return;
      this.history.push(src);
      this.historyIndex = this.history.length;
      this._appendOutput(`PS> ${src}`, 'cmd');
      this._runCommand(src);
      this.els.input.value = '';
    }

    _runCommand(src) {
      try {
        this.interpreter.runSource(src);
        this._appendOutput('OK', 'success');
      } catch (e) {
        this._appendOutput(`Error: ${e.message}`, 'error');
      }
      this._updateStack();
    }

    _runEditor() {
      const src = this.els.editor.value.trim();
      if (!src) return;
      this._appendOutput('Running editor contents...', 'cmd');
      this.gfx.reset();
      this.interpreter.reset();
      this.psSource = src;
      this.foundWords = [];
      this.els.wordBtns.forEach(btn => {
        btn.classList.remove('found');
        btn.disabled = false;
      });
      try {
        this.interpreter.runSource(src);
        this._appendOutput('OK', 'success');
      } catch (e) {
        this._appendOutput(`Error: ${e.message}`, 'error');
      }
      this._updateStack();
    }

    _resetAll() {
      this.interpreter.reset();
      this.foundWords = [];
      this._clearOutput();
      this._printWelcome();
      this._updateStack();
      this.els.wordBtns.forEach(btn => {
        btn.classList.remove('found');
        btn.disabled = false;
      });
      // Re-render the base scene
      this._loadFile();
    }

    async _loadFile() {
      try {
        const resp = await fetch('wordsearch.ps', { cache: 'no-store' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const source = await resp.text();
        this.psSource = source;
        this.foundWords = [];
        this.gfx.reset();
        this.interpreter.reset();

        if (this.els.editor) this.els.editor.value = source;

        this.interpreter.runSource(source);
        this._appendOutput('wordsearch.ps loaded and rendered.', 'success');
        this.els.wordBtns.forEach(btn => {
          btn.classList.remove('found');
          btn.disabled = false;
        });
      } catch (e) {
        this._appendOutput(`Load error: ${e.message}`, 'error');
      }
      this._updateStack();
    }

    _historyUp() {
      if (this.historyIndex > 0) {
        this.historyIndex--;
        this.els.input.value = this.history[this.historyIndex];
      }
    }

    _historyDown() {
      if (this.historyIndex < this.history.length - 1) {
        this.historyIndex++;
        this.els.input.value = this.history[this.historyIndex];
      } else {
        this.historyIndex = this.history.length;
        this.els.input.value = '';
      }
    }
  }

  return { UIController };
})();

if (typeof module !== 'undefined') module.exports = PSUI;
