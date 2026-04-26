/**
 * scripts/lib/drafter.mjs
 *
 * The LLM-augmentation step.
 *
 * MODES
 *   • If process.env.ANTHROPIC_API_KEY is set → calls Claude Opus
 *     (claude-opus-4-20251010, temperature 0). Output is real LLM output.
 *   • Else → uses a deterministic STUB that mimics the LLM's output by
 *     mechanically transforming the source data through the same shape
 *     the LLM would produce. Lets the dry run work without API setup.
 *
 * Both modes return YAML matching the page-type schema.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, toYaml } from './registry.mjs';

const SKILL_DIR = path.join(ROOT, 'BUILD WEB Plan', 'Page Type Skills');

export async function draft({ pageType, sourceData, sourceSha = 'dryrun' }) {
  const skillFolder = pageTypeToSkillFolder(pageType);
  const useReal = !!process.env.ANTHROPIC_API_KEY;

  const meta = {
    page_type: pageType,
    skill_folder: skillFolder,
    mode: useReal ? 'claude-opus-4-20251010' : 'stub',
    generated_at: new Date().toISOString(),
    source_sha: sourceSha,
  };

  let yamlObj;
  if (useReal) {
    yamlObj = await draftWithClaude({ skillFolder, sourceData, meta });
  } else {
    yamlObj = await draftWithStub({ pageType, sourceData, meta });
  }

  // Stamp metadata
  yamlObj.generated_by = useReal ? 'claude-opus-4-20251010' : 'stub-deterministic-v1';
  yamlObj.generated_at = meta.generated_at;
  yamlObj.source_sha   = sourceSha;

  return { yaml: toYaml(yamlObj), object: yamlObj, meta };
}

function pageTypeToSkillFolder(pageType) {
  const map = {
    tool:     'Tool Page',
    command:  'Command Page',
    workflow: 'Workflow Page',
    demo:     'Demo Page',
    pillar:   'Pillar Page',
    bridge:   'Bridge Page',
  };
  return path.join(SKILL_DIR, map[pageType] || 'Tool Page');
}

/* ---------------------------------------------------------------- *
 *  STUB MODE — deterministic transformation
 *  Same source → same YAML, byte-for-byte.
 * ---------------------------------------------------------------- */
async function draftWithStub({ pageType, sourceData }) {
  if (pageType === 'tool')     return stubToolPage(sourceData);
  if (pageType === 'command')  return stubCommandPage(sourceData);
  if (pageType === 'workflow') return stubWorkflowPage(sourceData);
  if (pageType === 'demo')     return stubDemoPage(sourceData);
  throw new Error(`Stub draft not implemented for page type "${pageType}". ` +
                  'Set ANTHROPIC_API_KEY to use real Claude Opus instead.');
}

