/**
 * scripts/lib/extractor.mjs
 *
 * Pure-Node version of the Python extractors in handoff/MEPBridge/tools/.
 * Same regex contract, same output shape — used because Python is a Microsoft
 * Store shim on this box. The Python files are still the source of truth for
 * the eventual MEP Bridge PR; this is the runtime equivalent for the website CLI.
 *
 * Exposes:
 *   extractCommandRegistry(repoRoot)  → array of command rows
 *   extractMcpRegistry(repoRoot)      → array of tool rows
 *   extractRestApiRegistry(repoRoot)  → array of REST commands (will be empty until
 *                                        [RestApi] tagging starts in the codebase)
 *   extractUiSurfaces(repoRoot)       → which classes have UI / web app
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const EXCLUDE = new Set(['bin', 'obj', '.vs', '.backups']);

async function* walkCs(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const e of entries) {
    if (EXCLUDE.has(e.name)) continue;
    const full = path.join(root, e.name);
    if (e.isDirectory()) yield* walkCs(full);
    else if (e.isFile() && e.name.endsWith('.cs')) yield full;
  }
}

function clean(raw) {
  return String(raw)
    .replace(/^\s*\/\/\/\s?/gm, '')
    .replace(/<see\s+cref="([^"]+)"\s*\/>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function firstSentence(t) {
  if (!t) return '';
  const m = t.match(/^(.*?[.!?])(\s|$)/);
  return m ? m[1].trim() : t.slice(0, 240).trim();
}
function block(re, text) {
  const m = text.match(re);
  return m ? clean(m[1]) : '';
}
function rawBlock(re, text) {
  const m = text.match(re);
  return m ? m[1].replace(/^\s*\/\/\/\s?/gm, '').trim() : '';
}
function quotedList(s) {
  return [...String(s).matchAll(/"([^"]+)"/g)].map(m => m[1]);
}

export async function extractCommandRegistry(scanPath) {
  const out = [];
  for await (const fp of walkCs(scanPath)) {
    const t = await fs.readFile(fp, 'utf8').catch(() => '');
    if (!/\[Transaction\(/.test(t)) continue;
    const cm = t.match(/public\s+(?:sealed\s+)?class\s+(\w+)/);
    if (!cm) continue;
    const summary  = block(/<summary>([\s\S]*?)<\/summary>/, t);
    const usecase  = block(/<usecase>([\s\S]*?)<\/usecase>/, t);
    const notfor   = block(/<notfor>([\s\S]*?)<\/notfor>/, t);
    const pre      = block(/<precondition>([\s\S]*?)<\/precondition>/, t);
    const post     = block(/<postcondition>([\s\S]*?)<\/postcondition>/, t);
    const sef      = block(/<sideeffects>([\s\S]*?)<\/sideeffects>/, t);
    const lt       = rawBlock(/<logictree>([\s\S]*?)<\/logictree>/, t);
    const kwM      = t.match(/\[Keywords\(([^)]+)\)\]/);
    const ipM      = t.match(/\[IntentPattern\(([^)]+)\)\]/);
    const stM      = t.match(/\[ServiceType\("([^"]+)"\)\]/);
    const ccM      = t.match(/\[CommandCategory\("([^"]+)"/);
    const aiBlock  = t.match(/<aiprompts>([\s\S]*?)<\/aiprompts>/);
    let aiprompts = null;
    if (aiBlock) {
      const ab = aiBlock[1];
      const list = re => [...ab.matchAll(re)].map(m => clean(m[1]));
      aiprompts = {
        preprompts:     list(/<preprompt>([\s\S]*?)<\/preprompt>/g),
        thinkingsteps:  list(/<thinkingstep>([\s\S]*?)<\/thinkingstep>/g),
        successprompts: list(/<successprompt>([\s\S]*?)<\/successprompt>/g),
        failureprompts: list(/<failureprompt>([\s\S]*?)<\/failureprompt>/g),
      };
    }
    const sel = [...t.matchAll(/\[SelectionInput\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"(?:[^)]*Prompt\s*=\s*"([^"]+)")?/g)]
      .map(m => ({ name: m[1], type: m[2], description: m[3], prompt: m[4] || '' }));
    const cfg = [...t.matchAll(/\[ConfigInput\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"(?:[^)]*DefaultValue\s*=\s*([^,)]+))?/g)]
      .map(m => ({ name: m[1], type: m[2], description: m[3], default: (m[4] || '').trim() }));
    const outs = [...t.matchAll(/\[Output\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"/g)]
      .map(m => ({ name: m[1], type: m[2], description: m[3] }));
    const rcM = t.match(/\[RelatedCommands\(([^)]+)\)\]/);
    out.push({
      class:           cm[1],
      desc:            firstSentence(summary),
      summary,
      usecase, notfor, precondition: pre, postcondition: post, sideeffects: sef,
      logictree:       lt,
      keywords:        kwM ? quotedList(kwM[1]) : [],
      intent_patterns: ipM ? quotedList(ipM[1]) : [],
      pillar:          stM ? prettyPillar(stM[1]) : (ccM ? ccM[1] : ''),
      pillar_raw:      stM ? stM[1] : '',
      selection_inputs: sel,
      config_inputs:    cfg,
      outputs:          outs,
      related_commands: rcM ? quotedList(rcM[1]) : [],
      aiprompts,
      has_restapi:      /\[RestApi\(/.test(t),
    });
  }
  out.sort((a, b) => a.class.localeCompare(b.class));
  return out;
}

export async function extractMcpRegistry(scanPath) {
  const out = [];
  for await (const fp of walkCs(scanPath)) {
    const t = await fs.readFile(fp, 'utf8').catch(() => '');
    const tm = t.match(/\[McpTool\("([^"]+)"\s*,\s*"([^"]+)"/);
    if (!tm) continue;
    const bridge   = (t.match(/RequiresBridge\s*=\s*"([^"]+)"/) || [, ''])[1];
    const category = (t.match(/Category\s*=\s*"([^"]+)"/) || [, 'context'])[1];
    const always   = /AlwaysAvailable\s*=\s*true/.test(t);
    const params = [...t.matchAll(/\[McpParam\("([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"(?:\s*,\s*Required\s*=\s*(true|false))?/g)]
      .map(m => ({ name: m[1], type: m[2], description: m[3], required: m[4] === 'true' }));
    const kwM = t.match(/\[Keywords\(([^)]+)\)\]/);
    out.push({
      name: tm[1],
      desc: tm[2],
      bridge,
      category,
      always,
      param_count: params.length,
      parameters: params,
      keywords: kwM ? quotedList(kwM[1]) : [],
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

function prettyPillar(s) {
  // SoilDrainage → Drainage; HotWater → Hot Water etc.
  return s.replace(/^Soil/, '').replace(/([A-Z])/g, ' $1').trim();
}
