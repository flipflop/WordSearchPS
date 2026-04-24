/**
 * ps-fonts.js — PostScript Font System
 * Maps PS font names to web fonts, handles text measurement and rendering.
 */
const PSFonts = (() => {
  'use strict';

  // Map PostScript font names to CSS font families and weights
  const FONT_MAP = {
    'Times-Roman':        { family: 'Merriweather', weight: '400', style: 'normal' },
    'Times-Bold':         { family: 'Merriweather', weight: '700', style: 'normal' },
    'Times-Italic':       { family: 'Merriweather', weight: '400', style: 'italic' },
    'Times-BoldItalic':   { family: 'Merriweather', weight: '700', style: 'italic' },
    'Helvetica':          { family: 'Inter', weight: '400', style: 'normal' },
    'Helvetica-Bold':     { family: 'Inter', weight: '700', style: 'normal' },
    'Helvetica-Oblique':  { family: 'Inter', weight: '400', style: 'italic' },
    'Helvetica-BoldOblique': { family: 'Inter', weight: '700', style: 'italic' },
    'Courier':            { family: 'JetBrains Mono', weight: '400', style: 'normal' },
    'Courier-Bold':       { family: 'JetBrains Mono', weight: '700', style: 'normal' },
    // Misspellings in the original PS file
    'Helvectica-Bold':    { family: 'Inter', weight: '700', style: 'normal' },
    'Helvectica-Oblique': { family: 'Inter', weight: '400', style: 'italic' },
  };

  const DEFAULT_FONT = { family: 'Inter', weight: '400', style: 'normal' };

  function resolve(psName) {
    return FONT_MAP[psName] || DEFAULT_FONT;
  }

  function toCSSFont(fontEntry, sizePx) {
    const style = fontEntry.style === 'italic' ? 'italic ' : '';
    return `${style}${fontEntry.weight} ${sizePx}px "${fontEntry.family}", sans-serif`;
  }

  function applyToContext(ctx, fontEntry, sizePx) {
    ctx.font = toCSSFont(fontEntry, sizePx);
  }

  function measure(ctx, text, fontEntry, sizePx) {
    applyToContext(ctx, fontEntry, sizePx);
    return ctx.measureText(text);
  }

  return { resolve, toCSSFont, applyToContext, measure, FONT_MAP };
})();

if (typeof module !== 'undefined') module.exports = PSFonts;
