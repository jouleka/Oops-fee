'use strict';

const { expand: maintainedExpand } = require('brace-expansion');
const maintainedPicomatch = require('picomatch');

const MAX_INPUT = 10_000;
const MAX_DEPTH = 128;
const MAX_RESULTS = 1_000;
const MAX_OUTPUT = 1_000_000;

function assertPattern(pattern) {
  if (typeof pattern !== 'string') throw new TypeError('Expected a glob string');
  if (pattern.length > MAX_INPUT || pattern.includes('\0')) {
    throw new SyntaxError('Glob input exceeds security limit');
  }
  let braces = 0;
  let parens = 0;
  let bracket = false;
  let quote = '';
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === '\\') { i++; continue; }
    if (quote) { if (char === quote) quote = ''; continue; }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '[') { bracket = true; continue; }
    if (char === ']') { bracket = false; continue; }
    if (bracket) continue;
    if (char === '{') braces++;
    if (char === '}') braces = Math.max(0, braces - 1);
    if (char === '(') parens++;
    if (char === ')') parens = Math.max(0, parens - 1);
    if (braces + parens > MAX_DEPTH) throw new SyntaxError('Glob nesting exceeds security limit');
  }
}

function assertPatterns(patterns, options) {
  for (const pattern of [].concat(patterns || [])) assertPattern(pattern);
  if (options && options.ignore) {
    for (const pattern of [].concat(options.ignore)) assertPattern(pattern);
  }
}

// Protect literal escapes, quoted strings and bracket expressions before using
// the Bash expander. Its unescaping differs from Micromatch's keepEscaping API.
function protect(pattern, options) {
  const literals = [];
  let text = '';
  const token = value => {
    literals.push(value);
    return `\0L${literals.length - 1}\0`;
  };
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === '\\' && i + 1 < pattern.length) {
      text += token((options.keepEscaping ? '\\' : '') + pattern[++i]);
    } else if (char === '"' || char === "'" || char === '`') {
      let value = options.keepQuotes ? char : '';
      while (++i < pattern.length) {
        if (pattern[i] === char) { if (options.keepQuotes) value += char; break; }
        value += pattern[i];
        if (pattern[i] === '\\' && i + 1 < pattern.length) value += pattern[++i];
      }
      text += token(value);
    } else if (char === '[') {
      let value = char;
      while (++i < pattern.length) {
        value += pattern[i];
        if (pattern[i] === '\\' && i + 1 < pattern.length) value += pattern[++i];
        else if (pattern[i] === ']') break;
      }
      text += token(value);
    } else {
      text += char;
    }
  }
  return { text, restore: value => value.replace(/\0L(\d+)\0/g, (_match, index) => literals[Number(index)]) };
}

function assertExpansionBudget(text, limit) {
  const stack = [{ start: 0, current: 1, alternatives: 0 }];
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    const frame = stack[stack.length - 1];
    if (char === '{') stack.push({ start: index + 1, current: 1, alternatives: 0 });
    else if (char === ',' && stack.length > 1) {
      frame.alternatives += frame.current;
      frame.current = 1;
    } else if (char === '}' && stack.length > 1) {
      stack.pop();
      let count = frame.alternatives + frame.current;
      const range = /^(?<from>-?\d+|[a-zA-Z])\.\.(?<to>-?\d+|[a-zA-Z])(?:\.\.(?<step>-?\d+))?$/.exec(text.slice(frame.start, index));
      if (range) {
        const value = input => /^[a-zA-Z]$/.test(input) ? input.charCodeAt(0) : Number(input);
        const from = value(range.groups.from);
        const to = value(range.groups.to);
        const step = Math.max(1, Math.abs(Number(range.groups.step || 1)));
        if (![from, to, step].every(Number.isSafeInteger)) throw new RangeError('Glob range exceeds security limit');
        count = Math.floor(Math.abs(to - from) / step) + 1;
      }
      const parent = stack[stack.length - 1];
      parent.current *= count;
      if (count > limit || parent.current + parent.alternatives > limit) {
        throw new RangeError('Glob expansion exceeds security limit');
      }
    }
    if (frame.current + frame.alternatives > limit) throw new RangeError('Glob expansion exceeds security limit');
  }
}