/* ---------------- Workflow stub: parses a MEP Bridge skill markdown ----------------
   The skill has a YAML frontmatter (name, description) and a series of
   `## Scenario N: <title>` sections. Each scenario becomes one phase.
   Tools mentioned in the scenario body are extracted via regex match
   against snake_case identifiers we recognise as MCP tool names.
*/
function stubWorkflowPage(skill) {
  const text = skill.markdown || '';
  // YAML frontmatter
  let name = skill.slug || 'workflow';
  let description = '';
  const fm = text.match(/^---\s*\n([\s\S]+?)\n---/);
  if (fm) {
    const m1 = fm[1].match(/name:\s*(.+)/);     if (m1) name = m1[1].trim();
    const m2 = fm[1].match(/description:\s*"?([^"\n]+)/); if (m2) description = m2[1].trim();
  }

  // H1 title
  const h1 = text.match(/^#\s+(.+)$/m);
  const title = h1 ? h1[1].replace(/[—–-]\s*AI.*$/, '').trim() : sentenceCase(name);

  // Prerequisites (bulleted list under ## Prerequisites)
  const preqM = text.match(/##\s+Prerequisites\s*\n([\s\S]*?)(?=\n---|\n##\s+)/);
  const prerequisites = preqM
    ? [...preqM[1].matchAll(/^-\s*\[\s*\]\s*(.+)$/gm)].map(m => m[1].trim()).slice(0, 6)
    : [];

  // How it flows — narrative paragraphs under ## How it flows
  const flowM = text.match(/##\s+How it flows\s*\n([\s\S]*?)(?=\n---|\n##\s+|$)/);
  const how_it_flows = flowM
    ? flowM[1].trim()
        .split(/\n{2,}/)
        .map(p => p.trim())
        .filter(p => p.length > 20 && !p.startsWith('-') && !p.startsWith('|'))
        .slice(0, 6)
    : [];

  // Settings & options — table rows under ## Settings & options or ## Settings
  // Allow the section to be the LAST one in the file (no trailing ---/##)
  const setM = text.match(/##\s+Settings(?:\s*&\s*options)?\s*\n([\s\S]*?)(?=\n---|\n##\s+|$)/i);
  let settings = [];
  if (setM) {
    const tableRows = [...setM[1].matchAll(/^\|\s*\*\*([^|*]+)\*\*\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/gm)];
    settings = tableRows.map(m => ({
      option: m[1].trim(),
      default: m[2].trim(),
      description: m[3].trim(),
    }));
  }

  // Scenarios — split on H2 headings, then keep ones starting with "Scenario N:"
  const scenarioBlocks = [];
  const sections = text.split(/^##\s+/m).slice(1); // first chunk is preamble
  for (const sec of sections) {
    const m = sec.match(/^Scenario\s+\d+[:\.]?\s+(.+)/);
    if (!m) continue;
    const title = m[1].trim();
    // Body = everything after the first newline, trim trailing --- separator
    const nl = sec.indexOf('\n');
    let body = nl >= 0 ? sec.slice(nl + 1) : '';
    body = body.replace(/\n---\s*\n?[\s\S]*$/, '').trim();
    scenarioBlocks.push({ title, body });
  }

  const phases = scenarioBlocks.map(s => parseScenario(s));

  return {
    slug: name,
    title,
    lead: description,
    category_label: 'Workflow',
    source_skill: skill.source_path || `${name}.md`,
    prerequisites,
    how_it_flows,
    settings,
    phases,
  };
}

function parseScenario(s) {
  // Trigger sentence
  const triggerM = s.body.match(/###\s+When this triggers\s*\n+([^\n#]+)/i);
  const trigger = triggerM ? triggerM[1].trim() : '';

  // Find the ```...``` step-by-step code block (back-tick fenced)
  // JS regex: triple backtick is just three literal backticks
  const codeM = s.body.match(/```[\s\S]*?\n([\s\S]*?)```/);
  const code = codeM ? codeM[1] : '';

  // Parse the code block into steps. Steps look like:
  //   1. STEP TITLE
  //      → tool_or_command_call
  //      → Returns: ...
  //      → "agent quote"
  //      → User: "user prompt"
  // Some steps are 3A. / 3B. / 3C. (sub-options).
  const stepBlocks = code.split(/\n(?=\d+[A-Z]?\.\s)/);
  const steps = stepBlocks.map(blk => {
    // Strip CR before parsing (file may have Windows line endings)
    const cleaned = blk.replace(/\r/g, '');
    const titleM = cleaned.match(/^(\d+[A-Z]?)\.\s+(.+?)$/m);
    if (!titleM) return null;
    const num = titleM[1];
    const title = sentenceCase(titleM[2].trim().replace(/:$/, ''));

    // Pull tool / command identifiers from the arrow lines
    const calls = new Set();
    const arrowLines = [...cleaned.matchAll(/→\s*(.+)/g)].map(m => m[1].trim());
    arrowLines.forEach(line => {
      // snake_case_tool_name (must contain underscore, lowercase start)
      [...line.matchAll(/\b([a-z][a-z0-9_]{2,}_[a-z0-9_]+)\b/g)].forEach(m => calls.add(m[1]));
      // PascalCase commands followed by ( or .
      [...line.matchAll(/\b([A-Z][a-zA-Z0-9]+(?:Command|Tool)?)\s*[(.]/g)]
        .filter(m => m[1].length > 4 && !['Returns','Summarise','User','IF','HAS','API','MEP','OST','PDF','BIM'].includes(m[1]))
        .forEach(m => calls.add(m[1]));
      // execute_command: SomethingCommand
      const exM = line.match(/execute_command:\s*(\w+)/);
      if (exM) calls.add(exM[1]);
    });

    // Quoted strings → agent quotes (multi-line strings allowed)
    const quotes = [...cleaned.matchAll(/→\s*"([\s\S]{8,}?)"/g)].map(m => m[1].replace(/\s+/g, ' ').trim()).slice(0, 3);

    // User prompts: lines containing → User: "..."
    const userPrompts = [...cleaned.matchAll(/→\s*User:\s*"([^"]+)"/gi)].map(m => m[1]);

    // Conditional branches (IF ... / 3A. / 3B. — surface them as plain text bullets)
    const conditions = [...cleaned.matchAll(/(?:^|\n)\s*(?:IF|ELSE|WHEN)\s+([^\n:]+):/g)]
      .map(m => m[1].trim()).slice(0, 3);

    return {
      num,
      title,
      tools_called:  [...calls].slice(0, 6),
      agent_quote:   quotes[0] || '',
      user_prompt:   userPrompts[0] || '',
      conditions,
    };
  }).filter(Boolean);

  return {
    title:         s.title,
    when_triggers: trigger,
    steps,
  };
}

/* ---------------- Demo stub: thin overlay onto existing demos.json row ---------------- */
function stubDemoPage(d) {
  return {
    slug: d.slug,
    title: d.title,
    desc:  d.desc,
    duration: d.duration || '—',
    category: d.category,
    steps: [
      `Open the chat panel and ask "${d.title.toLowerCase()}"`,
      `BUILD MEP previews what it's about to do, then runs it against the active model`,
      `Review the result inline; commit, undo, or refine with a follow-up prompt`,
    ],
  };
}

function stubToolPage(t) {
  const bridgeMap = {
    RevitContext:    'Revit',
    DrawingExporter: 'Drawing exporter',
    ParameterEditor: 'Parameter editor',
    SelfDebug:       'Debug',
    Snapshot:        'Snapshot',
  };
  const display = sentenceCase(t.name.replace(/_/g, ' '));

  // Build a sample-response shape from the tool's name (deterministic heuristic)
  const what = inferReturnShape(t);

  // Example prompts: prefer keywords-derived natural prompts, fall back to verb-noun
  const prompts = (t.keywords && t.keywords.length >= 3)
    ? t.keywords.slice(0, 3).map(k => sentenceCase(k))
    : pickPrompts(t);

  const out = {
    slug: t.name,
    title: t.name,
    display_title: display,
    description: t.desc || '',
    category_label: t.category,
    always_available: !!t.always,
    what_it_returns: what,
    example_prompts: prompts,
    related: {
      tools: deriveRelated(t),
      skills: deriveSkills(t),
      demos: [],
    },
  };
  if (t.bridge && bridgeMap[t.bridge]) out.bridge_label = bridgeMap[t.bridge];

  // Order keys to match schema convention
  const ordered = {};
  for (const k of ['slug','title','display_title','description','bridge_label',
                   'category_label','always_available','what_it_returns',
                   'example_prompts','related']) {
    if (k in out) ordered[k] = out[k];
  }
  return ordered;
}

function inferReturnShape(t) {
  if (!t.name) return '';
  if (t.name.startsWith('list_')) {
    const noun = t.name.slice(5);
    return `Array of ${noun} objects.\nEach row carries id, name, and the key properties of a ${noun.replace(/s$/,'')}.\nEmpty array when no ${noun} match the filter.`;
  }
  if (t.name.startsWith('get_')) {
    return 'Object with the queried fields. Null if the target doesn\'t exist.';
  }
  if (t.name.startsWith('count_')) return 'Integer.';
  return '';
}

function deriveSkills(t) {
  // Heuristic: keyword overlap with known skill slugs
  const skillKeywords = {
    'schedules':           ['schedule','schedules'],
    'filters-and-templates': ['filter','filters','template','templates'],
    'routing-preferences': ['routing','pipe','duct','fitting'],
    'coordination':        ['clash','coordination','linked'],
    'parameters':          ['parameter','parameters','property'],
  };
  const kws = (t.keywords || []).map(k => k.toLowerCase()).join(' ');
  return Object.entries(skillKeywords)
    .filter(([_, words]) => words.some(w => kws.includes(w)))
    .slice(0, 3)
    .map(([slug]) => slug);
}

function stubCommandPage(c) {
  // Minimal command page stub for the dry run path
  const display = c.command_display || c.class.replace(/Command$/, '');
  return {
    slug: slugify(display),
    class_display: display,
    title: display,
    pillar: prettyPillar(c.pillar || ''),
    pillar_slug: slugify(c.pillar || 'general'),
    status_pills: [
      { label: 'writes to model', kind: 'category' },
      { label: c.has_restapi ? 'Public API' : 'Public API · not yet exposed', kind: c.has_restapi ? 'live' : 'coming' },
    ],
    lead: c.desc || c.usecase || '',
    before_you_run: c.precondition || '',
    after_it_runs:  c.postcondition || '',
    side_effects:   c.sideeffects || '',
    dont_use_when:  c.notfor || '',
    when_to_use: (c.usecase || '').split(/(?<=[.!?])\s+/).slice(0, 5).filter(Boolean),
    keywords_pills: (c.keywords || []).slice(0, 6),
  };
}

function sentenceCase(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function prettyPillar(s) {
  if (!s) return 'General';
  return s.replace(/([A-Z])/g, ' $1').trim();
}
function pickPrompts(t) {
  // 3 deterministic prompts derived from name + first keywords
  const verb = t.name.split('_')[0];
  const tail = t.name.split('_').slice(1).join(' ') || 'data';
  const samples = [
    `${verb.charAt(0).toUpperCase() + verb.slice(1)} ${tail}`,
    `Show ${tail}`,
    `What ${tail} are in this model?`,
  ];
  return samples;
}
function deriveRelated(t) {
  // For stub: just a couple of related tools by keyword overlap (unknown here)
  return [];
}

/* ---------------------------------------------------------------- *
 *  CLAUDE MODE
 *  Uses fetch (Node 18+) to call the Anthropic API directly so we don't
 *  need to add the @anthropic-ai/sdk dependency.
 * ---------------------------------------------------------------- */
async function draftWithClaude({ skillFolder, sourceData, meta }) {
  const skillPath  = path.join(skillFolder, 'SKILL.md');
  const referencesIndex = path.join(skillFolder, 'references.md');
  const refsDir    = path.join(skillFolder, 'references');
  const examplesDir= path.join(skillFolder, 'examples');
  const gotchas    = path.join(skillFolder, 'gotchas.md');
  const targetCss  = path.join(skillFolder, 'target-css.md');
  const schema     = path.join(skillFolder, 'schema.json');

  const [skill, refsToc, refs, examples, gotchasTxt, cssTxt, schemaTxt] = await Promise.all([
    fs.readFile(skillPath,        'utf8').catch(() => ''),
    fs.readFile(referencesIndex,  'utf8').catch(() => ''),
    readAll(refsDir),
    readAll(examplesDir),
    fs.readFile(gotchas,          'utf8').catch(() => ''),
    fs.readFile(targetCss,        'utf8').catch(() => ''),
    fs.readFile(schema,           'utf8').catch(() => ''),
  ]);

  const system = [
    skill,
    '\n\n--- references.md ---\n', refsToc,
    '\n\n--- references/ ---\n', refs,
    '\n\n--- gotchas.md ---\n', gotchasTxt,
    '\n\n--- target-css.md ---\n', cssTxt,
    '\n\n--- examples/ (each is a complete, approved YAML) ---\n', examples,
    '\n\n--- schema.json (output MUST validate) ---\n', schemaTxt,
  ].join('');

  const user = [
    'Generate the YAML for this source data. Output YAML only — no prose, no fences.',
    '',
    '```json',
    JSON.stringify(sourceData, null, 2),
    '```',
  ].join('\n');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-20251010',
      max_tokens: 4096,
      temperature: 0,
      top_p: 1,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Claude API error ${res.status}: ${txt}`);
  }
  const data = await res.json();
  const yamlText = data.content?.[0]?.text || '';
  const { parseSimpleYaml } = await import('./registry.mjs');
  return parseSimpleYaml(yamlText);
}

async function readAll(dir) {
  try {
    const files = (await fs.readdir(dir)).sort();
    const parts = [];
    for (const f of files) {
      const p = path.join(dir, f);
      const stat = await fs.stat(p);
      if (stat.isFile()) {
        parts.push(`\n=== ${f} ===\n` + (await fs.readFile(p, 'utf8')));
      }
    }
    return parts.join('\n');
  } catch { return ''; }
}
