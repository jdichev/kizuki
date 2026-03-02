import stringWidth from "string-width";
import { decode } from "entities";

export function visualTruncate(str: string, width: number): string {
  if (stringWidth(str) <= width) return str + " ".repeat(width - stringWidth(str));
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  let result = "",
    w = 0;
  for (const { segment } of segmenter.segment(
    str.replace(/\s+/g, " ").trim()
  )) {
    const sw = stringWidth(segment);
    if (w + sw > width) break;
    result += segment;
    w += sw;
  }
  return result + " ".repeat(Math.max(0, width - w));
}

export function cleanContent(
  html: string | undefined,
  isMarkdown: boolean = false
): string {
  if (!html) return "No content available.";
  if (isMarkdown) return html;
  return decode(html.replace(/<[^>]*>?/gm, ""))
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n\n");
}
