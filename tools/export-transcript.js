#!/usr/bin/env node
// One-off transcript exporter: reads a Claude Code session .jsonl and renders
// a readable plain-text transcript (dialogue, thinking, tool calls/results),
// dropping pure session bookkeeping (ai-title, mode, file-history-snapshot, etc).
const fs = require('fs');

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error('Usage: node export-transcript.js <input.jsonl> <output.txt>');
  process.exit(1);
}

const TRUNCATE_AT = 4000;
function truncate(s) {
  if (typeof s !== 'string') s = JSON.stringify(s, null, 2);
  return s.length > TRUNCATE_AT ? s.slice(0, TRUNCATE_AT) + `\n...[truncated, ${s.length - TRUNCATE_AT} more chars]...` : s;
}

const lines = fs.readFileSync(inputPath, 'utf8').split('\n').filter(Boolean);
const out = [];

for (const line of lines) {
  let obj;
  try { obj = JSON.parse(line); } catch { continue; }
  if (obj.type !== 'user' && obj.type !== 'assistant') continue;
  if (obj.isMeta) continue; // skip injected framing like the local-command-caveat wrapper

  const role = obj.type.toUpperCase();
  const ts = obj.timestamp || '';
  out.push(`\n${'='.repeat(80)}\n[${role}] ${ts}\n${'='.repeat(80)}`);

  const content = obj.message && obj.message.content;
  if (typeof content === 'string') {
    out.push(content);
  } else if (Array.isArray(content)) {
    for (const block of content) {
      if (block.type === 'text') {
        out.push(block.text);
      } else if (block.type === 'thinking') {
        out.push(`[thinking]\n${block.thinking || ''}`);
      } else if (block.type === 'tool_use') {
        out.push(`[tool call: ${block.name}]\n${truncate(block.input)}`);
      } else if (block.type === 'tool_result') {
        let resultText = block.content;
        if (Array.isArray(resultText)) {
          resultText = resultText.map((c) => (c.type === 'text' ? c.text : JSON.stringify(c))).join('\n');
        }
        out.push(`[tool result]\n${truncate(resultText)}`);
      } else if (block.type === 'image') {
        out.push('[image omitted]');
      } else {
        out.push(`[${block.type}]\n${truncate(block)}`);
      }
    }
  }
}

fs.writeFileSync(outputPath, out.join('\n\n'), 'utf8');
console.log(`Wrote ${out.length} blocks to ${outputPath}`);
