/**
 * 模型输出（尤其是 DeepSeek）有时会把 GFM 表格挤在段落中间，
 * 前面没有空行，remark-gfm 就不会把它识别成表格，结果整段以 `|` 原样显示。
 * 这里做一次轻量修复：给表格块前后补齐空行，并把 `\r\n` 统一成 `\n`。
 */

const TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/;

function isTableRow(line: string): boolean {
  return /^\s*\|.*\|\s*$/.test(line);
}

export function normalizeMarkdownTables(markdown: string): string {
  if (!markdown || !markdown.includes('|')) return markdown;

  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1];

    // 表头行 + 分隔行 => 一个表格的开始
    if (isTableRow(line) && next !== undefined && TABLE_SEPARATOR.test(next)) {
      // 表格前必须是空行，否则 markdown 会把它并进上一段
      if (out.length > 0 && out[out.length - 1].trim() !== '') {
        out.push('');
      }
      out.push(line, next);
      i++;

      // 把表格后续的数据行一次性收进来
      while (i + 1 < lines.length && isTableRow(lines[i + 1])) {
        out.push(lines[++i]);
      }

      // 表格后补空行，避免后续内容被当成表格行
      if (i + 1 < lines.length && lines[i + 1].trim() !== '') {
        out.push('');
      }
      continue;
    }

    out.push(line);
  }

  return out.join('\n');
}
