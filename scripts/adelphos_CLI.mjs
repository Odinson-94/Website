#!/usr/bin/env node
/**
 * adelphos_CLI
 * ============
 * Single entry point for the website build pipeline.
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
import { buildWorkflowPage } from './build-workflow-pages.mjs';
import { buildDemoPage }     from './build-demo-pages.mjs';
import { buildToolsInventory, buildCommandsInventory, buildDemosGallery, buildDocsIndex } from './build-inventory-pages.mjs';
import { buildAppPage, buildAppsInventory, buildAllAppPages } from './build-app-pages.mjs';
import { buildAgenticServicePage, buildAgenticServicesInventory, buildAllAgenticServicePages } from './build-agentic-pages.mjs';
import { buildFeaturePage, buildFeaturesInventory, buildAllFeaturePages } from './build-feature-pages.mjs';
import { buildWorkflowsInventory, buildResourcesInventory, buildDownloadsInventory } from './build-section-inventories.mjs';
import { buildSitemap, buildRobots, buildLlmsTxt } from './build-seo-roots.mjs';
import { buildComparisons, buildChangelog, buildGlossary } from './build-tier3-4.mjs';
import { buildHome } from './build-home.mjs';
import fsBuiltin from 'node:fs/promises';

// Where the MEP Bridge clone lives on this machine.
// In production, this comes from a synced bundle in data/registries/.
const MEPBRIDGE_REPO = process.env.MEPBRIDGE_PATH
  || 'C:\\Users\\jorda\\AppData\\Local\\Temp\\MEPBridge';
const SCAN_PATH = path.join(MEPBRIDGE_REPO, 'MEPBridge.Revit');

const SKILL_FOLDERS = {
  tool:     'Tool Page',
  command:  'Command Page',
  workflow: 'Workflow Page',
  demo:     'Demo Page',
  pillar:   'Pillar Page',
  bridge:   'Bridge Page',
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
      case 'gallery':   return await cmdGallery(args[1]);
      case 'index':     return await cmdIndex(args[1]);
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
adelphos_CLI

  extract                           scan the MEP Bridge .cs source → JSON registries
  auto     <type> <slug>            extract → draft → promote → build, end-to-end
  draft    <type> <slug>            generate a YAML draft via Claude (or stub)
  promote  <type> <slug>            move draft to data/, snapshot to _archive/
  build    <type> <slug>            generate the HTML page from data/
  rollback <type> <slug> --to <iso> restore from _archive/

  types: ${Object.keys(SKILL_FOLDERS).join(' | ')}

ENV
  MEPBRIDGE_PATH     where the MEP Bridge clone lives (default: %TEMP%\\MEPBridge)
  ANTHROPIC_API_KEY  if set, draft uses Claude Opus (claude-opus-4-20251010, temp 0)
                     if unset, draft uses a deterministic stub for testing

EXAMPLES
  adelphos_CLI extract                         (re-scan codebase → command_registry.json + tools.json)
  adelphos_CLI auto command extend-all-connectors   (extract → draft → promote → build → live URL)
`.trim());
}

/* --------------------------------------------------------------- extract */
async function cmdExtract() {
  console.log(`Scanning ${SCAN_PATH} ...`);
  const cmds = await extractCommandRegistry(SCAN_PATH);
  const tools = await extractMcpRegistry(SCAN_PATH);

  const cmdPath  = path.join(ROOT, 'data', 'registries', 'command_registry.json');
  const toolPath = path.join(ROOT, 'sandbox', 'data', 'tools.json');
  await fsBuiltin.mkdir(path.dirname(cmdPath), { recursive: true });
  await fsBuiltin.writeFile(cmdPath,  JSON.stringify(cmds, null, 2),  'utf8');
  await fsBuiltin.writeFile(toolPath, JSON.stringify(tools, null, 2), 'utf8');

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
async function cmdGallery(what) {
  if (what !== 'demos') throw new Error('gallery: demos');
  const r = await buildDemosGallery();
  console.log(`✓ ${r.count} demos → ${rel(r.out)}`);
}
async function cmdIndex(what) {
  if (what !== 'docs') throw new Error('index: docs');
  const r = await buildDocsIndex();
  console.log(`✓ docs landing → ${rel(r.out)}`);
}

/* -------------------------------------------------------------- auto-all */
async function cmdAutoAll() {
  console.log('\n=== FULL AUTOMATION RUN ===\n');

  console.log('[1] extract registries from MEP Bridge .cs source');
  try { await cmdExtract(); }
  catch (e) { console.warn(`    (skipping extract — MEP Bridge not at expected path: ${e.message})`); }

  console.log('\n[2] generate inventory + gallery + landing pages');
  const t  = await buildToolsInventory();             console.log(`    ✓ ${rel(t.out)}  (${t.count} tools)`);
  const c  = await buildCommandsInventory();          console.log(`    ✓ ${rel(c.out)}  (${c.count} commands)`);
  const d  = await buildDemosGallery();               console.log(`    ✓ ${rel(d.out)}  (${d.count} demos)`);
  const i  = await buildDocsIndex();                  console.log(`    ✓ ${rel(i.out)}`);
  const a  = await buildAppsInventory();              console.log(`    ✓ ${rel(a.out)}  (${a.count} apps)`);
  const fInv = await buildFeaturesInventory();        console.log(`    ✓ ${rel(fInv.out)}  (${fInv.count} features)`);
  const ag = await buildAgenticServicesInventory();   console.log(`    ✓ ${rel(ag.out)}  (${ag.count} services)`);
  const w  = await buildWorkflowsInventory();         console.log(`    ✓ ${rel(w.out)}  (${w.count} workflows)`);
  const r  = await buildResourcesInventory();         console.log(`    ✓ ${rel(r.out)}  (${r.count} resource categories)`);
  const dl = await buildDownloadsInventory();         console.log(`    ✓ ${rel(dl.out)}  (${dl.count} downloads)`);

  console.log('\n[3] generate per-app + per-service + per-feature detail pages');
  const apps  = await buildAllAppPages();              for (const o of apps)  console.log(`    ✓ ${rel(o)}`);
  const feats = await buildAllFeaturePages();          for (const o of feats) console.log(`    ✓ ${rel(o)}`);
  const svcs  = await buildAllAgenticServicePages();   for (const o of svcs)  console.log(`    ✓ ${rel(o)}`);

  console.log('\n[3b] new homepage');
  const home = await buildHome();                     console.log(`    ✓ ${rel(home.out)}`);

  console.log('\n[4] tier-3 SEO pages (comparisons + changelog + glossary)');
  const cmp = await buildComparisons();    for (const o of cmp.outs) console.log(`    ✓ ${rel(o)}`);
  const chg = await buildChangelog();      console.log(`    ✓ ${rel(chg.out)}  (${chg.count} releases)`);
  const gls = await buildGlossary();       console.log(`    ✓ ${rel(gls.out)}  (${gls.count} terms)`);

  console.log('\n[5] tier-1 SEO roots (sitemap + robots + llms.txt)');
  const sm = await buildSitemap();         console.log(`    ✓ ${rel(sm.out)}  (${sm.count} URLs)`);
  const rb = await buildRobots();          console.log(`    ✓ ${rel(rb.out)}`);
  const lm = await buildLlmsTxt();         console.log(`    ✓ ${rel(lm.out)}`);

  console.log('\n=== DONE ===');
  console.log('\nOpen these URLs to review:');
  console.log('  http://localhost:8765/apps/index.html');
  console.log('  http://localhost:8765/agentic-services/index.html');
  console.log('  http://localhost:8765/compare/index.html');
  console.log('  http://localhost:8765/changelog/index.html');
  console.log('  http://localhost:8765/glossary/index.html');
  console.log('  http://localhost:8765/sitemap.xml');
  console.log('  http://localhost:8765/robots.txt');
  console.log('  http://localhost:8765/llms.txt');
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
  if (type === 'tool')               out = await buildToolPage(slug);
  else if (type === 'command')       out = await buildCommandPage(slug);
  else if (type === 'workflow')      out = await buildWorkflowPage(slug);
  else if (type === 'demo')          out = await buildDemoPage(slug);
  else if (type === 'app')           out = await buildAppPage(slug);
  else if (type === 'agentic')       out = await buildAgenticServicePage(slug);
  else throw new Error(`build not implemented for type "${type}"`);
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
  if (type === 'workflow') {
    // slug == name of the markdown file in data/source-skills/
    const md = await fsBuiltin.readFile(path.join(ROOT, 'data', 'source-skills', `${slug}.md`), 'utf8');
    return { slug, source_path: `BUILD MEP Plan/Skills/${slug}.md`, markdown: md };
  }
  if (type === 'demo') {
    const all = await loadJson('sandbox/data/demos.json');
    return all.demos.find(d => d.slug === slug);
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
