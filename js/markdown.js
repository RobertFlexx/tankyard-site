// Release notes come from GitHub as Markdown. This renders the small part of
// Markdown they use, escaping everything first so nothing in them becomes HTML.

const escape = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(text) {
  const codes = [];
  let out = escape(text).replace(/`([^`]+)`/g, (_, code) => {
    codes.push(code);
    return `\u0000${codes.length - 1}\u0000`;
  });
  out = out
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|#[\w-]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/(^|[\s(])_([^_\s][^_]*)_/g, "$1<em>$2</em>");
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
}

export function renderMarkdown(source) {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const html = [];
  let list = null;
  let paragraph = [];
  let fence = null;
  const flush = () => {
    if (paragraph.length) html.push(`<p>${inline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (list) html.push(`</${list}>`);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (fence !== null) {
      if (/^(```|~~~)/.test(line)) {
        html.push(`<pre class="code">${escape(fence.join("\n"))}</pre>`);
        fence = null;
      } else fence.push(raw);
      continue;
    }
    if (/^(```|~~~)/.test(line)) {
      flush();
      closeList();
      fence = [];
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    const item = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      closeList();
      const level = Math.min(heading[1].length, 3);
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
    } else if (item || numbered) {
      flush();
      const kind = item ? "ul" : "ol";
      if (list !== kind) {
        closeList();
        html.push(`<${kind}>`);
        list = kind;
      }
      html.push(`<li>${inline((item || numbered)[1])}</li>`);
    } else if (!line.trim()) {
      flush();
      closeList();
    } else if (list && /^\s{2,}/.test(raw)) {
      html[html.length - 1] = html[html.length - 1].replace(/<\/li>$/, ` ${inline(line.trim())}</li>`);
    } else {
      closeList();
      paragraph.push(line.trim());
    }
  }
  flush();
  closeList();
  if (fence) html.push(`<pre class="code">${escape(fence.join("\n"))}</pre>`);
  return html.join("\n");
}
