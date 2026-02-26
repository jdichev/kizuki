import { useEffect, useState, useRef } from "react";
import ReactDOM from "react-dom";
/* eslint-disable react/no-danger */
import FormattedDate from "./FormattedDate";
import serverConfig from "../config/serverConfig";
import DataService from "../service/DataService";
import TopNavOptionsMenu from "./TopNavOptionsMenu";

const ds = DataService.getInstance();

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

  useEffect(() => {
    setVideoId(undefined);
    setVideoKind(null);
    setSummary(null);
    setSummaryError(null);
    setRetrievedContent(null);
    setRetrieveError(null);
    setIsRetrievedContentExpanded(false);

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
      let contentToSummarize = article.content;
      let shouldFetchLatest = false;

      // If no content or content is too short, fetch the full article
      if (!article.content) {
        shouldFetchLatest = true;
      } else {
        // Count words in the article content (strip HTML tags first)
        const textContent = article.content
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        const wordCount = textContent.split(/\s+/).length;

        if (wordCount < 90) {
          shouldFetchLatest = true;
        }
      }

      // Fetch the full article if needed
      if (shouldFetchLatest && article.url) {
        try {
          const retrieveUrl = `${serverConfig.protocol}//${serverConfig.hostname}:${serverConfig.port}/api/retrieve-latest`;
          const retrieveResponse = await fetch(retrieveUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ url: article.url, format: "html" }),
          });

          if (retrieveResponse.ok) {
            const retrieveData = await retrieveResponse.json();
            contentToSummarize = retrieveData.markdown;
            // Also update the displayed retrieved content as HTML
            if (retrieveData.html) {
              setRetrievedContent(retrieveData.html);
            } else {
              setRetrievedContent(retrieveData.markdown);
            }
          } else {
            const errorData = await retrieveResponse.json();
            throw new Error(
              `Failed to retrieve article: ${errorData.message || "Unknown error"}`
            );
          }
        } catch (retrieveError: any) {
          console.warn("Failed to retrieve full article:", retrieveError);
          throw new Error(
            `Cannot summarize: ${retrieveError.message || "Failed to retrieve article content"}`
          );
        }
      }

      if (!contentToSummarize) {
        throw new Error("No content available to summarize");
      }

      const url = `${serverConfig.protocol}//${serverConfig.hostname}:${serverConfig.port}/api/summarize`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: contentToSummarize,
          format: "html",
          url: article.url,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to summarize");
      }

      const data = await response.json();
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

          <div id="content">
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
                      __html: summary,
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
                      __html: retrievedContent,
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
                //@ts-ignore
                __html: article.content,
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
