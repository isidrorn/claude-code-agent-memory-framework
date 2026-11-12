// Minimal, tolerant frontmatter parser for our controlled schema:
// top-level "key: value" lines plus one nested "metadata:" block with indented "key: value" children.
// Good enough for files we author ourselves; not a general YAML parser.
function parseFrontmatter(body) {
  const match = body.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const result = { metadata: {} };
  let inMetadata = false;
  let list = null; // { key, items } while reading a "key:" followed by "- item" lines
  for (const line of match[1].split(/\r?\n/)) {
    if (/^metadata:\s*$/.test(line)) {
      inMetadata = true;
      continue;
    }
    const nested = line.match(/^\s{2,}([A-Za-z_]+):\s*(.*)$/);
    const top = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    const item = line.match(/^\s{2,}-\s*(.*)$/);
    // Claude Code's memory writer rewrites "tags: [a, b]" as a YAML block list; fold it back to flow form.
    if (list && item) {
      list.items.push(item[1].replace(/^"(.*)"$/, '$1').trim());
      result.metadata[list.key] = `[${list.items.join(', ')}]`;
    } else if (inMetadata && nested) {
      const value = nested[2].replace(/^"(.*)"$/, '$1').trim();
      list = value === '' ? { key: nested[1], items: [] } : null;
      result.metadata[nested[1]] = value;
    } else if (top) {
      inMetadata = false;
      list = null;
      result[top[1]] = top[2].replace(/^"(.*)"$/, '$1').trim();
    }
  }
  return result;
}

module.exports = { parseFrontmatter };
