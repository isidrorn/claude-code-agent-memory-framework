#!/usr/bin/env node
// PostToolUse linter for memory files (project or global memory/ folders).
// Reads hook JSON on stdin, checks whether the touched file lives in a
// "memory" folder and ends in .md; if so, validates the whole folder and
// reports errors (schema violations -> block) or warnings (soft thresholds).

const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG = {
  maxIndexLines: 20,
  maxFileLines: 100,
  maxIndexLineChars: 150,
};

// Well-known non-schema files a memory folder may legitimately contain
// (e.g. a repo README once the folder is under git) — exempt from the
// frontmatter/type/index requirements that apply to actual memory files.
const EXEMPT_FILES = new Set(['MEMORY.md', 'README.md']);

function loadConfig() {
  const configPath = path.join(require('os').homedir(), '.claude', 'memory-lint.config.json');
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return { ...DEFAULT_CONFIG, ...raw };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function isMemoryMarkdownFile(filePath) {
  if (!filePath || !filePath.toLowerCase().endsWith('.md')) return false;
  const dir = path.basename(path.dirname(filePath));
  return dir === 'memory';
}

// Minimal, tolerant frontmatter parser for our controlled schema:
// top-level "key: value" lines plus one nested "metadata:" block with
// 2-space-indented "key: value" children. Good enough for files we author
// ourselves; not a general YAML parser.
function parseFrontmatter(body) {
  const match = body.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const lines = match[1].split(/\r?\n/);
  const result = { metadata: {} };
  let inMetadata = false;
  for (const line of lines) {
    if (/^metadata:\s*$/.test(line)) {
      inMetadata = true;
      continue;
    }
    const nested = line.match(/^\s{2,}([A-Za-z_]+):\s*(.*)$/);
    const top = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (inMetadata && nested) {
      result.metadata[nested[1]] = nested[2].replace(/^"(.*)"$/, '$1').trim();
    } else if (top) {
      inMetadata = false;
      result[top[1]] = top[2].replace(/^"(.*)"$/, '$1').trim();
    }
  }
  return result;
}

function lintFolder(dir) {
  const config = loadConfig();
  const errors = [];
  const warnings = [];

  let entries;
  try {
    entries = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.md'));
  } catch {
    return { errors, warnings };
  }

  const indexPath = path.join(dir, 'MEMORY.md');
  const indexExists = entries.includes('MEMORY.md');
  const indexed = new Set(); // filenames referenced by MEMORY.md
  let indexLineCount = 0;

  if (indexExists) {
    const indexBody = fs.readFileSync(indexPath, 'utf8');
    const lines = indexBody.split(/\r?\n/).filter((l) => l.trim().length > 0);
    indexLineCount = lines.filter((l) => l.trim().startsWith('- ')).length;
    for (const line of lines) {
      if (!line.trim().startsWith('- ')) continue;
      if (line.length > config.maxIndexLineChars) {
        warnings.push(`MEMORY.md line exceeds ${config.maxIndexLineChars} chars: "${line.slice(0, 60)}..."`);
      }
      const linkMatch = line.match(/\(([^)]+\.md)\)/);
      if (!linkMatch) {
        warnings.push(`MEMORY.md line has no (file.md) link: "${line.slice(0, 60)}..."`);
        continue;
      }
      const target = linkMatch[1];
      indexed.add(target);
      if (!entries.includes(target)) {
        errors.push(`MEMORY.md references "${target}" but that file doesn't exist in ${dir}`);
      }
    }
    if (indexLineCount > config.maxIndexLines) {
      warnings.push(`MEMORY.md has ${indexLineCount} entries (soft cap ${config.maxIndexLines}) — consider a compaction pass`);
    }
  }

  const namesInFolder = new Map(); // name -> filename
  const parsedByFile = new Map();

  for (const file of entries) {
    if (EXEMPT_FILES.has(file)) continue;
    const filePath = path.join(dir, file);
    const body = fs.readFileSync(filePath, 'utf8');
    const fm = parseFrontmatter(body);
    if (!fm) {
      errors.push(`${file}: no valid YAML frontmatter block found`);
      continue;
    }
    parsedByFile.set(file, { fm, body });

    if (!fm.name) errors.push(`${file}: frontmatter missing "name"`);
    if (!fm.description) errors.push(`${file}: frontmatter missing "description"`);
    const type = fm.metadata && fm.metadata.type;
    const validTypes = ['user', 'feedback', 'project', 'reference'];
    if (!type) {
      errors.push(`${file}: frontmatter missing "metadata.type"`);
    } else if (!validTypes.includes(type)) {
      errors.push(`${file}: metadata.type "${type}" is not one of ${validTypes.join('/')}`);
    }
    const status = fm.metadata && fm.metadata.status;
    if (status && status !== 'archived') {
      errors.push(`${file}: metadata.status "${status}" is not "archived" (only valid non-empty value)`);
    }

    const expectedName = file.replace(/\.md$/, '');
    if (fm.name && fm.name !== expectedName) {
      warnings.push(`${file}: frontmatter name "${fm.name}" doesn't match filename "${expectedName}"`);
    }
    if (fm.name) {
      if (namesInFolder.has(fm.name)) {
        errors.push(`Duplicate name "${fm.name}" in both ${namesInFolder.get(fm.name)} and ${file}`);
      } else {
        namesInFolder.set(fm.name, file);
      }
    }

    const lineCount = body.split(/\r?\n/).length;
    if (lineCount > config.maxFileLines) {
      warnings.push(`${file} has ${lineCount} lines (soft cap ${config.maxFileLines}) — consider splitting or trimming`);
    }

    if (indexExists) {
      const isArchived = status === 'archived';
      if (isArchived && indexed.has(file)) {
        warnings.push(`${file} is archived but still listed in MEMORY.md — drop its index line`);
      } else if (!isArchived && !indexed.has(file)) {
        errors.push(`${file} is active but not referenced in MEMORY.md — it will never be discovered via the index`);
      }
    }
  }

  // Wikilink resolution: [[name]] must resolve to a file in the SAME folder.
  for (const [file, { body }] of parsedByFile) {
    const links = body.matchAll(/\[\[([^\]]+)\]\]/g);
    for (const m of links) {
      const target = m[1];
      if (!namesInFolder.has(target)) {
        errors.push(`${file}: [[${target}]] doesn't resolve to any file in ${dir} (cross-folder wikilinks aren't supported — use a plain-text pointer instead)`);
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
    process.exit(0);
  }

  const filePath = (input.tool_input && input.tool_input.file_path) || (input.tool_response && input.tool_response.filePath);
  if (!isMemoryMarkdownFile(filePath)) {
    process.exit(0);
  }

  const dir = path.dirname(filePath);
  const { errors, warnings } = lintFolder(dir);

  if (errors.length > 0) {
    const reason = ['Memory lint failed:', ...errors.map((e) => `- ${e}`), ...(warnings.length ? ['Also:', ...warnings.map((w) => `- ${w}`)] : [])].join('\n');
    console.log(JSON.stringify({ decision: 'block', reason }));
  } else if (warnings.length > 0) {
    const msg = ['Memory lint warnings:', ...warnings.map((w) => `- ${w}`)].join('\n');
    console.log(JSON.stringify({ systemMessage: msg }));
  }
  process.exit(0);
}

main();
