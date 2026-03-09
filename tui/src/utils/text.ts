import stringWidth from "string-width";
import { decode } from "entities";
import { Marked } from "marked";
import { markedTerminal } from "marked-terminal";

const HTML_TAG_RE = /<\/?[a-z][a-z0-9-]*(?:\s[^>]*)?>/i;

export function visualTruncate(
  str: string,
  width: number,
  ellipsis: boolean = false
): string {
  const normalized = str.replace(/\s+/g, " ").trim();
  const fullWidth = stringWidth(normalized);
  if (fullWidth <= width)
    return normalized + " ".repeat(width - fullWidth);

  const targetWidth = ellipsis ? Math.max(0, width - 3) : width;
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  let result = "",
    w = 0;
  for (const { segment } of segmenter.segment(normalized)) {
    const sw = stringWidth(segment);
    if (w + sw > targetWidth) break;
    result += segment;
    w += sw;
  }

  if (ellipsis && fullWidth > width) {
    result += "...";
    w += 3;
  }

  return result + " ".repeat(Math.max(0, width - w));
}

export function cleanContent(html: string | undefined): string {
  if (!html) return "No content available.";

  // Simple plain-text cleanup: remove tags, decode entities, normalize newlines
  return decode(html.replace(/<[^>]*>?/gm, ""))
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n\n");
}

export function renderMarkdown(
  content: string | undefined,
  width: number = 80
): string {
  if (!content) return "No content available.";

  if (HTML_TAG_RE.test(content)) {
    return cleanContent(content);
  }

  try {
    const markedInstance = new Marked();
    markedInstance.use(
      markedTerminal({
        reflowText: true,
        width,
      }) as any
    );
    return markedInstance.parse(content) as string;
  } catch {
    return cleanContent(content);
  }
}

export function terminalLink(text: string, url: string): string {
  // OSC 8 hyperlink sequence
  return `\u001b]8;;${url}\u001b\\${text}\u001b]8;;\u001b\\`;
}