function expandOne(pattern, options = {}) {
  assertPattern(pattern);
  if (options.nobrace || pattern === '') return [pattern];
  const { text, restore } = protect(pattern, options);
  const limit = options.rangeLimit === undefined || options.rangeLimit === false
    ? MAX_RESULTS : Math.min(MAX_RESULTS, options.rangeLimit);
  if (!Number.isSafeInteger(limit) || limit < 1) throw new RangeError('Invalid glob expansion limit');
  assertExpansionBudget(text, limit);
  let output = maintainedExpand(text, {
    max: limit + 1,
    // At most 1001 strings of at most 10k source characters; the result checks
    // below reject excess instead of silently accepting a truncated expansion.
    maxLength: (MAX_RESULTS + 1) * MAX_INPUT * 2,
    maxDepth: MAX_DEPTH,
    maxRewrites: MAX_DEPTH,
  }).map(restore);
  if (output.length > limit || output.reduce((size, item) => size + item.length, 0) > MAX_OUTPUT) {
    throw new RangeError('Glob expansion exceeds security limit');
  }
  if (options.noempty) output = output.filter(Boolean);
  return options.nodupes ? [...new Set(output)] : output;
}

// Micromatch.braces defaults to regex fragments, whereas brace-expansion only
// expands. This small iterative formatter preserves wildcard text and delegates
// all numeric/alphabetic range expansion to the maintained library.
function compileOne(pattern, options = {}) {
  assertPattern(pattern);
  if (options.nobrace) return pattern;
  const { text, restore } = protect(pattern, options);
  const stack = [{ parts: [''], dollar: false }];
  for (const char of text) {
    const frame = stack[stack.length - 1];
    if (char === '{') {
      stack.push({ parts: [''], dollar: frame.dollar || frame.parts.at(-1).endsWith('$') });
    } else if (char === ',' && stack.length > 1 && !frame.dollar) {
      frame.parts.push('');
    } else if (char === '}' && stack.length > 1) {
      stack.pop();
      let content = frame.parts.join(',');
      if (frame.dollar) content = `{${content}}`;
      else if (frame.parts.length > 1) content = `(${frame.parts.join('|')})`;
      else if (/^(?:-?\d+|[a-zA-Z])\.\.(?:-?\d+|[a-zA-Z])(?:\.\.-?\d+)?$/.test(content)) {
        content = `(${expandOne(`{${content}}`, options).join('|')})`;
      } else content = `{${content}}`;
      const parent = stack[stack.length - 1];
      parent.parts[parent.parts.length - 1] += content;
    } else {
      frame.parts[frame.parts.length - 1] += char;
    }
  }
  while (stack.length > 1) {
    const frame = stack.pop();
    const parent = stack[stack.length - 1];
    parent.parts[parent.parts.length - 1] += `{${frame.parts.join(',')}`;
  }
  const result = restore(stack[0].parts[0]);
  if (result.length > MAX_OUTPUT) throw new RangeError('Glob compilation exceeds security limit');
  return result;
}

function braces(patterns, options = {}) {
  const result = [].concat(patterns).flatMap(pattern => options.expand
    ? expandOne(pattern, options) : [compileOne(pattern, options)]);
  if (result.length > MAX_RESULTS) throw new RangeError('Glob expansion exceeds security limit');
  return options.nodupes ? [...new Set(result)] : result;
}
braces.expand = expandOne;
braces.compile = compileOne;

function picomatch(patterns, options, ...rest) {
  assertPatterns(patterns, options);
  return maintainedPicomatch(patterns, options, ...rest);
}
Object.assign(picomatch, maintainedPicomatch);
for (const name of ['parse', 'scan', 'makeRe', 'isMatch']) {
  picomatch[name] = (...args) => {
    const patternIndex = name === 'isMatch' ? 1 : 0;
    assertPatterns(args[patternIndex], args[patternIndex + 1]);
    return maintainedPicomatch[name](...args);
  };
}

module.exports = { braces, picomatch, assertPattern };
