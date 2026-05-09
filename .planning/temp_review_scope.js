const fs = require('fs');
const path = require('path');
const phaseDir = '.planning/phases/01-持久化与场景库';
const files = [];

const summaries = fs.readdirSync(phaseDir)
  .filter(f => f.endsWith('-SUMMARY.md'))
  .map(f => path.join(phaseDir, f));

for (const summary of summaries) {
  const content = fs.readFileSync(summary, 'utf-8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) continue;
  const yaml = match[1];
  let inSection = null;
  for (const line of yaml.split('\n')) {
    if (/^\s+created:/.test(line)) { inSection = 'created'; continue; }
    if (/^\s+modified:/.test(line)) { inSection = 'modified'; continue; }
    if (/^\s*\w+:/.test(line) && !/^\s*-/.test(line)) { inSection = null; continue; }
    if (inSection && /^\s+-\s+(.+)/.test(line)) {
      files.push(line.match(/^\s+-\s+(.+)/)[1].trim());
    }
  }
}

// Only keep paths that look like actual file paths
const filePaths = files.filter(f => f.includes('/'));

// Apply exclusions
const filtered = [];
for (const file of filePaths) {
  if (file.startsWith('.planning/') ||
      file === 'ROADMAP.md' ||
      file === 'STATE.md' ||
      file.endsWith('-SUMMARY.md') ||
      file.endsWith('-VERIFICATION.md') ||
      file.endsWith('-PLAN.md')) {
    continue;
  }
  filtered.push(file);
}

// Filter deleted files
const existing = [];
for (const file of filtered) {
  if (fs.existsSync(file)) {
    existing.push(file);
  }
}

// Deduplicate and sort
const deduped = [...new Set(existing)].sort();

console.log(JSON.stringify(deduped, null, 2));
console.log('\nTotal files:', deduped.length);
