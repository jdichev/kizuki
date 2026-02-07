import axios, { AxiosError } from "axios";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { Readability } from "@mozilla/readability";

interface ConvertArticleOptions {
  includeMetadata?: boolean;
  timeout?: number;
}

// Cache for robots.txt files to avoid repeated fetches
const robotsTxtCache = new Map<
  string,
  { content: string; timestamp: number }
>();
const ROBOTS_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Singleton TurndownService instance to avoid recreation on every call
const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

// Use GFM plugin for better table and task list support
turndownService.use(gfm);

// Add custom rules for better conversion
turndownService.addRule("removeScripts", {
  filter: ["script", "style", "noscript"],
  replacement: () => "",
});

/**
 * Fetches and parses robots.txt file for a domain
 * @param domain - The domain to fetch robots.txt for
 * @param timeout - Timeout in milliseconds
 * @returns The robots.txt content or null if fetch fails
 */
async function fetchRobotsTxt(
  domain: string,
  timeout: number = 5000
): Promise<string | null> {
  // Check cache first
  const cached = robotsTxtCache.get(domain);
  if (cached && Date.now() - cached.timestamp < ROBOTS_CACHE_DURATION) {
    return cached.content;
  }

  try {
    const robotsUrl = `https://${domain}/robots.txt`;
    const response = await axios.get(robotsUrl, {
      timeout,
      headers: {
        "User-Agent": "Forest/1.0 (Feed Reader)",
      },
    });

    const content = response.data;

    // Cache the result
    robotsTxtCache.set(domain, {
      content,
      timestamp: Date.now(),
    });

    return content;
  } catch (error) {
    // If robots.txt doesn't exist or fails to fetch, assume allow (graceful degradation)
    // Cache null result for shorter period to retry later
    robotsTxtCache.set(domain, {
      content: "",
      timestamp: Date.now(),
    });
    return null;
  }
}

/**
 * Checks if a URL is allowed by the site's robots.txt
 * @param url - The URL to check
 * @param robotsContent - The robots.txt content
 * @returns true if the URL is allowed, false otherwise
 */
