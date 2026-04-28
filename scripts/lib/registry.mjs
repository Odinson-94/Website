/**
 * scripts/lib/registry.mjs
 * Shared loaders/validators for the build pipeline. Keeps the cli + generators
 * thin and consistent.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Use fileURLToPath so Windows drive letters + spaces are handled correctly.
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export async function loadJson(rel) {
  const full = path.join(ROOT, rel);
  let txt = await fs.readFile(full, 'utf8');
  if (txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1);  // strip UTF-8 BOM
  return JSON.parse(txt);
}

export async function loadYaml(rel) {
  // Minimal YAML reader (safe enough for the schemas we control).
  // For real builds, swap in `js-yaml`.
  const txt = await fs.readFile(path.join(ROOT, rel), 'utf8');
  return parseSimpleYaml(txt);
}

export async function writeFile(rel, content) {
  const { backupBeforeWrite } = await import('./backup.mjs');
  const full = path.join(ROOT, rel);
  await backupBeforeWrite(full);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, 'utf8');
  return full;
}

export async function exists(rel) {
  try { await fs.stat(path.join(ROOT, rel)); return true; } catch { return false; }
}

/* ------------------------------------------------------------------------- *
 *  Tiny YAML  (handles flat keys, nested objects, lists of scalars/objects,
 *  literal blocks via `|` — what our schemas use).
 *  Not a complete YAML parser; deliberately small + auditable.
 * ------------------------------------------------------------------------- */
export function parseSimpleYaml(txt) {
  const lines = txt.split(/\r?\n/);
  const root  = {};
  const stack = [{ indent: -1, value: root }];

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    if (raw.trim() === '' || raw.trim().startsWith('#')) { i++; continue; }

    const indent = raw.length - raw.trimStart().length;
    const line   = raw.trim();

    // Pop stack to current indent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
    const parent = stack[stack.length - 1].value;

    // Literal block " key: |"
    let m = line.match(/^([\w-]+):\s*\|\s*$/);
    if (m) {
      const key = m[1];
      i++;
      const blockIndent = lines[i] ? (lines[i].length - lines[i].trimStart().length) : indent + 2;
      const buf = [];
      while (i < lines.length) {
        const l = lines[i];
        if (l.trim() === '') { buf.push(''); i++; continue; }
        const ind = l.length - l.trimStart().length;
        if (ind < blockIndent) break;
        buf.push(l.slice(blockIndent));
        i++;
      }
      parent[key] = buf.join('\n').replace(/\n+$/, '') + '\n';
      continue;
    }

    // List item under a parent
    if (line.startsWith('- ')) {
      const owner = stack[stack.length - 1];
      if (!Array.isArray(owner.value)) { i++; continue; }

      const rest = line.slice(2);
      // "- key: value"  → list item is an object; start collecting that object
      const kv = rest.match(/^([\w-]+):\s*(.*)$/);
      if (kv) {
        const obj = {};
        if (kv[2] === '') {
          // nested map/list under this key
          // peek next line
          let j = i + 1;
          while (j < lines.length && lines[j].trim() === '') j++;
          const nextLine = lines[j] || '';
          const nextInd = nextLine.length - nextLine.trimStart().length;
          if (nextLine.trim().startsWith('- ') && nextInd > indent + 2) {
            obj[kv[1]] = [];
            owner.value.push(obj);
            stack.push({ indent: indent + 2, value: obj });          // continuation of this object
            stack.push({ indent: indent + 4, value: obj[kv[1]] });    // and its nested list
          } else {
            obj[kv[1]] = {};
            owner.value.push(obj);
            stack.push({ indent: indent + 2, value: obj });
            stack.push({ indent: indent + 4, value: obj[kv[1]] });
          }
        } else {
          // inline scalar
          obj[kv[1]] = parseScalar(kv[2]);
          owner.value.push(obj);
          stack.push({ indent: indent + 2, value: obj });             // siblings of kv go here
        }
      } else {
        // bare scalar item
        owner.value.push(parseScalar(rest));
      }
      i++; continue;
    }

    // Scalar inline list:   key: [a, b, c]
    m = line.match(/^([\w-]+):\s*\[(.*)\]\s*$/);
    if (m) {
      const key   = m[1];
      const items = m[2].trim() === '' ? [] : m[2].split(',').map(s => parseScalar(s.trim()));
      parent[key] = items;
      i++; continue;
    }

    // Map key with no value (becomes a child object/list)
    m = line.match(/^([\w-]+):\s*$/);
    if (m) {
      const key = m[1];
      // peek next line to decide list vs map
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === '') j++;
      const nextLine = lines[j] || '';
      const nextInd  = nextLine.length - nextLine.trimStart().length;
      if (nextLine.trim().startsWith('- ') && nextInd > indent) {
        parent[key] = [];
        stack.push({ indent: indent + 2, value: parent[key] });
      } else {
        parent[key] = {};
        stack.push({ indent: indent + 2, value: parent[key] });
      }
      i++; continue;
    }

    // Inline scalar:  key: value
    m = line.match(/^([\w-]+):\s*(.*)$/);
    if (m) {
      const key = m[1];
      parent[key] = parseScalar(m[2]);
      i++; continue;
    }

    i++;
  }
  return root;
}

