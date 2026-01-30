import axios, { AxiosError } from "axios";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";

interface ConvertArticleOptions {
  includeMetadata?: boolean;
  removeAds?: boolean;
  timeout?: number;
}

interface ArticleMetadata {
  title?: string;
  author?: string;
  date?: string;
  description?: string;
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
  const { includeMetadata = true, removeAds = true, timeout = 10000 } = options;

  try {
    // Validate URL
    new URL(url);
  } catch (error) {
    throw new Error(`Invalid URL: ${url}`);
  }

  // Fetch the article
  let html: string;
  try {
    const response = await axios.get(url, {
      timeout: timeout,
      maxRedirects: 5,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    } as any); // Use 'as any' since maxHeaderSize is not part of official AxiosRequestConfig

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
  const document = dom.window.document;

  // Extract metadata
  const metadata = extractMetadata(document);

  // Find and clean the main content
  let content = extractMainContent(document, removeAds);

  // Convert to Markdown
  const turndownService = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });

  // Add custom rules for better conversion
  turndownService.addRule("removeScripts", {
    filter: ["script", "style", "noscript"],
    replacement: () => "",
  });

  let markdown = turndownService.turndown(content as HTMLElement);

  // Clean up extra whitespace
  markdown = markdown.replace(/\n{3,}/g, "\n\n").trim();

  // Add metadata header if requested
  if (includeMetadata && (metadata.title || metadata.author || metadata.date)) {
    let header = "";
    if (metadata.title) header += `# ${metadata.title}\n\n`;
    if (metadata.author) header += `**Author:** ${metadata.author}\n\n`;
    if (metadata.date) header += `**Date:** ${metadata.date}\n\n`;
    if (metadata.description) header += `*${metadata.description}*\n\n`;
    header += "---\n\n";
    markdown = header + markdown;
  }

  return markdown;
}

/**
 * Extracts metadata from the article
 */
function extractMetadata(document: Document): ArticleMetadata {
  const metadata: ArticleMetadata = {};

  // Try to get title
  metadata.title =
    document
      .querySelector('meta[property="og:title"]')
      ?.getAttribute("content") ||
    document
      .querySelector('meta[name="twitter:title"]')
      ?.getAttribute("content") ||
    document.querySelector("h1")?.textContent ||
    document.title;

  // Try to get author
  metadata.author =
    document.querySelector('meta[name="author"]')?.getAttribute("content") ||
    document
      .querySelector('meta[property="article:author"]')
      ?.getAttribute("content") ||
    document.querySelector('[rel="author"]')?.textContent ||
    undefined;

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

  // Try to get description
  metadata.description =
    document
      .querySelector('meta[property="og:description"]')
      ?.getAttribute("content") ||
    document
      .querySelector('meta[name="description"]')
      ?.getAttribute("content") ||
    undefined;

  return metadata;
}

/**
 * Extracts the main content from the page, removing clutter
 */
function extractMainContent(document: Document, removeAds: boolean): Element {
  // Try common article selectors
  const contentSelectors = [
    "article",
    '[role="article"]',
    ".article-content",
    ".post-content",
    ".entry-content",
    ".content",
    "main",
    "#content",
  ];

  let content: Element | null = null;

  for (const selector of contentSelectors) {
    content = document.querySelector(selector);
    if (content) break;
  }

  // Fallback to body if no article content found
  if (!content) {
    content = document.body || document.documentElement;
  }

  // Clone to avoid modifying original
  const clonedContent = content.cloneNode(true) as Element;

  if (removeAds) {
    // Remove common ad and clutter elements
    const clutterSelectors = [
      "nav",
      "header",
      "footer",
      ".advertisement",
      ".ads",
      ".sidebar",
      ".comments",
      ".related-posts",
      ".social-share",
      '[class*="popup"]',
      '[class*="modal"]',
      '[id*="ad"]',
      '[class*="ad-"]',
    ];

    clutterSelectors.forEach((selector) => {
      clonedContent.querySelectorAll(selector).forEach((el) => el.remove());
    });
  }

  return clonedContent;
}

export default convertArticleToMarkdown;
