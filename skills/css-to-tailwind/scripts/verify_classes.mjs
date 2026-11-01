#!/usr/bin/env node
/**
 * Verify a CSS -> Tailwind conversion by compiling the classes with the real
 * Tailwind package and comparing what they produce with the source CSS.
 *
 * Catches the failures that matter most in conversions: classes that do not exist
 * in the target version, wrong arbitrary-value syntax, utilities that silently add
 * extra declarations (e.g. text-lg also sets line-height), and values that differ.
 *
 * Usage:
 *   node verify_classes.mjs conversion.json [--tailwind-dir DIR] [--theme-css FILE]
 *                           [--config FILE] [--json]
 *
 * Requires `tailwindcss` (v3 or v4) and `postcss` installed in DIR (default: cwd):
 *   npm install --no-save tailwindcss postcss        # or tailwindcss@3 for v3 projects
 *
 * conversion.json (start from `parse_css.py FILE --skeleton`):
 *   { "prefix": "",                       // v3: "tw-"   v4: "tw"
 *     "items": [ { "id": ".btn",
 *                  "classes": "px-4 py-2 hover:bg-blue-600 md:py-3",
 *                  "source": [ {"prop":"padding","value":"8px 16px","important":false,
 *                               "context":"&","at":[]} ] } ] }
 * `source` is optional; without it the script only validates classes and prints
 * the CSS they generate. Treat the diff as advisory: it assumes a 16px root font
 * size and cannot judge shorthands it does not expand (reported as "unverified").
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------- arguments
const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const asJson = argv.includes('--json');
const input = argv.find((a, i) => !a.startsWith('--') && (i === 0 || !['--tailwind-dir', '--theme-css', '--config'].includes(argv[i - 1])));
if (!input) { console.error(fs.readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0]); process.exit(2); }
const conv = JSON.parse(fs.readFileSync(input, 'utf8'));
const dir = path.resolve(opt('--tailwind-dir') || process.cwd());
const req = createRequire(path.join(dir, 'noop.js'));

let twPkg, postcss;
try { twPkg = req('tailwindcss/package.json'); postcss = req('postcss'); }
catch (e) {
  console.error(`Cannot load tailwindcss/postcss from ${dir}.\nInstall them first:  npm install --no-save tailwindcss postcss   (use tailwindcss@3 to verify a v3 project)\nThen re-run, or pass --tailwind-dir <folder containing node_modules>.`);
  process.exit(3);
}
const major = parseInt(twPkg.version.split('.')[0], 10);
const prefix = conv.prefix ?? '';
const themeCssExtra = opt('--theme-css') ? fs.readFileSync(opt('--theme-css'), 'utf8') : '';
const userConfig = opt('--config') ? req(path.resolve(opt('--config'))) : {};

// ------------------------------------------------------------- compile layer
const origWarn = console.warn; console.warn = () => {};            // v3 warns for unknown classes
let compileFn;
if (major >= 4) {
  const { compile } = req('tailwindcss');
  const twRoot = path.dirname(req.resolve('tailwindcss/package.json'));
  const loadStylesheet = async (id, base) => {
    const p = id === 'tailwindcss' ? path.join(twRoot, 'index.css')
      : id.startsWith('tailwindcss/') ? path.join(twRoot, id.slice('tailwindcss/'.length))
      : path.resolve(base, id);
    return { path: p, base: path.dirname(p), content: fs.readFileSync(p, 'utf8') };
  };
  const head = `@import "tailwindcss/theme.css" layer(theme)${prefix ? ` prefix(${prefix})` : ''};\n@import "tailwindcss/utilities.css" layer(utilities);\n${themeCssExtra}`;
  // build() is cumulative inside one compiler, so compile fresh for each class
  compileFn = async (cls) => postcss.parse((await compile(head, { base: dir, loadStylesheet })).build([cls]));
} else {
  const tailwind = req('tailwindcss');
  compileFn = async (cls) => {
    const cfg = { ...userConfig, prefix: prefix || userConfig.prefix || '', content: [{ raw: cls, extension: 'html' }],
      corePlugins: { ...(userConfig.corePlugins || {}), preflight: false } };
    return (await postcss([tailwind(cfg)]).process('@tailwind base;\n@tailwind utilities;', { from: undefined })).root;
  };
}

// ----------------------------------------------------------- value utilities
const splitTop = (s, sep) => {                // sep: ',' or ' ' (whitespace)
  const out = []; let depth = 0, cur = '', q = null;
  for (const c of s) {
    if (q) { cur += c; if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === '(' || c === '[') depth++;
    if (c === ')' || c === ']') depth--;
    if (depth === 0 && (sep === ' ' ? /\s/.test(c) : c === sep)) { if (cur.trim() !== '' || sep === ',') out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim() !== '' || (sep === ',' && out.length)) out.push(cur.trim());
  return out;
};

function resolveVars(value, lookup, depth = 0) {
  if (depth > 12 || !value.includes('var(')) return value;
  let out = '', i = 0;
  while (i < value.length) {
    const j = value.indexOf('var(', i);
    if (j < 0) { out += value.slice(i); break; }
    out += value.slice(i, j);
    let d = 0, k = j + 3;
    for (; k < value.length; k++) { if (value[k] === '(') d++; else if (value[k] === ')') { d--; if (d === 0) break; } }
    const inner = value.slice(j + 4, k);
    const comma = splitTop(inner, ',');
    const name = comma[0].trim();
    const fallback = comma.length > 1 ? inner.slice(inner.indexOf(',') + 1).trim() : undefined;
    const got = lookup(name);
    if (got !== undefined) out += resolveVars(got, lookup, depth + 1);
    else if (fallback !== undefined) out += resolveVars(fallback, lookup, depth + 1);
    else out += `var(${name})`;
    i = k + 1;
  }
  return out;
}

function evalCalc(expr) {                      // single-unit +,-,*,/ only
  const toks = expr.match(/-?\d*\.?\d+(?:[a-z%]+)?|[+\-*/]/gi);
  if (!toks) return null;
  const num = (t) => { const m = /^(-?\d*\.?\d+)([a-z%]*)$/i.exec(t); return m ? { n: parseFloat(m[1]), u: m[2] } : null; };
  let acc = num(toks[0]); if (!acc) return null;
  for (let i = 1; i < toks.length; i += 2) {
    const op = toks[i], rhs = num(toks[i + 1]); if (!rhs) return null;
    if (op === '*') { if (acc.u && rhs.u) return null; acc = { n: acc.n * rhs.n, u: acc.u || rhs.u }; }
    else if (op === '/') { if (rhs.u) return null; acc = { n: acc.n / rhs.n, u: acc.u }; }
    else if (acc.u === rhs.u) acc = { n: op === '+' ? acc.n + rhs.n : acc.n - rhs.n, u: acc.u };
    else return null;
  }
  return `${+acc.n.toFixed(4)}${acc.u}`;
}

