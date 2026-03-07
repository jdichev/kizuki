import { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
/* eslint-disable react/no-danger */
import FormattedDate from "./FormattedDate";
import serverConfig from "../config/serverConfig";
import DataService from "../service/DataService";
import TopNavOptionsMenu from "./TopNavOptionsMenu";

const ds = DataService.getInstance();

function isExternalImageSource(src: string): boolean {
  return /^https?:\/\//i.test(src) || src.startsWith("//");
}

function withExternalImagesBlocked(
  html: string | null | undefined,
  areExternalImagesAllowed: boolean
): string {
  if (!html) {
    return "";
  }

  if (areExternalImagesAllowed) {
    return html;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const images = doc.querySelectorAll("img");

  images.forEach((imageNode) => {
    const src = imageNode.getAttribute("src")?.trim() || "";
    if (!isExternalImageSource(src)) {
      return;
    }

    const placeholder = doc.createElement("div");
    placeholder.className = "blocked-external-image";
    placeholder.setAttribute("role", "img");
    placeholder.setAttribute("aria-label", "External image");
    placeholder.innerHTML = '<i class="bi bi-image" aria-hidden="true"></i>';

    const closestAnchor = imageNode.closest("a");
    if (closestAnchor?.contains(imageNode)) {
      closestAnchor.classList.add("blocked-external-image-link");
      closestAnchor.setAttribute("href", "#");
      closestAnchor.setAttribute("title", "Load external images");
      closestAnchor.removeAttribute("target");
      closestAnchor.removeAttribute("rel");
    }

    const parent = imageNode.parentElement;
    if (parent?.tagName.toLowerCase() === "picture") {
      parent.replaceWith(placeholder);
      return;
    }

    imageNode.replaceWith(placeholder);
  });

  return doc.body.innerHTML;
}

function hasExternalImages(html: string | null | undefined): boolean {
  if (!html) {
    return false;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const images = doc.querySelectorAll("img");

  return Array.from(images).some((imageNode) => {
    const src = imageNode.getAttribute("src")?.trim() || "";
    return isExternalImageSource(src);
  });
}

// @ts-ignore
export default function Article({
  article,
  selectedFeedCategory,
  selectedFeed,
  selectedItemCategory,
  selectedParentCategory,
  topOptions,
}: ArticleProps) {
  const [videoId, setVideoId] = useState<String>();
  const [videoKind, setVideoKind] = useState<"standard" | "short" | null>(null);
  const playerRef = useRef<any>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [retrievedContent, setRetrievedContent] = useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [retrieveError, setRetrieveError] = useState<string | null>(null);
  const [isRetrievedContentExpanded, setIsRetrievedContentExpanded] =
    useState(false);
  const [isBookmarking, setIsBookmarking] = useState(false);
  const [areExternalImagesAllowed, setAreExternalImagesAllowed] =
    useState(false);

  useEffect(() => {
    setVideoId(undefined);
    setVideoKind(null);
    setSummary(null);
    setSummaryError(null);
    setRetrievedContent(null);
    setRetrieveError(null);
    setIsRetrievedContentExpanded(false);
    setAreExternalImagesAllowed(false);

    if (!article || !article.url) return;

    try {
      const parsedUrl = new URL(article.url);
      const host = parsedUrl.hostname.toLowerCase();
      const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);

      const isYouTubeHost =
        host.includes("youtube.com") ||
        host === "youtu.be" ||
        host.endsWith("youtube-nocookie.com");

      if (!isYouTubeHost) return;

      let foundVideoId: string | null = null;
      let kind: "standard" | "short" | null = null;

      // Handle shorts/reels URLs like youtube.com/shorts/<id>
      if (pathSegments[0] === "shorts" && pathSegments[1]) {
        foundVideoId = pathSegments[1];
        kind = "short";
      }

      // Handle youtu.be/<id>
      if (!foundVideoId && host === "youtu.be" && pathSegments[0]) {
        foundVideoId = pathSegments[0];
        kind = "standard";
      }

      // Handle classic watch URLs with ?v=<id>
      if (!foundVideoId) {
        const vParam = parsedUrl.searchParams.get("v");
        if (vParam) {
          foundVideoId = vParam;
          kind = "standard";
        }
      }

      if (foundVideoId) {
        setVideoId(foundVideoId);
        setVideoKind(kind || "standard");
      }
    } catch (error) {
      console.error("Error parsing URL:", error);
      setVideoId(undefined);
      setVideoKind(null);
    }
  }, [article]);

  // Load YouTube IFrame API
  useEffect(() => {
    if (videoId) {
      // Load YouTube IFrame API script
      if (!(window as any).YT) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName("script")[0];
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);

        (window as any).onYouTubeIframeAPIReady = () => {
          initPlayer();
        };
      } else {
        initPlayer();
      }
    }

    return () => {
      playerRef.current = null;
    };
  }, [videoId]);

  const initPlayer = () => {
    if (videoId) {
      playerRef.current = new (window as any).YT.Player("player", {
        videoId: videoId,
      });
    }
  };

  const handleSummarize = async () => {
    if (!article) return;

    setIsLoadingSummary(true);
    setSummaryError(null);

    try {
      const data = await ds.summarize(article.content, article.url, "html");

      if (data.skipped) {
        throw new Error(
          data.message ||
            data.reason ||
            "Summarization skipped by server prerequisites"
        );
      }

      // Use HTML version if available, otherwise use plain summary
      setSummary(data.html || data.summary);
    } catch (error: any) {
      console.error("Error summarizing article:", error);
      setSummaryError(error.message || "Failed to summarize article");
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const handleRetrieveLatest = async () => {
    if (!article || !article.url) return;

    setIsLoadingContent(true);
    setRetrieveError(null);

    try {
      const url = `${serverConfig.protocol}//${serverConfig.hostname}:${serverConfig.port}/api/retrieve-latest`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: article.url, format: "html" }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to retrieve article");
      }

      const data = await response.json();
      // Use HTML version if available, otherwise use markdown
      setRetrievedContent(data.html || data.markdown);
    } catch (error: any) {
      console.error("Error retrieving article:", error);
      setRetrieveError(error.message || "Failed to retrieve article");
    } finally {
      setIsLoadingContent(false);
    }
  };

  const handleBookmark = async () => {
    if (!article) return;

    setIsBookmarking(true);

    try {
      const result = await ds.toggleItemBookmark(article);
      // Update the article with the new bookmark status
      article.bookmarked = result.bookmarked;
    } catch (error: any) {
      console.error("Error bookmarking article:", error);
    } finally {
      setIsBookmarking(false);
    }
  };

  const handleToggleExternalImages = () => {
    setAreExternalImagesAllowed((previous) => !previous);
  };

  const handleContentClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const blockedImagePlaceholder = target.closest(".blocked-external-image");
    const blockedImageLink = target.closest("a.blocked-external-image-link");
    if (!blockedImageLink && !blockedImagePlaceholder) {
      return;
    }

    event.preventDefault();
    setAreExternalImagesAllowed(true);
  };

  const renderedSummaryHtml = useMemo(
    () => withExternalImagesBlocked(summary, areExternalImagesAllowed),
    [summary, areExternalImagesAllowed]
  );

  const renderedRetrievedContentHtml = useMemo(
    () => withExternalImagesBlocked(retrievedContent, areExternalImagesAllowed),
    [retrievedContent, areExternalImagesAllowed]
  );

  const renderedArticleContentHtml = useMemo(
    () => withExternalImagesBlocked(article?.content, areExternalImagesAllowed),
    [article?.content, areExternalImagesAllowed]
  );

  const hasExternalImagesInArticle = useMemo(
    () => hasExternalImages(article?.content),
    [article?.content]
  );

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only handle if video is present and we're not typing in an input/textarea
      if (
        videoId &&
        playerRef.current &&
        event.target instanceof HTMLElement &&
        event.target.tagName !== "INPUT" &&
        event.target.tagName !== "TEXTAREA"
      ) {
        // Space to play/pause
        if (event.code === "Space") {
          event.preventDefault();
          const playerState = playerRef.current.getPlayerState();
          // 1 = playing, 2 = paused
          if (playerState === 1) {
            playerRef.current.pauseVideo();
          } else {
            playerRef.current.playVideo();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    };
  }, [videoId]);

  if (article) {
    return (
      <>
        {topOptions?.current &&
          ReactDOM.createPortal(
            <TopNavOptionsMenu
              onSummarize={handleSummarize}
              onRetrieveLatest={handleRetrieveLatest}
              onBookmark={handleBookmark}
              isLoadingSummary={isLoadingSummary}
              isLoadingContent={isLoadingContent}
              isBookmarking={isBookmarking}
              isBookmarked={article?.bookmarked === 1}
            />,
            topOptions.current
          )}
        <article>
          <h1 id="title" dangerouslySetInnerHTML={{ __html: article.title }} />

          {hasExternalImagesInArticle && (
            <div
              className="image-privacy-strip"
              role="status"
              aria-live="polite"
            >
              <i
                className={
                  areExternalImagesAllowed ? "bi bi-image-fill" : "bi bi-image"
                }
                aria-hidden="true"
              />
              <span>
                {areExternalImagesAllowed
                  ? "External images enabled for this item"
                  : "External images blocked for privacy"}
              </span>
              <button
                type="button"
                className="btn-image-privacy-toggle"
                onClick={handleToggleExternalImages}
              >
                {areExternalImagesAllowed ? "Block" : "Load"}
              </button>
            </div>
          )}

          <p>
            <a
              href={`#/feeds/read?category=${article.feedCategoryId}&feed=${article.feedId}`}
              className="text-decoration-none"
            >
              {article.feedTitle ? article.feedTitle : "NO_TITLE"}
            </a>
            , <FormattedDate pubDate={article.published} />
            &nbsp;|
            {article.categoryTitle ? ` Category: ${article.categoryTitle}` : ""}
            &nbsp;♥&nbsp;
            <a
              data-testid="upper-outbound-link"
              href={article.url}
              target="_blank"
              rel="noreferrer noopener"
              title={`Click to Visit ${article.title}`}
              className="text-decoration-none"
            >
              Visit Site
            </a>
            {article.comments ? (
              <>
                &nbsp;|&nbsp;
                <a
                  href={article.comments}
                  target="_blank"
                  rel="noreferrer noopener"
                  title="Comments"
                  className="text-decoration-none"
                >
                  Comments
                </a>
              </>
            ) : (
              ""
            )}
          </p>

          <div id="content" onClick={handleContentClick}>
            {videoId ? (
              <>
                <div>
                  {videoKind === "short" ? (
                    <span>YouTube Short</span>
                  ) : (
                    <span>YouTube Video</span>
                  )}
                </div>
                <iframe
                  title={article.title}
                  data-testid="yt-embed-frame"
                  id="player"
                  src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1`}
                />
                <br />
              </>
            ) : (
              <></>
            )}

            {(isLoadingSummary || summary) && (
              <div className="text-summary">
                {summary && <h4>Summary</h4>}
                {summary && (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: renderedSummaryHtml,
                    }}
                  />
                )}
                {isLoadingSummary && !summary && <div>Summarizing...</div>}
              </div>
            )}

            {summaryError && (
              <div className="text-summary-error">
                <strong>Error:</strong> {summaryError}
              </div>
            )}

            {(isLoadingContent || retrievedContent || retrieveError) && (
              <div className="text-summary">
                <h4>
                  Retrieved Latest Content{" "}
                  <button
                    onClick={() =>
                      setIsRetrievedContentExpanded(!isRetrievedContentExpanded)
                    }
                    className="btn-collapse-expand"
                    disabled={!retrievedContent}
                  >
                    {isRetrievedContentExpanded ? "[hide]" : "[preview]"}
                  </button>
                </h4>
                {isLoadingContent && !retrievedContent && (
                  <div>Retrieving latest content...</div>
                )}
                {isLoadingContent && retrievedContent && (
                  <div>Updating retrieved content...</div>
                )}
                {isRetrievedContentExpanded && retrievedContent && (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: renderedRetrievedContentHtml,
                    }}
                  />
                )}
              </div>
            )}

            {retrieveError && (
              <div className="text-summary-error">
                <strong>Error:</strong> {retrieveError}
              </div>
            )}

            <div
              dangerouslySetInnerHTML={{
                __html: renderedArticleContentHtml,
              }}
            />
          </div>

          <ul id="content-options">
            <li>
              <a
                data-testid="lower-outbound-link"
                href={article.url}
                target="_blank"
                rel="noreferrer noopener"
                title={`Click to Visit ${article.title}`}
                className="text-decoration-none"
              >
                Visit {article.feedTitle}
              </a>
            </li>
            {article.comments ? (
              <li>
                <a
                  data-testid="comments-link"
                  href={article.comments}
                  target="_blank"
                  rel="noreferrer noopener"
                  title="Comments"
                  className="text-decoration-none"
                >
                  Comments
                </a>
              </li>
            ) : (
              ""
            )}
          </ul>
        </article>
      </>
    );
  }

  if (selectedFeed) {
    return (
      <article data-testid="article-placeholder">
        <h2>{selectedFeed.title}</h2>
      </article>
    );
  }

  if (selectedFeedCategory) {
    return (
      <article data-testid="article-placeholder">
        <h2>{selectedFeedCategory.title}</h2>
      </article>
    );
  }

  if (selectedItemCategory) {
    return (
      <article data-testid="article-placeholder">
        <h2>{selectedItemCategory.title}</h2>
      </article>
    );
  }

  if (selectedParentCategory) {
    return (
      <article data-testid="article-placeholder">
        <h2>{selectedParentCategory.title}</h2>
      </article>
    );
  }

  return (
    <article data-testid="article-placeholder">
      <h2>Seeing all categories</h2>
      <h3>Happy reading!</h3>
    </article>
  );
}
