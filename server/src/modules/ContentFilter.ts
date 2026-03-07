import { countWordLikeTokens } from "./WordCount";

export function shouldFetchLatestContent(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Social networks
    const socialDomains = [
      "twitter.com",
      "x.com",
      "facebook.com",
      "instagram.com",
      "linkedin.com",
      "tiktok.com",
      "reddit.com",
      "threads.net",
      "mastodon.social",
      "bsky.app",
      "tumblr.com",
      "pinterest.com",
      "snapchat.com",
    ];

    // Known bot-blocking or hard pay-walled sites
    const blockerDomains = [
      "news.yahoo.com",
      "finance.yahoo.com",
      "yahoo.com",
      "wsj.com",
      "ft.com",
      "economist.com",
      "nytimes.com",
      "bloomberg.com",
      "barrons.com",
      "businessinsider.com",
      "wired.com",
      "theatlantic.com",
      "newyorker.com",
      "washingtonpost.com",
      "latimes.com",
      "chicagotribune.com",
      "quora.com",
    ];

    if (
      socialDomains.some((d) => hostname === d || hostname.endsWith("." + d))
    ) {
      return false;
    }

    if (
      blockerDomains.some((d) => hostname === d || hostname.endsWith("." + d))
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function isBetterContent(
  newContent: string,
  oldContent: string | null
): boolean {
  if (!newContent || newContent.trim().length === 0) {
    return false;
  }

  // Error messages typically returned by some scrapers or readability failures
  const errorPatterns = [
    "failed to extract",
    "request timeout",
    "invalid content type",
    "disallowed by robots.txt",
    "no content available",
    "enable javascript",
    "access denied",
    "403 forbidden",
    "cloudflare",
  ];

  const lowerContent = newContent.toLowerCase();
  if (errorPatterns.some((p) => lowerContent.includes(p))) {
    return false;
  }

  if (!oldContent || oldContent.trim().length === 0) {
    return true;
  }

  const newWordCount = countWordLikeTokens(newContent);
  const oldWordCount = countWordLikeTokens(oldContent);

  // Significant improvement if it's longer
  // If old content was very short (e.g. just a summary), and new one is much longer, it's better.
  return newWordCount > oldWordCount;
}