function parseScalar(s) {
  s = s.trim();
  if (s === '' || s === 'null' || s === '~') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
  // quoted strings
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

/* ------------------------------------------------------------------------- *
 *  Schema validation — minimal hand-roll for our own schemas
 * ------------------------------------------------------------------------- */
export function validateAgainstSchema(data, schema) {
  const errors = [];
  validate(data, schema, '', errors);
  return errors;
}

function validate(data, schema, path, errors) {
  if (schema.type === 'object') {
    if (typeof data !== 'object' || Array.isArray(data) || data === null) {
      errors.push(`${path}: expected object, got ${typeof data}`);
      return;
    }
    for (const req of schema.required || []) {
      if (!(req in data)) errors.push(`${path}.${req}: required field missing`);
    }
    for (const [k, sub] of Object.entries(schema.properties || {})) {
      if (k in data) validate(data[k], sub, `${path}.${k}`, errors);
    }
    if (schema.additionalProperties === false) {
      for (const k of Object.keys(data)) {
        if (!(k in (schema.properties || {}))) {
          errors.push(`${path}.${k}: unexpected property (additionalProperties: false)`);
        }
      }
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(data)) { errors.push(`${path}: expected array`); return; }
    if (schema.minItems != null && data.length < schema.minItems) errors.push(`${path}: minItems ${schema.minItems}, got ${data.length}`);
    if (schema.maxItems != null && data.length > schema.maxItems) errors.push(`${path}: maxItems ${schema.maxItems}, got ${data.length}`);
    if (schema.items) data.forEach((v, i) => validate(v, schema.items, `${path}[${i}]`, errors));
  } else if (schema.type === 'string') {
    if (typeof data !== 'string') { errors.push(`${path}: expected string`); return; }
    if (schema.minLength != null && data.length < schema.minLength) errors.push(`${path}: minLength ${schema.minLength}`);
    if (schema.maxLength != null && data.length > schema.maxLength) errors.push(`${path}: maxLength ${schema.maxLength}, got ${data.length}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(data)) errors.push(`${path}: doesn't match ${schema.pattern}`);
    if (schema.enum && !schema.enum.includes(data)) errors.push(`${path}: must be one of ${schema.enum.join(',')}`);
    if (schema.const && data !== schema.const) errors.push(`${path}: must equal "${schema.const}"`);
  } else if (schema.type === 'boolean') {
    if (typeof data !== 'boolean') errors.push(`${path}: expected boolean`);
  } else if (schema.type === 'number' || schema.type === 'integer') {
    if (typeof data !== 'number') errors.push(`${path}: expected number`);
  }
}

/* ------------------------------------------------------------------------- *
 *  YAML serialiser — writes deterministic YAML in our schema shape
 * ------------------------------------------------------------------------- */
export function toYaml(obj, indent = 0) {
  const pad = '  '.repeat(indent);
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) {
      out.push(`${pad}${k}:`);
    } else if (Array.isArray(v)) {
      if (v.length === 0) {
        out.push(`${pad}${k}: []`);
      } else if (v.every(x => typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean')) {
        // inline form
        const items = v.map(x => typeof x === 'string' ? quoteYamlScalar(x) : String(x)).join(', ');
        out.push(`${pad}${k}: [${items}]`);
      } else {
        out.push(`${pad}${k}:`);
        for (const item of v) {
          if (item && typeof item === 'object') {
            // Render the object at indent 0; we'll add the array-item prefix here.
            // This preserves relative indentation for any nested arrays/objects.
            const inner = toYaml(item, 0).split('\n').filter(Boolean);
            if (inner.length === 0) { out.push(`${pad}  - {}`); continue; }
            out.push(`${pad}  - ${inner[0]}`);
            for (const l of inner.slice(1)) {
              out.push(`${pad}    ${l}`);
            }
          } else {
            out.push(`${pad}  - ${typeof item === 'string' ? quoteYamlScalar(item) : String(item)}`);
          }
        }
      }
    } else if (typeof v === 'object') {
      out.push(`${pad}${k}:`);
      out.push(toYaml(v, indent + 1));
    } else if (typeof v === 'string') {
      if (v.includes('\n')) {
        out.push(`${pad}${k}: |`);
        for (const l of v.split('\n')) out.push(`${pad}  ${l}`);
      } else {
        out.push(`${pad}${k}: ${quoteYamlScalar(v)}`);
      }
    } else {
      out.push(`${pad}${k}: ${String(v)}`);
    }
  }
  return out.join('\n');
}

function quoteYamlScalar(s) {
  if (s === '' || /^[-?:&*!|>%@`]/.test(s) || /[#:\[\]\{\},&*!|>%@`"']/.test(s) || s.includes(': ') || s.match(/^(true|false|null|~|\d+(\.\d+)?)$/)) {
    return JSON.stringify(s); // safe quote
  }
  return s;
}
