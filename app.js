/**
 * app.js — Application Entry Point
 * Bootstraps modules and initializes the PostScript interpreter application.
 */
(function () {
  'use strict';

  function init() {
    const canvas = document.getElementById('ps-canvas');
    const graphics = new PSGraphics.GraphicsEngine(canvas);

    const logger = (msg, type) => {
      const output = document.getElementById('output');
      if (output) {
        const line = document.createElement('div');
        line.className = `output-line output-${type || 'info'}`;
        line.textContent = msg;
        output.appendChild(line);
        output.scrollTop = output.scrollHeight;
      }
    };

    const interpreter = new PSInterpreter.Interpreter(graphics, logger);
    new PSUI.UIController(interpreter, graphics);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
