/**
 * scripts/lib/backup.mjs
 *
 * Timestamped file backup before overwrites.
 *
 * Every build script calls `backupBeforeWrite(targetPath)` before
 * writing. If the file already exists on disk, it's copied to
 *   _backup/<YYYY-MM-DD_HHmm>/<relative-path>
 *
 * The timestamp folder is shared across a single CLI run so one
 * `auto-all` produces exactly one backup snapshot.
 *
 * Set  SKIP_BACKUP=1  to disable (e.g. in CI where backups waste space).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './registry.mjs';

const BACKUP_ROOT = path.join(ROOT, '_backup');

let _stamp = null;
function stamp() {
  if (_stamp) return _stamp;
  const d = new Date();
  _stamp = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
    '_',
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
  ].join('');
  return _stamp;
}

async function fileExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

/**
 * Copy `targetPath` into _backup/<stamp>/<relative> if it exists.
 * Safe to call multiple times for the same file — only the first
 * copy in this session wins (subsequent calls are no-ops).
 */
const _backed = new Set();

export async function backupBeforeWrite(targetPath) {
  if (process.env.SKIP_BACKUP === '1') return;

  const abs = path.resolve(targetPath);
  if (_backed.has(abs)) return;

  if (!(await fileExists(abs))) return;

  const rel = path.relative(ROOT, abs);
  const dest = path.join(BACKUP_ROOT, stamp(), rel);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(abs, dest);
  _backed.add(abs);
}

/**
 * Drop-in replacement for `fs.writeFile` that backs up first.
 *
 *   import { safeWriteFile } from './lib/backup.mjs';
 *   await safeWriteFile(outPath, html, 'utf8');
 */
export async function safeWriteFile(filePath, data, encoding = 'utf8') {
  await backupBeforeWrite(filePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, data, encoding);
}
