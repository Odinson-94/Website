#!/usr/bin/env node
/**
 * adelphos_CLI
 * ============
 * Single entry point for the website build pipeline.
 *
 * !! DO NOT USE for non-docs pages !!
 * All non-docs build scripts (home, apps, agentic services, features,
 * workflows, demos, SEO roots, comparisons, changelog, glossary) have
 * been intentionally deleted. Those pages are now static / manually
 * maintained. Only tool pages and command pages are build-generated.
 *
 * USAGE
 *   adelphos_CLI draft   <type> <slug>            generate a YAML draft via Claude (or stub)
 *   adelphos_CLI promote <type> <slug>            move draft to data/, snapshot to _archive/
 *   adelphos_CLI build   <type> <slug>            generate the HTML page from data/
 *   adelphos_CLI rollback <type> <slug> --to <iso> restore from _archive/
 *
 * INSTALL
 *   npm link  (in this repo)         then `adelphos_CLI <cmd>` is on PATH
 *
 * DRY RUN
 *   node scripts/adelphos_CLI.mjs draft   tool list_rooms
 *   node scripts/adelphos_CLI.mjs promote tool list_rooms
 *   node scripts/adelphos_CLI.mjs build   tool list_rooms
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, loadJson, parseSimpleYaml, exists, validateAgainstSchema } from './lib/registry.mjs';
import { draft } from './lib/drafter.mjs';
import { extractCommandRegistry, extractMcpRegistry } from './lib/extractor.mjs';
import { buildToolPage }     from './build-tool-pages.mjs';
import { buildCommandPage }  from './build-command-pages.mjs';
import { buildToolsInventory, buildCommandsInventory, buildDocsIndex } from './build-inventory-pages.mjs';
import { safeWriteFile } from './lib/backup.mjs';
import fsBuiltin from 'node:fs/promises';

// Where the MEP Bridge clone lives on this machine.
// In production, this comes from a synced bundle in data/registries/.
const MEPBRIDGE_REPO = process.env.MEPBRIDGE_PATH
  || 'C:\\Users\\jorda\\AppData\\Local\\Temp\\MEPBridge';
const SCAN_PATH = path.join(MEPBRIDGE_REPO, 'MEPBridge.Revit');

const SKILL_FOLDERS = {
  tool:     'Tool Page',
  command:  'Command Page',
};

const args = process.argv.slice(2);
const cmd  = args[0];

(async () => {
  try {
    switch (cmd) {
      case 'extract':   return await cmdExtract();
      case 'draft':     return await cmdDraft(args[1], args[2]);
      case 'promote':   return await cmdPromote(args[1], args[2]);
      case 'build':     return await cmdBuild(args[1], args[2]);
      case 'inventory': return await cmdInventory(args[1]);
      case 'auto':      return await cmdAuto(args[1], args[2]);
      case 'auto-all':  return await cmdAutoAll();
      case 'rollback':  return await cmdRollback(args[1], args[2], parseFlag('--to'));
      case 'help':
      case undefined:
      case '-h':
      case '--help':   return printHelp();
      default:
        console.error(`Unknown command: ${cmd}`);
        printHelp();
        process.exit(1);
    }
  } catch (e) {
    console.error('✗', e.message);
    process.exit(1);
  }
})();

function parseFlag(name) {
  const i = args.indexOf(name);
  return i > 0 ? args[i + 1] : null;
}

function printHelp() {
  console.log(`
adelphos_CLI — DOCS ONLY (tools + commands)

  !! All non-docs build scripts have been deleted.          !!
  !! Home, apps, features, agentic services, workflows,     !!
  !! demos, SEO roots, comparisons, changelog, glossary      !!
  !! are now static pages — DO NOT rebuild them.             !!

  extract                           scan the MEP Bridge .cs source → JSON registries
  auto     <type> <slug>            extract → draft → promote → build, end-to-end
  auto-all                          rebuild all tool + command pages and inventories
  draft    <type> <slug>            generate a YAML draft via Claude (or stub)
  promote  <type> <slug>            move draft to data/, snapshot to _archive/
  build    <type> <slug>            generate the HTML page from data/
  inventory tools|commands          rebuild the inventory index page
  rollback <type> <slug> --to <iso> restore from _archive/

  types: ${Object.keys(SKILL_FOLDERS).join(' | ')}

ENV
  MEPBRIDGE_PATH     where the MEP Bridge clone lives (default: %TEMP%\\MEPBridge)
  ANTHROPIC_API_KEY  if set, draft uses Claude Opus (claude-opus-4-20251010, temp 0)
                     if unset, draft uses a deterministic stub for testing

EXAMPLES
  adelphos_CLI extract                                      (re-scan codebase → registries)
  adelphos_CLI auto command extend-all-connectors           (extract → draft → promote → build)
  adelphos_CLI auto-all                                     (rebuild all tools + commands)
`.trim());
}

/* --------------------------------------------------------------- extract */
async function cmdExtract() {
  console.log(`Scanning ${SCAN_PATH} ...`);
  const cmds = await extractCommandRegistry(SCAN_PATH);
  const tools = await extractMcpRegistry(SCAN_PATH);

  const cmdPath  = path.join(ROOT, 'data', 'registries', 'command_registry.json');
  const toolPath = path.join(ROOT, 'sandbox', 'data', 'tools.json');
  await safeWriteFile(cmdPath,  JSON.stringify(cmds, null, 2),  'utf8');
  await safeWriteFile(toolPath, JSON.stringify(tools, null, 2), 'utf8');

  console.log(`✓ ${cmds.length}  commands → ${rel(cmdPath)}`);
  console.log(`✓ ${tools.length} tools    → ${rel(toolPath)}`);
}

