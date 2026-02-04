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

    // Remove cookie consent banners and overlays before processing
    removeCookieConsentBanners(document);

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
 * Removes cookie consent banners, modals, and overlays that can interfere with content extraction
 * Attempts to programmatically accept/dismiss consent banners before removal
 */
function removeCookieConsentBanners(document: Document): void {
  // Try to programmatically accept consent first
  tryAcceptConsent(document);

  // Set consent in localStorage/sessionStorage for common consent managers
  setConsentInStorage(document);

  // Common selectors for cookie consent banners and privacy overlays
  const cookieBannerSelectors = [
    // Generic cookie/consent patterns
    '[class*="cookie"]',
    '[id*="cookie"]',
    '[class*="consent"]',
    '[id*="consent"]',
    '[class*="gdpr"]',
    '[id*="gdpr"]',
    '[class*="privacy-banner"]',
    '[id*="privacy-banner"]',
    '[class*="privacy-notice"]',
    '[id*="privacy-notice"]',
    '[aria-label*="cookie" i]',
    '[aria-label*="consent" i]',
    '[aria-label*="privacy" i]',

    // Overlay and modal patterns
    '[class*="modal"]',
    '[class*="overlay"]',
    '[class*="popup"]',
    '[class*="dialog"]',
    '[role="dialog"]',
    '[role="alertdialog"]',

    // Specific vendor selectors
    "#onetrust-consent-sdk",
    ".onetrust-pc-dark-filter",
    "#cookieChoiceInfo",
    ".cc-window",
    ".cc-banner",
    "#CybotCookiebotDialog",
    "#cookiescript_injected",
    ".cookiesjsr-banner",
    "#truste-consent-track",
    ".trustarc-banner",
    ".didomi-popup",
    "#didomi-notice",
    ".qc-cmp-ui-container",
    ".qc-cmp2-container",
    "#ccc",
    ".ccc-notify",
  ];

  // Remove elements matching cookie consent patterns
  cookieBannerSelectors.forEach((selector) => {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach((element) => {
        // Only remove if it looks like a consent banner (not article content)
        const text = element.textContent?.toLowerCase() || "";
        const hasConsentKeywords =
          text.includes("cookie") ||
          text.includes("consent") ||
          text.includes("gdpr") ||
          text.includes("privacy policy") ||
          (text.includes("accept") && text.includes("reject"));

        if (
          hasConsentKeywords ||
          selector.includes("onetrust") ||
          selector.includes("cookiebot")
        ) {
          element.remove();
        }
      });
    } catch (e) {
      // Ignore selector errors and continue
    }
  });

  // Remove backdrop/overlay elements that might block content
  const overlaySelectors = [
    '[class*="backdrop"]',
    '[class*="overlay"]',
    '[style*="position: fixed"]',
    '[style*="position:fixed"]',
  ];

  overlaySelectors.forEach((selector) => {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach((element) => {
        const htmlElement = element as HTMLElement;
        // Remove if it's a full-screen overlay
        if (
          htmlElement.style.position === "fixed" &&
          htmlElement.style.zIndex &&
          parseInt(htmlElement.style.zIndex) > 100
        ) {
          element.remove();
        }
      });
    } catch (e) {
      // Ignore errors
    }
  });

  // Remove body overflow hidden that prevents scrolling
  if (document.body) {
    document.body.style.overflow = "";
    document.body.style.position = "";
  }
}

/**
 * Attempts to programmatically click "Accept" buttons on consent banners
 */
function tryAcceptConsent(document: Document): void {
  // Common selectors for accept/agree buttons
  const acceptButtonSelectors = [
    // Generic accept patterns
    'button[class*="accept" i]',
    'button[id*="accept" i]',
    'a[class*="accept" i]',
    'button[class*="agree" i]',
    'button[id*="agree" i]',
    'button[class*="allow" i]',
    'button[class*="consent" i]',
    '[aria-label*="accept" i]',
    '[aria-label*="agree" i]',
    '[aria-label*="allow" i]',

    // Specific vendor buttons
    "#onetrust-accept-btn-handler",
    ".onetrust-close-btn-handler",
    "#CybotCookiebotDialogBodyButtonAccept",
    ".didomi-button-highlight",
    ".didomi-button-standard",
    ".qc-cmp2-summary-buttons > button:first-child",
    ".cc-btn.cc-dismiss",
    ".cc-allow",
    "#cookiescript_accept",
    ".cookiesjsr-btn-accept",
  ];

  acceptButtonSelectors.forEach((selector) => {
    try {
      const buttons = document.querySelectorAll(selector);
      buttons.forEach((button) => {
        const htmlButton = button as HTMLElement;
        const text = htmlButton.textContent?.toLowerCase() || "";

        // Only click if it contains consent-related keywords
        if (
          text.includes("accept") ||
          text.includes("agree") ||
          text.includes("allow") ||
          text.includes("ok") ||
          text.includes("continue") ||
          selector.includes("onetrust") ||
          selector.includes("cookiebot") ||
          selector.includes("didomi")
        ) {
          // Simulate click
          if (typeof htmlButton.click === "function") {
            htmlButton.click();
          }
        }
      });
    } catch (e) {
      // Ignore errors
    }
  });
}

/**
 * Sets consent flags in localStorage/sessionStorage for common consent management platforms
 */
function setConsentInStorage(document: Document): void {
  try {
    const window = (document as any).defaultView;
    if (!window) return;

    const localStorage = window.localStorage;
    const sessionStorage = window.sessionStorage;

    if (!localStorage && !sessionStorage) return;

    // Common consent storage keys and values
    const consentSettings = [
      // OneTrust
      { key: "OptanonAlertBoxClosed", value: new Date().toISOString() },
      {
        key: "OptanonConsent",
        value: "groups=C0001:1,C0002:1,C0003:1,C0004:1",
      },

      // Cookiebot
      {
        key: "CookieConsent",
        value:
          "{stamp:'accepted',necessary:true,preferences:true,statistics:true,marketing:true}",
      },

      // Cookie Notice
      { key: "cookie_notice_accepted", value: "true" },
      { key: "cookieconsent_status", value: "allow" },

      // GDPR Cookie Consent
      {
        key: "gdpr",
        value: JSON.stringify({ analytics: true, marketing: true }),
      },

      // Quantcast
      { key: "__qca", value: "accepted" },

      // TrustArc
      { key: "truste.eu.cookie.notice_preferences", value: "0:" },

      // Didomi
      {
        key: "didomi_token",
        value: JSON.stringify({ purposes_consent: [], vendors_consent: [] }),
      },

      // Generic
      { key: "cookies_accepted", value: "true" },
      { key: "cookie_consent", value: "true" },
      { key: "privacy_consent", value: "true" },
    ];

    consentSettings.forEach(({ key, value }) => {
      try {
        if (localStorage) {
          localStorage.setItem(key, value);
        }
        if (sessionStorage) {
          sessionStorage.setItem(key, value);
        }
      } catch (e) {
        // Storage might be disabled or full
      }
    });
  } catch (e) {
    // Window or storage not available
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