const hex2 = (h) => parseInt(h, 16);
function norm(prop, raw) {
  let v = raw.trim();
  const keepCase = /["']|url\(/i.test(v) || prop.startsWith('--');
  if (!keepCase) v = v.toLowerCase();
  v = v.replace(/\s+/g, ' ').replace(/\s*,\s*/g, ',').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
  v = v.replace(/#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})\b/gi, (_, h) => {
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    const a = h.length === 8 ? +(hex2(h.slice(6)) / 255).toFixed(3) : 1;
    return `rgb(${hex2(h.slice(0, 2))} ${hex2(h.slice(2, 4))} ${hex2(h.slice(4, 6))}${a < 1 ? ` / ${a}` : ''})`;
  });
  v = v.replace(/rgba?\(([^)]+)\)/gi, (_, body) => {
    const parts = body.split(/[\s,/]+/).filter(Boolean);
    const [r, g, b, a] = parts; let alpha = a === undefined ? 1 : a.endsWith('%') ? parseFloat(a) / 100 : parseFloat(a);
    return `rgb(${r} ${g} ${b}${alpha < 1 ? ` / ${+alpha.toFixed(3)}` : ''})`;
  });
  v = v.replace(/(?<![\w.])\.(\d)/g, '0.$1');
  v = v.replace(/(\d+\.\d*?)0+(?![\d])/g, (m, a) => a.endsWith('.') ? a.slice(0, -1) : a);
  v = v.replace(/(-?[\d.]+)rem\b/g, (_, n) => `${+(parseFloat(n) * 16).toFixed(3)}px`);
  for (let pass = 0; pass < 4; pass++) v = v.replace(/calc\(([^()]*)\)/g, (m, e) => { const r = evalCalc(e); return r === null ? m : r; });
  v = v.replace(/(\d+\.\d{5,})/g, (n) => String(+parseFloat(n).toFixed(4)));
  v = v.replace(/(?<![\w.])(\d*\.?\d+)s\b/g, (_, n) => `${+(parseFloat(n) * 1000).toFixed(3)}ms`);
  v = v.replace(/(?<![\w.-])-?0(?:px|em|pt|%)(?![\w])/g, '0');
  if (prop === 'opacity' && v.endsWith('%')) v = String(+(parseFloat(v) / 100).toFixed(3));
  if (prop === 'font-weight') v = ({ normal: '400', bold: '700' })[v] || v;
  if (prop === 'aspect-ratio') v = v.replace(/\s*\/\s*/g, '/');
  if (prop === 'content') v = v.replace(/'([^'"]*)'/g, '"$1"');
  if (/^(-webkit-)?(backdrop-)?filter$/.test(prop)) v = v.replace(/(grayscale|invert|sepia|opacity|brightness|contrast|saturate)\(([\d.]+)%\)/g, (_, f, n) => `${f}(${+(parseFloat(n) / 100).toFixed(4)})`);
  return v;
}