/* ------------------------------------------------------- inventory pages */
async function cmdInventory(what) {
  if (what === 'tools') {
    const r = await buildToolsInventory();
    console.log(`✓ ${r.count} tools  → ${rel(r.out)}`);
  } else if (what === 'commands') {
    const r = await buildCommandsInventory();
    console.log(`✓ ${r.count} commands → ${rel(r.out)}`);
  } else throw new Error('inventory: tools | commands');
}

/* -------------------------------------------------------------- auto-all */
async function cmdAutoAll() {
  console.log('\n=== DOCS-ONLY BUILD (tools + commands) ===\n');

  console.log('[1] extract registries from MEP Bridge .cs source');
  try { await cmdExtract(); }
  catch (e) { console.warn(`    (skipping extract — MEP Bridge not at expected path: ${e.message})`); }

  console.log('\n[2] generate inventory pages');
  const t = await buildToolsInventory();      console.log(`    ✓ ${rel(t.out)}  (${t.count} tools)`);
  const c = await buildCommandsInventory();   console.log(`    ✓ ${rel(c.out)}  (${c.count} commands)`);
  const i = await buildDocsIndex();           console.log(`    ✓ ${rel(i.out)}`);

  console.log('\n[3] generate individual tool pages');
  const tools = await loadJson('sandbox/data/tools.json');
  let toolCount = 0;
  for (const tool of tools) {
    try {
      const out = await buildToolPage(tool.name);
      toolCount++;
    } catch (e) {
      console.warn(`    ⚠ ${tool.name}: ${e.message}`);
    }
  }
  console.log(`    ✓ ${toolCount} tool pages built`);

  console.log('\n[4] generate individual command pages');
  let cmds = await loadJson('data/registries/command_registry.json');
  if (!Array.isArray(cmds)) cmds = [cmds];
  let cmdCount = 0;
  for (const cmd of cmds) {
    const slug = slugify(cmd.class);
    try {
      const out = await buildCommandPage(slug);
      cmdCount++;
    } catch (e) {
      console.warn(`    ⚠ ${slug}: ${e.message}`);
    }
  }
  console.log(`    ✓ ${cmdCount} command pages built`);

  console.log('\n=== DONE ===');
  console.log('\nOpen these URLs to review:');
  console.log('  http://localhost:8765/docs/tools/index.html');
  console.log('  http://localhost:8765/docs/commands/index.html');
  console.log('  http://localhost:8765/docs/index.html');
}

/* ------------------------------------------------------------------ auto */
async function cmdAuto(type, slug) {
  console.log(`\n[1/4] extract`);
  if (type === 'command' || type === 'tool') await cmdExtract();
  else console.log(`  (skipped — ${type} doesn't extract from C#)`);

  console.log(`\n[2/4] draft`);
  await cmdDraft(type, slug);

  console.log(`\n[3/4] promote`);
  await cmdPromote(type, slug);

  console.log(`\n[4/4] build`);
  await cmdBuild(type, slug);

  console.log(`\n✓ Pipeline complete.`);
}

