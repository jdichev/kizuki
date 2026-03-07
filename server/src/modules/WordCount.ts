type CountWordLikeTokensOptions = {
  stripHtml?: boolean;
};

const normalizeForWordCount = (
  content: string,
  options: CountWordLikeTokensOptions = {}
) => {
  let normalized = content || "";

  if (options.stripHtml) {
    normalized = normalized.replace(/<[^>]*>/g, " ");
  }

  return normalized.replace(/\s+/g, " ").trim();
};

export const countWordLikeTokens = (
  content: string,
  options: CountWordLikeTokensOptions = {}
): number => {
  const normalized = normalizeForWordCount(content, options);
  if (!normalized) {
    return 0;
  }

  // Forest targets modern runtimes, so we rely on Intl.Segmenter.
  const Segmenter = (Intl as any).Segmenter;
  const segmenter = new Segmenter("und", { granularity: "word" });
  const segments = segmenter.segment(normalized) as Iterable<any>;

  let count = 0;
  for (const segment of segments) {
    if (segment?.isWordLike) {
      count += 1;
    }
  }

  return count;
};