function oklchToHex(s) {                       // 'oklch(62.3% 0.214 259.815)' -> '#rrggbb' (sRGB, clipped)
  const m = /oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/.exec(s); if (!m) return null;
  const L = parseFloat(m[1]) / (m[2] ? 100 : 1), C = parseFloat(m[3]), h = parseFloat(m[4]) * Math.PI / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s_ = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  const lin = [4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_, -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_, -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_];
  const g = (x) => { x = Math.min(1, Math.max(0, x)); return Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055)); };
  return lin.map(g);
}
const rgbOf = (v) => { const m = /^rgb\((\d+) (\d+) (\d+)(?: \/ ([\d.]+))?\)$/.exec(v); return m ? [+m[1], +m[2], +m[3]] : null; };

// ---------------------------------------------------- shorthand expansion
const SIDES = ['top', 'right', 'bottom', 'left'];
function box4(vals) { const [a, b = a, c = a, d = b] = vals; return vals.length === 1 ? [a, a, a, a] : vals.length === 2 ? [a, b, a, b] : vals.length === 3 ? [a, b, c, b] : [a, b, c, d]; }
function expand(prop, value) {
  const vals = splitTop(value, ' ');
  const sides = (fmt, names = SIDES) => { const x = box4(vals); return names.map((n, i) => [fmt(n), x[i]]); };
  switch (prop) {
    case 'margin': case 'padding': return sides((s) => `${prop}-${s}`);
    case 'inset': return sides((s) => s);
    case 'border-width': return sides((s) => `border-${s}-width`);
    case 'border-style': return sides((s) => `border-${s}-style`);
    case 'border-color': return sides((s) => `border-${s}-color`);
    case 'border-radius': { if (value.includes('/')) return [[prop, value]]; return sides((c) => `border-${c}-radius`, ['top-left', 'top-right', 'bottom-right', 'bottom-left']); }
    case 'margin-inline': case 'padding-inline': { const [a, b = a] = vals; const p = prop.split('-')[0]; return [[`${p}-left`, a], [`${p}-right`, b]]; }
    case 'margin-block': case 'padding-block': { const [a, b = a] = vals; const p = prop.split('-')[0]; return [[`${p}-top`, a], [`${p}-bottom`, b]]; }
    case 'inset-inline': { const [a, b = a] = vals; return [['left', a], ['right', b]]; }
    case 'inset-block': { const [a, b = a] = vals; return [['top', a], ['bottom', b]]; }
    case 'gap': { const [a, b = a] = vals; return [['row-gap', a], ['column-gap', b]]; }
    case 'overflow': { const [a, b = a] = vals; return [['overflow-x', a], ['overflow-y', b]]; }
    case 'border': case 'border-top': case 'border-right': case 'border-bottom': case 'border-left': {
      const side = prop === 'border' ? null : prop.slice(7);
      const nm = (k) => (side ? [`border-${side}-${k}`] : SIDES.map((s) => `border-${s}-${k}`));
      if (value === 'none' || value === '0') return [...nm('style').map((n) => [n, 'none'])];
      const out = []; let ok = true;
      for (const t of vals) {
        if (/^(thin|medium|thick|[\d.]+(px|em|rem)?)$/i.test(t)) nm('width').forEach((n) => out.push([n, t]));
        else if (/^(none|solid|dashed|dotted|double|groove|ridge|inset|outset|hidden)$/i.test(t)) nm('style').forEach((n) => out.push([n, t]));
        else if (/^(#|rgb|hsl|oklch|transparent|currentcolor|var\()/i.test(t) || /^[a-z]+$/i.test(t)) nm('color').forEach((n) => out.push([n, t]));
        else ok = false;
      }
      return ok && out.length ? out : [[prop, value]];
    }
    case 'outline': {
      if (value === 'none') return [['outline-style', 'none']];
      const out = [];
      for (const t of vals) {
        if (/^(thin|medium|thick|[\d.]+(px|em|rem)?)$/i.test(t)) out.push(['outline-width', t]);
        else if (/^(auto|none|solid|dashed|dotted|double|groove|ridge|inset|outset)$/i.test(t)) out.push(['outline-style', t]);
        else out.push(['outline-color', t]);
      }
      return out.length ? out : [[prop, value]];
    }
    case 'text-decoration': {
      const out = [];
      for (const t of vals) {
        if (/^(underline|overline|line-through|none|blink)$/i.test(t)) out.push(['text-decoration-line', t]);
        else if (/^(solid|double|dotted|dashed|wavy)$/i.test(t)) out.push(['text-decoration-style', t]);
        else if (/^(auto|from-font|[\d.]+(px|em|rem)?)$/i.test(t)) out.push(['text-decoration-thickness', t]);
        else out.push(['text-decoration-color', t]);
      }
      return out.length ? out : [[prop, value]];
    }
    case 'transition': {
      if (splitTop(value, ',').length > 1) return [[prop, value]];
      if (value === 'none') return [['transition-property', 'none']];
      let property = 'all', timing = 'ease'; const times = [];
      for (const t of vals) {
        if (/^[\d.]+m?s$/.test(t)) times.push(t);
        else if (/^(linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end)$/.test(t) || /^(cubic-bezier|steps|linear)\(/.test(t)) timing = t;
        else property = t;
      }
      const out = [['transition-property', property], ['transition-timing-function', timing]];
      if (times[0]) out.push(['transition-duration', times[0]]);
      if (times[1]) out.push(['transition-delay', times[1]]);
      return out;
    }
    case 'background': if (vals.length === 1 && /^(#|rgb|hsl|transparent|[a-z]+$)/i.test(vals[0]) && !/^(none|inherit|initial|unset)$/i.test(vals[0])) return [['background-color', value]]; return [[prop, value]];
    case 'flex': {
      if (/^[\d.]+$/.test(value)) return [['flex', `${value} 1 0`]];
      return [['flex', ({ auto: '1 1 auto', none: '0 0 auto', initial: '0 1 auto' })[value] || value]];
    }
    default: return [[prop, value]];
  }
}

// transform <-> individual property equivalence (Tailwind v4 uses translate/rotate/scale)
function transformAsIndividual(v) {
  if (splitTop(v, ' ').length !== 1) return null;
  const m = /^(translate|translatex|translatey|rotate|scale|scalex|scaley)\((.*)\)$/.exec(v); if (!m) return null;
  const a = m[2].split(',');
  const pct = (x) => (x && x.endsWith('%') ? String(+(parseFloat(x) / 100).toFixed(4)) : x);
  switch (m[1]) {
    case 'translate': return ['translate', `${a[0]} ${a[1] ?? '0'}`];
    case 'translatex': return ['translate', `${a[0]} 0`];
    case 'translatey': return ['translate', `0 ${a[0]}`];
    case 'rotate': return ['rotate', a[0]];
    case 'scale': return ['scale', `${pct(a[0])} ${pct(a[1] ?? a[0])}`];
    case 'scalex': return ['scale', `${pct(a[0])} 1`];
    case 'scaley': return ['scale', `1 ${pct(a[0])}`];
  }
  return null;
}
const IDENT = { transform: /^(translate|translateX|translateY|rotate|skewX|skewY|scaleX|scaleY|scale)\(\s*(0|0px|1|0deg)?\s*(,\s*(0|0px|1))?\s*\)$/i };
function cleanComposite(prop, v) {
  const compositeProps = ['box-shadow', 'filter', 'backdrop-filter', '-webkit-backdrop-filter', 'transform', 'translate', 'scale', 'rotate'];
  if (!compositeProps.includes(prop)) return v;
  v = v.replace(/var\(--tw-[\w-]+\)/g, '');
  if (prop === 'box-shadow') {
    const parts = splitTop(v, ',').filter((p) => p && !/^(inset )?0 0( 0)?( 0)? (#0000|rgb\(0 0 0 \/ 0\))$/i.test(p.replace(/\s+/g, ' ').trim()));
    return parts.length ? parts.join(', ') : 'none';
  }
  if (prop === 'transform') {
    const parts = splitTop(v, ' ').filter((p) => !IDENT.transform.test(p.replace(/\s+/g, '')));
    return parts.length ? parts.join(' ') : 'none';
  }
  return splitTop(v, ' ').join(' ');
}

// ------------------------------------------------------ extraction from CSS
const unesc = (s) => s.replace(/\\([0-9a-fA-F]{1,6})(?:\s|$)/g, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/\\(.)/g, '$1');
const normAt = (a) => {
  let s = a.toLowerCase().replace(/\s+/g, '');
  s = s.replace(/\(width>=([\d.]+)(rem|px)\)/, (_, n, u) => `(min-width:${u === 'rem' ? +(n * 16).toFixed(2) : n}px)`);
  s = s.replace(/\(min-width:([\d.]+)rem\)/, (_, n) => `(min-width:${+(n * 16).toFixed(2)}px)`);
  return s;
};

function extract(root, cls) {
  const globals = new Map();
  root.walkAtRules('property', (at) => at.walkDecls('initial-value', (d) => globals.set(at.params.trim(), d.value)));
  const isGlobal = (sel) => sel.split(',').some((p) => /^(\*|:root|:host|::backdrop)$/.test(p.trim()));
  root.walkRules((r) => { if (!isGlobal(r.selector)) return; r.walkDecls((d) => { if (d.prop.startsWith('--') && d.value.trim() !== 'initial') globals.set(d.prop, d.value); }); });

  const raw = [], custom = []; let validRules = 0; const notes = new Set();
  const inSkipped = (n) => { for (let p = n.parent; p; p = p.parent) if (p.type === 'atrule' && /^(property|-?\w*-?keyframes)$/.test(p.name)) return true; return false; };

  const handle = (rule, conds, ctx, enhanced) => {
    let any = false;
    rule.each((n) => {
      if (n.type === 'decl') {
        any = true;
        if (n.prop.startsWith('--')) custom.push({ at: conds, ctx, name: n.prop, value: n.value });
        else raw.push({ cls, ctx, at: conds, prop: n.prop, raw: n.value, important: !!n.important, enhanced });
      } else if (n.type === 'atrule' && /^(media|supports|container)$/.test(n.name)) {
        const sup = n.name === 'supports';
        handle(n, sup ? conds : [...conds, `@${n.name} ${n.params}`], ctx, enhanced || sup);
      }
    });
    return any;
  };

  root.walkRules((rule) => {
    if (isGlobal(rule.selector) || inSkipped(rule)) return;
    if (rule.parent && rule.parent.type === 'rule') return;           // handled by parent
    const conds = [];
    for (let p = rule.parent; p && p.type === 'atrule'; p = p.parent) if (/^(media|supports|container)$/.test(p.name)) conds.unshift(`@${p.name} ${p.params}`);
    const filtered = conds.filter((c) => { if (/\(hover:\s*hover\)/.test(c)) { notes.add('v4 wraps hover: in @media (hover: hover), so touch-only devices will not match it (CSS :hover does)'); return false; } return !c.startsWith('@supports'); });
    const sel = unesc(rule.selector);
    const idx = sel.indexOf('.' + cls);
    const ctx = (idx < 0 ? sel : sel.slice(0, idx) + '&' + sel.slice(idx + 1 + cls.length)).trim();
    if (handle(rule, filtered, ctx, false)) validRules++;
  });
  return { raw, custom, globals, valid: validRules > 0, notes: [...notes] };
}

// Resolve var() after merging custom properties from ALL classes of one element:
// Tailwind composes transform/filter/shadow/ring from variables set by different classes.
function resolveAll(raws, customs, globals) {
  const byCtx = new Map();
  for (const c of customs) { const k = ctxKey(c.at, c.ctx); (byCtx.get(k) || byCtx.set(k, new Map()).get(k)).set(c.name, c.value); }
  const baseEnv = byCtx.get(ctxKey([], '&')) || new Map();
  const seen = new Set(); const out = [];
  for (const r of raws) {
    const k = ctxKey(r.at, r.ctx);
    const env = new Map([...globals, ...baseEnv, ...(byCtx.get(k) || [])]);
    const value = cleanComposite(r.prop, resolveVars(r.raw, (n) => env.get(n)));
    const sig = `${k}#${r.prop}#${value}#${r.important}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push({ ...r, value });
  }
  return out;
}

// ------------------------------------------------------------- comparison
const ctxKey = (at, ctx) => `${(at || []).map(normAt).join(' ')}|${(ctx || '&').replace(/\s+/g, '')}`;
const normCtx = (c) => (c || '&').replace(/\s+/g, '').replace(/^&\s*/, '&');

function compare(source, produced) {
  const prodMap = new Map();
  for (const p of produced) {
    for (const [prop, value] of expand(p.prop, p.value)) {
      const k = ctxKey(p.at, p.ctx) + '#' + prop;
      (prodMap.get(k) || prodMap.set(k, []).get(k)).push({ ...p, prop, value: norm(prop, value), shown: p.value });
    }
  }
  const results = []; const used = new Set();
  // unitless line-height (v4 text-* utilities) equals px line-height when font-size is known
  const fontPx = (ctx) => {
    const src = source.find((x) => ctxKey(x.at, normCtx(x.context)) === ctx && x.prop === 'font-size');
    const prd = produced.find((x) => ctxKey(x.at, x.ctx) === ctx && x.prop === 'font-size');
    const v = src ? norm('font-size', src.value) : prd ? norm('font-size', prd.value) : null;
    return v && v.endsWith('px') ? parseFloat(v) : null;
  };
  const sameLeading = (a, b, fs) => {
    if (!fs) return false;
    const [u, p] = /px$/.test(a) ? [b, a] : [a, b];
    return /^[\d.]+$/.test(u) && /px$/.test(p) && Math.abs(parseFloat(u) * fs - parseFloat(p)) < 0.06;
  };
  const prodCtxs = new Set([...prodMap.keys()].map((k) => k.split('#')[0]));
  for (const s of source) {
    // "scoped" form keeps ancestors (.card &); "element" form drops them. Accept either.
    const full = ctxKey(s.at, normCtx(s.context));
    const elem = ctxKey(s.at, '&' + normCtx(s.context).split('&').slice(1).join('&'));
    const useFull = prodCtxs.has(full) || !prodCtxs.has(elem);
    const sctx = useFull ? full : elem;
    const ctxStr = useFull ? normCtx(s.context) : '&' + normCtx(s.context).split('&').slice(1).join('&');
    for (const [prop, value] of expand(s.prop, s.value)) {
      const key = sctx + '#' + prop; const want = norm(prop, value); const cands = prodMap.get(key) || [];
      let status = 'missing', detail = '';
      if (prop.startsWith('--')) { status = 'unverified'; detail = 'custom property'; }
      else if (cands.length) {
        cands.forEach((c) => used.add(key));
        const hit = cands.find((c) => c.value === want || (prop === 'line-height' && sameLeading(c.value, want, fontPx(sctx))));
        if (hit) status = (hit.important === !!s.important) ? 'match' : 'differs', detail = hit.important === !!s.important ? '' : 'importance differs';
        else {
          status = 'differs';
          const a = rgbOf(want), cs = cands.map((c) => ({ c, o: oklchToHex(c.value) }));
          const near = a && cs.find((x) => x.o && x.o.every((v, i) => Math.abs(v - a[i]) <= 2));
          detail = `source ${want}; produced ${[...new Set(cands.map((c) => c.value))].join(' | ')}`;
          const shifted = a && cs.find((x) => x.o);
          if (near) { status = 'match'; detail = 'oklch palette value is within rounding of the source color'; }
          else if (shifted) detail += `  (oklch renders ~rgb(${shifted.o.join(' ')}) in sRGB; use an arbitrary value for the exact color)`;
        }
      } else if (prop === 'transform') {
        const ind = transformAsIndividual(want);
        if (ind) { const alt = prodMap.get(sctx + '#' + ind[0]) || []; if (alt.length) { used.add(sctx + '#' + ind[0]); status = alt.some((c) => c.value.replace(/ /g, '') === norm(ind[0], ind[1]).replace(/ /g, '') ) ? 'match' : 'differs'; detail = status === 'match' ? `via ${ind[0]} property` : `source ${ind[0]}: ${ind[1]}; produced ${alt.map((c) => c.value).join(' | ')}`; } }
        if (status === 'missing') { const t = prodMap.get(key); if (!t) { const multi = splitTop(want, ' ').length > 1; if (multi) { status = 'unverified'; detail = 'multi-function transform: function ORDER matters; compare manually'; } } }
      } else if (/^(background|font|animation|grid-template|mask|list-style|text-decoration|outline|columns)$/.test(prop) && !cands.length) {
        status = 'unverified'; detail = 'shorthand not expanded by this script; check the longhands manually';
      }
      if (status === 'missing') {          // restating a value the base class already sets is redundant, not missing
        const bases = [];
        if ((s.at || []).length) bases.push(ctxKey([], ctxStr));
        if (!ctxStr.includes('::')) {
          const bare = ctxStr.replace(/:(hover|focus|focus-visible|focus-within|active|visited)\b/g, '');
          if (bare !== ctxStr) { bases.push(ctxKey(s.at, bare)); bases.push(ctxKey([], bare)); }
        }
        for (const b of bases) {
          const alt = (prodMap.get(b + '#' + prop) || []).find((c) => c.value === want);
          if (alt) { status = 'match'; detail = 'already set by the base classes, so restating it here is redundant'; used.add(b + '#' + prop); break; }
        }
      }
      results.push({ status, prop, context: s.context || '&', at: s.at || [], detail, ectx: sctx });
    }
  }
  // extras: produced properties no source declaration asked for
  const askedKeys = new Set(results.map((r) => r.ectx + '#' + r.prop));
  const extras = [];
  for (const [k, list] of prodMap) if (!askedKeys.has(k) && !used.has(k) && !k.endsWith('#--') && !(/#-(webkit|moz)-/.test(k) && prodMap.has(k.replace(/#-(webkit|moz)-/, '#')))) extras.push({ status: 'extra', prop: k.split('#')[1], context: list[0].ctx, at: list[0].at, detail: `${list[0].value}   (from ${list[0].cls})` });
  return [...results, ...extras];
}

// -------------------------------------------------------------------- main
const report = [];
for (const item of conv.items) {
  const classes = (item.classes || '').split(/\s+/).filter(Boolean);
  const classReports = []; const raws = [], customs = []; const notes = new Set(); let globals = new Map();
  for (const cls of classes) {
    let root; try { root = await compileFn(cls); } catch (e) { classReports.push({ cls, valid: false, error: String(e.message || e).split('\n')[0], declarations: [] }); continue; }
    const x = extract(root, cls);
    x.notes.forEach((n) => notes.add(n));
    raws.push(...x.raw); customs.push(...x.custom); globals = new Map([...globals, ...x.globals]);
    classReports.push({ cls, valid: x.valid, _raw: x.raw });
  }
  const produced = resolveAll(raws, customs, globals);
  for (const c of classReports) {
    if (c._raw) { c.declarations = produced.filter((p) => p.cls === c.cls).map((p) => `${[...p.at, p.ctx !== '&' ? p.ctx : ''].filter(Boolean).join(' ')}${p.at.length || p.ctx !== '&' ? ' → ' : ''}${p.prop}: ${p.value}${p.important ? ' !important' : ''}`); delete c._raw; }
  }
  const diff = item.source ? compare(item.source, produced) : [];
  report.push({ id: item.id, tailwind: twPkg.version, classes: classReports, diff, notes: [...notes], flags: item.flags || [] });
}
console.warn = origWarn;

if (asJson) { console.log(JSON.stringify(report, null, 2)); }
else {
  const icon = { match: 'ok        ', differs: 'DIFFERS   ', missing: 'MISSING   ', extra: 'extra     ', unverified: 'unverified' };
  for (const r of report) {
    console.log(`\n== ${r.id}   (Tailwind ${r.tailwind})${r.flags.length ? '   source flags: ' + r.flags.join(', ') : ''}`);
    for (const c of r.classes) console.log(`  ${c.valid ? '✔' : '✖'} ${c.cls}${c.valid ? '' : '   <- NOT A VALID CLASS in this Tailwind version' + (c.error ? ` (${c.error})` : '')}`);
    if (r.diff.length) {
      console.log('  -- source vs generated CSS');
      for (const d of r.diff) console.log(`  ${icon[d.status]} ${[...d.at, d.context !== '&' ? d.context : ''].filter(Boolean).join(' ')}${d.at.length || d.context !== '&' ? ' ' : ''}${d.prop}${d.detail ? '  ' + d.detail : ''}`);
    }
    for (const n of r.notes) console.log(`  note: ${n}`);
  }
  const bad = report.flatMap((r) => [...r.classes.filter((c) => !c.valid), ...r.diff.filter((d) => ['differs', 'missing'].includes(d.status))]);
  console.log(`\n${bad.length ? bad.length + ' issue(s) need attention.' : 'No invalid classes or mismatches found.'} (advisory: 16px root assumed; "unverified" lines need a manual look)`);
  process.exitCode = bad.length ? 1 : 0;
}
