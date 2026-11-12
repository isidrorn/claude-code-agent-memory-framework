// Minimal, tolerant frontmatter parser for our controlled schema:
// top-level "key: value" lines plus one nested "metadata:" block with indented "key: value" children.
// Good enough for files we author ourselves; not a general YAML parser.
function parseFrontmatter(body) {
  const match = body.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const result = { metadata: {} };
  let inMetadata = false;
  for (const line of match[1].split(/\r?\n/)) {
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

module.exports = { parseFrontmatter };
