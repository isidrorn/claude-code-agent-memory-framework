#!/usr/bin/env node
// PostToolUse linter for memory files (global storage folder or any project's memory/ folder).
// Reads hook JSON on stdin; if the touched file is a memory .md, validates the whole folder and
// reports errors (schema violations -> block) or warnings (soft thresholds).
const fs = require('fs');
const path = require('path');
const { loadConfig } = require('../lib/config');
const { parseFrontmatter } = require('../lib/frontmatter');

// Non-memory files a memory folder may legitimately contain at its root.
const EXEMPT_FILES = new Set(['MEMORY.md', 'README.md']);
const VALID_TYPES = ['user', 'feedback', 'project', 'reference'];
const TAGS_RE = /^\[\s*([a-z0-9][a-z0-9.+-]*\s*(,\s*[a-z0-9][a-z0-9.+-]*\s*)*)?\]$/;

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

// Project memory folders are always named "memory"; the global folder is wherever storage points.
function isMemoryMarkdownFile(filePath, storageRoot) {
  if (!filePath || !filePath.toLowerCase().endsWith('.md')) return false;
  const dir = path.resolve(path.dirname(filePath));
  return path.basename(dir) === 'memory' || dir.toLowerCase() === storageRoot.toLowerCase();
}

function lintFolder(dir, config) {
  const errors = [];
  const warnings = [];

  let entries;
  try {
    entries = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.md'));
  } catch {
    return { errors, warnings };
  }

  const indexExists = entries.includes('MEMORY.md');
  const indexed = new Set();
  if (indexExists) {
    const lines = fs.readFileSync(path.join(dir, 'MEMORY.md'), 'utf8').split(/\r?\n/).filter((l) => l.trim().startsWith('- '));
    for (const line of lines) {
      if (line.length > config.maxIndexLineChars) {
        warnings.push(`MEMORY.md line exceeds ${config.maxIndexLineChars} chars: "${line.slice(0, 60)}..."`);
      }
      const linkMatch = line.match(/\(([^)]+\.md)\)/);
      if (!linkMatch) {
        warnings.push(`MEMORY.md line has no (file.md) link: "${line.slice(0, 60)}..."`);
        continue;
      }
      indexed.add(linkMatch[1]);
      if (!entries.includes(linkMatch[1])) {
        errors.push(`MEMORY.md references "${linkMatch[1]}" but that file doesn't exist in ${dir}`);
      }
    }
    if (lines.length > config.maxIndexLines) {
      warnings.push(`MEMORY.md has ${lines.length} entries (soft cap ${config.maxIndexLines}) — consider a compaction pass`);
    }
  }

  const namesInFolder = new Map();
  const bodies = new Map();

  for (const file of entries) {
    if (EXEMPT_FILES.has(file)) continue;
    const body = fs.readFileSync(path.join(dir, file), 'utf8');
    const fm = parseFrontmatter(body);
    if (!fm) {
      errors.push(`${file}: no valid YAML frontmatter block found (non-memory notes belong in a subfolder such as docs/)`);
      continue;
    }
    bodies.set(file, body);
    const meta = fm.metadata;

    if (!fm.name) errors.push(`${file}: frontmatter missing "name"`);
    if (!fm.description) errors.push(`${file}: frontmatter missing "description"`);
    if (!meta.type) errors.push(`${file}: frontmatter missing "metadata.type"`);
    else if (!VALID_TYPES.includes(meta.type)) errors.push(`${file}: metadata.type "${meta.type}" is not one of ${VALID_TYPES.join('/')}`);
    if (meta.status && meta.status !== 'archived') {
      errors.push(`${file}: metadata.status "${meta.status}" is not "archived" (only valid non-empty value)`);
    }
    if (meta.expires !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(meta.expires)) {
      errors.push(`${file}: metadata.expires must be a YYYY-MM-DD date, got "${meta.expires}"`);
    }
    if (meta.tags !== undefined && !TAGS_RE.test(meta.tags)) {
      errors.push(`${file}: metadata.tags must look like [maven, lombok, jdk] (lowercase, comma-separated), got "${meta.tags}"`);
    }

    const expectedName = file.replace(/\.md$/, '');
    if (fm.name && fm.name !== expectedName) {
      warnings.push(`${file}: frontmatter name "${fm.name}" doesn't match filename "${expectedName}"`);
    }
    if (fm.name) {
      if (namesInFolder.has(fm.name)) errors.push(`Duplicate name "${fm.name}" in both ${namesInFolder.get(fm.name)} and ${file}`);
      else namesInFolder.set(fm.name, file);
    }

    const lineCount = body.split(/\r?\n/).length;
    if (lineCount > config.maxFileLines) {
      warnings.push(`${file} has ${lineCount} lines (soft cap ${config.maxFileLines}) — consider splitting or trimming`);
    }

    if (indexExists) {
      const archived = meta.status === 'archived';
      if (archived && indexed.has(file)) warnings.push(`${file} is archived but still listed in MEMORY.md — drop its index line`);
      else if (!archived && !indexed.has(file)) errors.push(`${file} is active but not referenced in MEMORY.md — it will never be discovered via the index`);
    }
  }

  // [[name]] must resolve to a file in the SAME folder.
  for (const [file, body] of bodies) {
    for (const m of body.matchAll(/\[\[([^\]]+)\]\]/g)) {
      if (!namesInFolder.has(m[1])) {
        errors.push(`${file}: [[${m[1]}]] doesn't resolve to any file in ${dir} (cross-folder wikilinks aren't supported — use a plain-text pointer instead)`);
      }
    }
  }

  return { errors, warnings };
}

function main() {
  let input;
  try {
    input = JSON.parse(readStdin());
  } catch {
    return;
  }
  const cfg = loadConfig();
  const filePath = (input.tool_input && input.tool_input.file_path) || (input.tool_response && input.tool_response.filePath);
  if (!isMemoryMarkdownFile(filePath, cfg.storage.path)) return;

  const { errors, warnings } = lintFolder(path.dirname(filePath), cfg.lint);
  if (errors.length > 0) {
    const reason = ['Memory lint failed:', ...errors.map((e) => `- ${e}`), ...(warnings.length ? ['Also:', ...warnings.map((w) => `- ${w}`)] : [])].join('\n');
    console.log(JSON.stringify({ decision: 'block', reason }));
  } else if (warnings.length > 0) {
    console.log(JSON.stringify({ systemMessage: ['Memory lint warnings:', ...warnings.map((w) => `- ${w}`)].join('\n') }));
  }
}

if (require.main === module) main();
module.exports = { lintFolder, isMemoryMarkdownFile };