function isUrlAllowedByRobots(url: string, robotsContent: string): boolean {
  if (!robotsContent) {
    // If no robots.txt, allow the request (graceful degradation)
    return true;
  }

  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname + urlObj.search;

    // Parse robots.txt rules
    const lines = robotsContent.split("\n");
    let currentUserAgent = "*";
    const rules: { userAgent: string; disallow: string[]; allow: string[] } = {
      userAgent: "*",
      disallow: [],
      allow: [],
    };

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip comments and empty lines
      if (!trimmedLine || trimmedLine.startsWith("#")) {
        continue;
      }

      const [directive, value] = trimmedLine.split(":").map((s) => s.trim());

      if (directive.toLowerCase() === "user-agent") {
        currentUserAgent = value || "*";
      } else if (directive.toLowerCase() === "disallow") {
        if (currentUserAgent === "*" || currentUserAgent === "Forest") {
          rules.disallow.push(value);
        }
      } else if (directive.toLowerCase() === "allow") {
        if (currentUserAgent === "*" || currentUserAgent === "Forest") {
          rules.allow.push(value);
        }
      }
    }

    // Check if path matches disallow rules
    for (const disallowPattern of rules.disallow) {
      if (disallowPattern === "" || disallowPattern === "/") {
        // Empty or "/" means disallow all
        continue;
      }
      // Simple pattern matching (no regex, just prefix matching)
      if (pathname.startsWith(disallowPattern)) {
        // Check if there's an allow rule that takes precedence
        let allowed = false;
        for (const allowPattern of rules.allow) {
          if (
            pathname.startsWith(allowPattern) &&
            allowPattern.length > disallowPattern.length
          ) {
            allowed = true;
            break;
          }
        }
        if (!allowed) {
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    // If parsing fails, allow the request (graceful degradation)
    return true;
  }
}

/**
 * Converts a web article URL to Markdown format
 * @param url - The URL of the article to convert
 * @param options - Optional configuration
 * @returns The article content in Markdown format
 */
export async function convertArticleToMarkdown(
  url: string,
  options: ConvertArticleOptions = {}
): Promise<string> {
  const { includeMetadata = true, timeout = 10000 } = options;

  let urlObj: URL;
  try {
    // Validate URL
    urlObj = new URL(url);
  } catch (error) {
    throw new Error(`Invalid URL: ${url}`);
  }

  // Check robots.txt before fetching the article
  try {
    const domain = urlObj.hostname;
    const robotsContent = await fetchRobotsTxt(
      domain,
      Math.min(timeout / 2, 5000)
    );

    if (robotsContent !== null && !isUrlAllowedByRobots(url, robotsContent)) {
      throw new Error(
        `URL is disallowed by robots.txt: ${url}. Respecting site crawling rules.`
      );
    }
  } catch (error) {
    // If robots.txt check fails for reasons other than disallow, log and continue
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes("disallowed by robots.txt")) {
      throw error;
    }
    // Otherwise, continue with the request (graceful degradation)
  }

  // Fetch the article
  let html: string;
  try {
    const response = await axios.get(url, {
      timeout: timeout,
      maxRedirects: 5,
      headers: {
        "User-Agent": "Forest/1.0 (Feed Reader)",
        "Accept-Encoding": "gzip, deflate",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    } as any); // Use 'as any' since maxHeaderSize is not part of official AxiosRequestConfig

    // Validate Content-Type to prevent parsing non-HTML content
    const contentType = response.headers["content-type"]?.toLowerCase() || "";
    const validContentTypes = [
      "text/html",
      "application/xhtml+xml",
      "application/xml",
      "text/xml",
    ];

    if (!validContentTypes.some((type) => contentType.includes(type))) {
      throw new Error(
        `Invalid content type: ${contentType}. Expected HTML/XML content.`
      );
    }

    html = response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.code === "ECONNABORTED") {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    // Handle header overflow and other specific errors
    if (axiosError.message && axiosError.message.includes("header")) {
      throw new Error(
        `Failed to fetch URL: The website sent invalid or oversized headers. The server may be unreachable or misconfigured.`
      );
    }
    throw new Error(`Failed to fetch URL: ${axiosError.message}`);
  }

  const dom = new JSDOM(html, { url });

  try {
    const document = dom.window.document;

    // Use Mozilla's Readability to extract article content
    const reader = new Readability(document);
    const article = reader.parse();

    if (!article) {
      throw new Error("Failed to extract article content from the page");
    }

    // Extract additional metadata not provided by Readability
    const additionalMetadata = extractMetadata(document);

    // Convert to Markdown using singleton turndownService
    let markdown = turndownService.turndown(article.content || "");

    // Clean up extra whitespace
    markdown = markdown.replace(/\n{3,}/g, "\n\n").trim();

    // Add metadata header if requested
    if (includeMetadata) {
      let header = "";
      if (article.title) header += `# ${article.title}\n\n`;
      if (article.byline) header += `**Author:** ${article.byline}\n\n`;
      if (additionalMetadata.date)
        header += `**Date:** ${additionalMetadata.date}\n\n`;
      if (article.excerpt) header += `*${article.excerpt}*\n\n`;
      header += "---\n\n";
      markdown = header + markdown;
    }

    return markdown;
  } finally {
    // Close the JSDOM window to prevent memory leaks
    dom.window.close();
  }
}

/**
 * Extracts additional metadata from the article that Readability doesn't provide
 */
function extractMetadata(document: Document): { date?: string } {
  const metadata: { date?: string } = {};

  // Try to get publication date
  metadata.date =
    document
      .querySelector('meta[property="article:published_time"]')
      ?.getAttribute("content") ||
    document
      .querySelector('meta[name="publish-date"]')
      ?.getAttribute("content") ||
    document.querySelector("time")?.getAttribute("datetime") ||
    undefined;

  return metadata;
}

export default convertArticleToMarkdown;
