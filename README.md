# Word Search for PostScript

A word search game written in **PostScript** in 1995, brought to the web with a custom-built PostScript interpreter that renders directly onto HTML Canvas.

## Background

This project was originally created by **Rozario Chivers** in **May 1995** as part of the *Computing and Representation* module during the first year of the **BSc Software Systems for Arts and Media** degree at the **University of Hertfordshire**, UK.

The game was designed for the command-line **GhostScript** PostScript interpreter on PC. The original `wordsearch.ps` source file defines the entire game — background, grid, typography, colour fills, and interactive word-finding procedures — using pure PostScript operators.

Nearly three decades later, this web application gives the game new life by interpreting and rendering the original PostScript source directly in the browser, with no server-side processing or plugins required.

## How to Play

The game displays a **5 × 5 grid** of letters. Hidden inside are **8 networking terms** from the early internet era:

> MODEM · NET · HOST · LOGIN · FTP · LAN · NODE · BIT

Find them by:

- Clicking **Show Words** below the canvas, then clicking a word button
- Typing the word name (e.g. `modem`) into the **PostScript REPL** and pressing Enter

Each correct word reveals:
- A **red cross-out line** on the grid showing where the word was hidden
- A **blue word label** confirming the find
- A **red letter** that progressively spells out a hidden message — find all eight to reveal it

## Features

- **Auto-loading** — `wordsearch.ps` loads and renders automatically on page load
- **Interactive REPL** — type PostScript commands directly, with command history (↑/↓ arrows)
- **Source editor** — view and edit the PostScript source, then re-render with Run Editor
- **Spoiler-free mode** — word buttons are hidden by default behind a Show/Hide toggle
- **Operand stack viewer** — live display of the interpreter's stack state
- **About modal** — project history and how-to-play instructions
- **Responsive layout** — viewport-constrained design that fits within the browser window
- **No dependencies** — vanilla HTML, CSS, and JavaScript; no build step, no frameworks

## Running the Project

The application requires a local HTTP server to load `wordsearch.ps` via fetch. Any static file server will work.

### Python

```bash
cd Roz-WordSearchPS
python3 -m http.server 8080
```

### Node.js

```bash
cd Roz-WordSearchPS
npx serve .
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.

> **Note:** Opening `index.html` directly as a file will not work due to browser security restrictions on `fetch` from `file://` URLs.

## Architecture

The application is structured as six standalone JavaScript modules with no build tooling:

```
wordsearch.ps        ← Original 1995 PostScript source (unmodified game logic)

ps-parser.js         ← Lexer & parser: tokenises PS source into an AST
ps-fonts.js          ← Font system: maps PS font names to Google Web Fonts
ps-graphics.js       ← Graphics engine: Canvas 2D rendering, path tracking,
                        gsave/grestore, coordinate transforms, text layout
ps-interpreter.js    ← Interpreter core: stack machine, dictionary stack,
                        80+ built-in operators, procedure execution
ps-ui.js             ← UI controller: REPL, editor, word game logic,
                        command history, re-render pipeline
app.js               ← Entry point: bootstraps and wires modules together

index.html           ← Semantic markup, Google Fonts, application layout
styles.css           ← Design system: CSS custom properties, responsive grid,
                        dark theme, modal, scrollbar styling
```

### PostScript Interpreter

The interpreter implements a subset of PostScript Level 1 and Level 2 sufficient to run `wordsearch.ps`:

| Category | Operators |
|---|---|
| **Stack** | `pop` `dup` `exch` `copy` `index` `roll` `clear` `count` `mark` |
| **Arithmetic** | `add` `sub` `mul` `div` `mod` `neg` `abs` `sqrt` `sin` `cos` `atan` `exp` `ln` `log` `ceiling` `floor` `round` `rand` |
| **Comparison** | `eq` `ne` `gt` `lt` `ge` `le` `and` `or` `not` `true` `false` |
| **Control** | `if` `ifelse` `for` `repeat` `loop` `exit` `stopped` |
| **Dictionary** | `def` `dict` `begin` `end` `load` `where` `known` `currentdict` |
| **Path** | `newpath` `moveto` `rmoveto` `lineto` `rlineto` `curveto` `arc` `arcn` `closepath` `clip` `clippath` `pathbbox` |
| **Painting** | `fill` `eofill` `stroke` `rectfill` `rectstroke` `showpage` |
| **Graphics state** | `gsave` `grestore` `setrgbcolor` `sethsbcolor` `setgray` `setlinewidth` `setlinecap` `setlinejoin` `setdash` `currentpoint` |
| **Font** | `findfont` `scalefont` `makefont` `setfont` `selectfont` `show` `stringwidth` |
| **Transform** | `translate` `scale` `rotate` `concat` `matrix` `currentmatrix` `setmatrix` |
| **Array/String** | `array` `aload` `astore` `get` `put` `forall` `length` |
| **Type/IO** | `type` `cvs` `print` `=` `==` `pstack` `stack` `bind` `null` `version` |

### Rendering Approach

The graphics engine follows the approach used by the [PostCanvas](https://github.com/) reference implementation:

- The canvas origin is translated to the bottom-left with `ctx.translate(0, canvasHeight)`
- Y coordinates are **negated per draw call** (`moveTo(x, -y)`) rather than flipping the canvas scale, which avoids inverted text rendering
- `fill` and `stroke` call `ctx.beginPath()` after painting, matching PostScript's path consumption semantics
- Path segments are tracked in the graphics state so `gsave`/`grestore` can replay paths that the canvas `save`/`restore` does not preserve
- `setrgbcolor` sets both `fillStyle` and `strokeStyle` simultaneously, matching PostScript behaviour

### Font Mapping

PostScript font names are mapped to Google Web Fonts:

| PostScript | Web Font |
|---|---|
| Times-Roman, Times-Bold, Times-Italic | Merriweather |
| Helvetica, Helvetica-Bold, Helvetica-Oblique | Inter |
| Courier, Courier-Bold | JetBrains Mono |

The original file contains misspellings (`Helvectica-Bold`, `Helvectica-Oblique`) which are handled by the font resolver.

## Design

The UI uses a dark theme built with CSS custom properties, Google Fonts (Inter, JetBrains Mono, Merriweather), and a responsive two-column grid layout. The design prioritises the canvas rendering while providing the REPL and editor as secondary tools in a side panel.

## Credits

- **Rozario Chivers** — original PostScript game design and code (1995); web application (2025)
- **University of Hertfordshire**, UK — where the original project was created for the BSc Software Systems for Arts and Media degree, Computing and Representation module
- **Adobe Systems** — creators of the [PostScript](https://www.adobe.com/products/postscript.html) page description language (1984)
- **Artifex Software** — [GhostScript](https://www.ghostscript.com/), the original interpreter used to run the game
- **PostCanvas** by Michael Feiri & Christine Kochner — reference PostScript-to-Canvas interpreter whose rendering approach informed the graphics engine
- **Google Fonts** — Inter, JetBrains Mono, and Merriweather typefaces
- **Amazon Q Developer** — AI coding assistant used during development of the PostScript interpretter and online editor

## Licence

This project is licensed under the [MIT License](LICENSE).
