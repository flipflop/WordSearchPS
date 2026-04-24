/**
 * ps-parser.js — PostScript Lexer & Parser
 * Tokenizes PostScript source into typed tokens and parses into executable form.
 */
const PSParser = (() => {
  'use strict';

  const TokenType = Object.freeze({
    NUMBER: 'NUMBER',
    STRING: 'STRING',
    NAME: 'NAME',
    LITERAL_NAME: 'LITERAL_NAME',
    OPEN_BRACE: 'OPEN_BRACE',
    CLOSE_BRACE: 'CLOSE_BRACE',
    OPEN_BRACKET: 'OPEN_BRACKET',
    CLOSE_BRACKET: 'CLOSE_BRACKET',
  });

  function tokenize(source) {
    const tokens = [];
    let i = 0;
    const len = source.length;

    while (i < len) {
      const ch = source[i];

      // Skip whitespace
      if (/\s/.test(ch)) { i++; continue; }

      // Skip comments
      if (ch === '%') {
        while (i < len && source[i] !== '\n') i++;
        continue;
      }

      // String literal (parentheses)
      if (ch === '(') {
        i++;
        let str = '', depth = 1;
        while (i < len && depth > 0) {
          if (source[i] === '\\') {
            i++;
            const esc = source[i];
            if (esc === 'n') str += '\n';
            else if (esc === 't') str += '\t';
            else if (esc === '\\') str += '\\';
            else if (esc === '(') str += '(';
            else if (esc === ')') str += ')';
            else str += esc;
          } else {
            if (source[i] === '(') depth++;
            else if (source[i] === ')') depth--;
            if (depth > 0) str += source[i];
          }
          i++;
        }
        tokens.push({ type: TokenType.STRING, value: str });
        continue;
      }

      // Braces
      if (ch === '{') { tokens.push({ type: TokenType.OPEN_BRACE }); i++; continue; }
      if (ch === '}') { tokens.push({ type: TokenType.CLOSE_BRACE }); i++; continue; }

      // Brackets
      if (ch === '[') { tokens.push({ type: TokenType.OPEN_BRACKET }); i++; continue; }
      if (ch === ']') { tokens.push({ type: TokenType.CLOSE_BRACKET }); i++; continue; }

      // Literal name
      if (ch === '/') {
        i++;
        let name = '';
        while (i < len && !/[\s\/%(){}\[\]<>]/.test(source[i])) {
          name += source[i]; i++;
        }
        tokens.push({ type: TokenType.LITERAL_NAME, value: name });
        continue;
      }

      // Number or name
      let word = '';
      while (i < len && !/[\s\/%(){}\[\]<>]/.test(source[i])) {
        word += source[i]; i++;
      }

      if (word.length === 0) { i++; continue; }

      const num = Number(word);
      if (!isNaN(num) && word !== '') {
        tokens.push({ type: TokenType.NUMBER, value: num });
      } else {
        tokens.push({ type: TokenType.NAME, value: word });
      }
    }
    return tokens;
  }

  function parse(tokens) {
    const program = [];
    let i = 0;

    function parseBody() {
      const body = [];
      while (i < tokens.length) {
        const tok = tokens[i];
        if (tok.type === TokenType.CLOSE_BRACE) { i++; return body; }
        if (tok.type === TokenType.OPEN_BRACE) {
          i++;
          body.push({ type: 'PROCEDURE', body: parseBody() });
        } else if (tok.type === TokenType.OPEN_BRACKET) {
          i++;
          body.push({ type: 'MARK' });
        } else if (tok.type === TokenType.CLOSE_BRACKET) {
          i++;
          body.push({ type: 'BUILD_ARRAY' });
        } else {
          i++;
          if (tok.type === TokenType.NUMBER) body.push({ type: 'NUMBER', value: tok.value });
          else if (tok.type === TokenType.STRING) body.push({ type: 'STRING', value: tok.value });
          else if (tok.type === TokenType.LITERAL_NAME) body.push({ type: 'LITERAL_NAME', value: tok.value });
          else if (tok.type === TokenType.NAME) body.push({ type: 'EXECUTABLE_NAME', value: tok.value });
        }
      }
      return body;
    }

    while (i < tokens.length) {
      const tok = tokens[i];
      if (tok.type === TokenType.OPEN_BRACE) {
        i++;
        program.push({ type: 'PROCEDURE', body: parseBody() });
      } else if (tok.type === TokenType.OPEN_BRACKET) {
        i++;
        program.push({ type: 'MARK' });
      } else if (tok.type === TokenType.CLOSE_BRACKET) {
        i++;
        program.push({ type: 'BUILD_ARRAY' });
      } else {
        i++;
        if (tok.type === TokenType.NUMBER) program.push({ type: 'NUMBER', value: tok.value });
        else if (tok.type === TokenType.STRING) program.push({ type: 'STRING', value: tok.value });
        else if (tok.type === TokenType.LITERAL_NAME) program.push({ type: 'LITERAL_NAME', value: tok.value });
        else if (tok.type === TokenType.NAME) program.push({ type: 'EXECUTABLE_NAME', value: tok.value });
      }
    }
    return program;
  }

  return {
    TokenType,
    tokenize,
    parse,
    compile(source) { return parse(tokenize(source)); },
  };
})();

if (typeof module !== 'undefined') module.exports = PSParser;