/* ---------------------------------------------------------------- draft */
async function cmdDraft(type, slug) {
  if (!SKILL_FOLDERS[type]) throw new Error(`unknown type "${type}"`);
  if (!slug) throw new Error('slug required');

  const sourceData = await loadSourceData(type, slug);
  if (!sourceData) throw new Error(`source data for "${slug}" not found in registry`);

  const { yaml, object, meta } = await draft({
    pageType: type,
    sourceData,
    sourceSha: process.env.GIT_SHA || (await tryGitSha()),
  });

  // Validate against schema (only if a real schema exists for this page type)
  const schemaPath = path.join(ROOT, 'BUILD WEB Plan', 'Page Type Skills', SKILL_FOLDERS[type], 'schema.json');
  const schemaSize = await fsBuiltin.stat(schemaPath).then(s => s.size).catch(() => 0);
  if (schemaSize > 100) {
    const schema = JSON.parse(await fs.readFile(schemaPath, 'utf8'));
    const errors = validateAgainstSchema(object, schema);
    if (errors.length) {
      console.error(`✗ Schema validation failed (${errors.length} errors):`);
      for (const e of errors) console.error('  -', e);
      const failPath = path.join(ROOT, 'data', '_drafts', '_failed', type, `${slug}.yaml.failed`);
      await fs.mkdir(path.dirname(failPath), { recursive: true });
      await fs.writeFile(failPath, yaml + '\n\n# VALIDATION ERRORS:\n# ' + errors.join('\n# '), 'utf8');
      console.error(`  written to ${rel(failPath)}`);
      process.exit(2);
    }
  }

  const folder = type === 'tool' ? 'tools' : type + 's';
  // Always write JSON for the dry run — robust to deeply nested structures.
  // (We also write the YAML for human readability.)
  const outJson = path.join(ROOT, 'data', '_drafts', folder, `${slug}.json`);
  const outYaml = path.join(ROOT, 'data', '_drafts', folder, `${slug}.yaml`);
  await fs.mkdir(path.dirname(outJson), { recursive: true });
  await fs.writeFile(outJson, JSON.stringify(object, null, 2), 'utf8');
  await fs.writeFile(outYaml, yaml + '\n', 'utf8');
  const outPath = outJson;

  console.log(`✓ ${meta.mode} drafted ${type}/${slug}`);
  console.log(`  ${rel(outPath)}`);
}

/* -------------------------------------------------------------- promote */
async function cmdPromote(type, slug) {
  if (!SKILL_FOLDERS[type]) throw new Error(`unknown type "${type}"`);
  const folder = type === 'tool' ? 'tools' : type + 's';
  const draftJson = path.join(ROOT, 'data', '_drafts', folder, `${slug}.json`);
  const draftYaml = path.join(ROOT, 'data', '_drafts', folder, `${slug}.yaml`);
  const dataJson  = path.join(ROOT, 'data', folder, `${slug}.json`);
  const dataYaml  = path.join(ROOT, 'data', folder, `${slug}.yaml`);
  const stamp     = new Date().toISOString().replace(/[:.]/g, '-');

  if (!(await exists(path.relative(ROOT, draftJson)))) throw new Error(`no draft at ${rel(draftJson)} — run "draft" first`);

  if (await exists(path.relative(ROOT, dataJson))) {
    const a = path.join(ROOT, '_archive', stamp, folder, `${slug}.json`);
    await fs.mkdir(path.dirname(a), { recursive: true });
    await fs.copyFile(dataJson, a);
    console.log(`  backed up existing → ${rel(a)}`);
  }

  await fs.mkdir(path.dirname(dataJson), { recursive: true });
  await fs.copyFile(draftJson, dataJson);
  if (await exists(path.relative(ROOT, draftYaml))) await fs.copyFile(draftYaml, dataYaml);
  console.log(`✓ promoted ${type}/${slug}`);
  console.log(`  ${rel(draftJson)} → ${rel(dataJson)}`);
}

/* ---------------------------------------------------------------- build */
async function cmdBuild(type, slug) {
  let out;
  if (type === 'tool')          out = await buildToolPage(slug);
  else if (type === 'command')  out = await buildCommandPage(slug);
  else throw new Error(`"${type}" is not a docs type — only tool | command are build-generated. All other pages are static.`);
  console.log(`✓ built ${rel(out)}`);
  console.log(`  open  http://localhost:8765/${path.relative(ROOT, out).replace(/\\/g,'/')}`);
}

/* ------------------------------------------------------------- rollback */
async function cmdRollback(type, slug, isoStamp) {
  if (!isoStamp) throw new Error('--to <iso-timestamp> required');
  const folder = type === 'tool' ? 'tools' : type + 's';
  const stamp  = isoStamp.replace(/[:.]/g, '-');
  const src    = path.join(ROOT, '_archive', stamp, folder, `${slug}.yaml`);
  const dst    = path.join(ROOT, 'data', folder, `${slug}.yaml`);
  if (!(await exists(path.relative(ROOT, src)))) throw new Error(`no archive at ${rel(src)}`);
  await fs.copyFile(src, dst);
  console.log(`✓ rolled back ${type}/${slug} from ${stamp}`);
}

/* --------------------------------------------------------------- helpers */
async function loadSourceData(type, slug) {
  if (type === 'tool') {
    const tools = await loadJson('sandbox/data/tools.json');
    return tools.find(t => t.name === slug);
  }
  if (type === 'command') {
    let cmds = await loadJson('data/registries/command_registry.json');
    if (!Array.isArray(cmds)) cmds = [cmds];
    return cmds.find(c => c.class === slug || slugify(c.class) === slug);
  }
  return null;
}

function slugify(s) {
  return String(s)
    .replace(/Command$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function tryGitSha() {
  try {
    const { execSync } = await import('node:child_process');
    return execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch { return 'no-git'; }
}

function rel(p) { return path.relative(ROOT, p).replace(/\\/g, '/'); }
