const { readdir, readFile } = require('node:fs/promises');
const path = require('node:path');

const originPattern = /http:\/\/127\.0\.0\.1:(\d+)|carboniq\.project\.v1/g;

// Older releases chose a new port every launch. Chromium keeps localStorage
// under each origin; reuse the most recent origin that held a project.
async function findLegacyProjectPort(userDataPath) {
  const folder = path.join(userDataPath, 'Local Storage', 'leveldb');
  let files;
  try { files = await readdir(folder, { withFileTypes: true }); } catch { return null; }
  const candidates = [];
  for (const entry of files) {
    if (!entry.isFile() || !/\.(?:log|ldb|sst)$/i.test(entry.name)) continue;
    try {
      const file = await readFile(path.join(folder, entry.name));
      if (file.length > 50 * 1024 * 1024) continue;
      const content = file.toString('latin1');
      let match; let originPort = null;
      originPattern.lastIndex = 0;
      while ((match = originPattern.exec(content))) {
        if (match[1]) originPort = Number(match[1]);
        else if (originPort >= 1024 && originPort <= 65535) candidates.push({ name: entry.name, offset: match.index, port: originPort });
      }
    } catch { /* A live Chromium compaction may remove a file. */ }
  }
  candidates.sort((a, b) => a.name.localeCompare(b.name) || a.offset - b.offset);
  return candidates.at(-1)?.port || null;
}

module.exports = { findLegacyProjectPort };
