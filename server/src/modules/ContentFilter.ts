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
    ];

    // Video platforms
    const videoDomains = ["youtube.com", "youtu.be", "vimeo.com"];

    // Known bot-blocking or problematic sites
    const blockerDomains = ["news.yahoo.com", "finance.yahoo.com", "yahoo.com"];

    if (socialDomains.some((d) => hostname === d || hostname.endsWith("." + d))) {
      return false;
    }

    if (videoDomains.some((d) => hostname === d || hostname.endsWith("." + d))) {
      return false;
    }

    if (blockerDomains.some((d) => hostname === d || hostname.endsWith("." + d))) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function isBetterContent(newContent: string, oldContent: string | null): boolean {
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
  ];

  const lowerContent = newContent.toLowerCase();
  if (errorPatterns.some((p) => lowerContent.includes(p))) {
    return false;
  }

  if (!oldContent || oldContent.trim().length === 0) {
    return true;
  }

  const newWordCount = newContent.trim().split(/\s+/).length;
  const oldWordCount = oldContent.trim().split(/\s+/).length;

  // Significant improvement if it's longer
  // If old content was very short (e.g. just a summary), and new one is much longer, it's better.
  return newWordCount > oldWordCount;
}
