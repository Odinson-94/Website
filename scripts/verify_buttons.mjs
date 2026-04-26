/**
 * Compare button-row HTML between contact/index.html and dist/index.html.
 * Normalises indentation then compares character-for-character.
 */
import { readFileSync } from 'fs';

function extractButtonRow(lines, label) {
  const start = lines.findIndex(l => l.includes('class="button-row"') && l.includes('<div'));
  if (start < 0) {
    console.error(`FAIL: <div class="button-row"> not found in ${label}`);
    process.exit(1);
  }
  let depth = 0;
  const block = [];
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    block.push(line);
    const opens = (line.match(/<div[\s>]/g) || []).length;
    const closes = (line.match(/<\/div>/g) || []).length;
    depth += opens - closes;
    if (depth <= 0) break;
  }
  return block;
}

function normalize(lines) {
  return lines.map(l => l.trim()).filter(l => l.length > 0);
}

const contactLines = readFileSync('contact/index.html', 'utf8').split(/\r?\n/);
const distLines = readFileSync('dist/index.html', 'utf8').split(/\r?\n/);

const contactBlock = extractButtonRow(contactLines, 'contact/index.html');
const distBlock = extractButtonRow(distLines, 'dist/index.html');

const contactNorm = normalize(contactBlock);
const distNorm = normalize(distBlock);

let pass = true;
if (contactNorm.length !== distNorm.length) {
  pass = false;
} else {
  for (let i = 0; i < contactNorm.length; i++) {
    if (contactNorm[i] !== distNorm[i]) {
      pass = false;
      break;
    }
  }
}

if (pass) {
  console.log('PASS: button-row HTML matches between contact and dist (character-for-character after indent normalisation)');
  console.log(`  contact/index.html: ${contactBlock.length} raw lines`);
  console.log(`  dist/index.html:    ${distBlock.length} raw lines`);
  console.log(`  normalised lines:   ${contactNorm.length}`);
  contactNorm.forEach(l => console.log(`    ${l}`));
} else {
  console.log('FAIL: button-row HTML differs');
  const max = Math.max(contactNorm.length, distNorm.length);
  for (let i = 0; i < max; i++) {
    const c = i < contactNorm.length ? contactNorm[i] : '<missing>';
    const d = i < distNorm.length ? distNorm[i] : '<missing>';
    const flag = c === d ? '  ' : '!!';
    console.log(`  ${flag} contact: ${c}`);
    console.log(`  ${flag} dist:    ${d}`);
  }
  process.exit(1);
}
