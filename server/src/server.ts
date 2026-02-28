import { Server } from "net";
import express, { Application, Request, Response } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import MarkdownIt from "markdown-it";
import pinoLib from "pino";
import MixedDataModel from "./modules/MixedDataModel";
import FeedUpdater from "./modules/FeedUpdater";
import FeedFinder from "./modules/FeedFinder";
import SettingsManager from "./modules/SettingsManager";
import GoogleAiService from "./modules/GoogleAiService";
import GoogleServiceUsageManager from "./modules/GoogleServiceUsageManager";
import projectConfig from "forestconfig";
import { convertArticleToMarkdown } from "./modules/ArticleToMarkdown";

const pino = pinoLib({
  level: process.env.LOG_LEVEL || "info",
  name: "server",
});

const dataModel = MixedDataModel.getInstance();

const updater = new FeedUpdater();

const settingsManager = SettingsManager.getInstance();

const aiService = GoogleAiService.getInstance();

const serviceUsageManager = GoogleServiceUsageManager.getInstance();

const markdownRenderer = new MarkdownIt();

const renderMarkdownToHtml = (content: string) => {
  return markdownRenderer.render(content);
};

const app: Application = express();

const jsonParser = bodyParser.json();

type OpmlImportJob = {
  status: "running" | "completed" | "failed";
  processedFeeds: number;
  totalFeeds: number;
  importedFeeds: number;
  error?: string;
};

const opmlImportJobs = new Map<string, OpmlImportJob>();

const makeOpmlImportJobId = () => {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

app.use(cors());

// Request logging middleware
app.use((req: Request, res: Response, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    pino.trace(
      {
        method: req.method,
        path: req.path,
        query: req.query,
        status: res.statusCode,
        duration: `${duration}ms`,
      },
      "HTTP Request"
    );
  });

  next();
});

app.get("/", (req: Request, res: Response) => {
  res.json({ message: "OK" });
});

app.get("/items", async (req: Request, res: Response) => {
  const unreadOnly = req.query.unread ? req.query.unread === "true" : false;
  const bookmarkedOnly = req.query.bookmarked
    ? req.query.bookmarked === "true"
    : false;

  const size = req.query.size ? parseInt(req.query.size as string) : undefined;

  const selectedFeedId = req.query.fid
    ? parseInt(req.query.fid as string)
    : undefined;

  const selectedFeedCategoryId = req.query.cid
    ? parseInt(req.query.cid as string)
    : undefined;

  const selectedItemCategoryId = req.query.icid
    ? parseInt(req.query.icid as string)
    : undefined;

  const selectedItemCategoryIds = req.query.icids
    ? JSON.parse(req.query.icids as string)
    : undefined;

  const searchQuery = req.query.q ? String(req.query.q) : "";

  let selectedFeed;
  let selectedFeedCategory;
  let selectedItemCategory;
  let selectedItemCategoryIdArray;

  if (selectedFeedId !== undefined) {
    selectedFeed = await dataModel.getFeedById(selectedFeedId);
  } else if (selectedFeedCategoryId !== undefined) {
    selectedFeedCategory = await dataModel.getFeedCategoryById(
      selectedFeedCategoryId
    );
  } else if (selectedItemCategoryIds !== undefined) {
    // Use the array of category IDs
    selectedItemCategoryIdArray = selectedItemCategoryIds;
  } else if (selectedItemCategoryId !== undefined) {
    const itemCategories = await dataModel.getItemCategories();
    selectedItemCategory = itemCategories.find(
      (cat) => cat.id === selectedItemCategoryId
    );
  }

  const items = await dataModel.getItems({
    unreadOnly,
    bookmarkedOnly,
    searchQuery,
    size,
    selectedFeed,
    selectedFeedCategory,
    selectedItemCategory,
    selectedItemCategoryIds: selectedItemCategoryIdArray,
    order: "published",
  });
  res.json(items);
});

app.get("/items/search", async (req: Request, res: Response) => {
  const query = typeof req.query.q === "string" ? req.query.q : "";
  const size =
    typeof req.query.size === "string"
      ? parseInt(req.query.size, 10)
      : undefined;

  const items = await dataModel.searchItems({
    query,
    size,
  });

  res.json(items);
});

app.get("/items/:itemId", async (req: Request, res: Response) => {
  const item = await dataModel.getItemById(parseInt(req.params.itemId));

  res.json(item);
});

app.put("/items", jsonParser, async (req: Request, res: Response) => {
  try {
    const { itemId, itemCategoryId } = req.body;

    if (itemId === undefined || itemCategoryId === undefined) {
      res.status(400).json({
        error: "Missing itemId or itemCategoryId",
      });
      return;
    }

    const result = await dataModel.assignItemToCategory(itemId, itemCategoryId);
    res.json({ success: result });
  } catch (error: any) {
    pino.error(
      { error: error.message || String(error) },
      "Error updating item category"
    );
    res.status(500).json({
      error: "Failed to update item category",
      message: error.message || String(error),
    });
  }
});

app.delete("/items", async (req: Request, res: Response) => {
  const result = await dataModel.removeItems();

  res.json(result);
});

app.get("/item/read", async (req: Request, res: Response) => {
  const itemId = req.query.id ? parseInt(req.query.id as string) : undefined;

  if (itemId === undefined) {
    res.json({ message: "id is needed" });
  } else {
    const item = await dataModel.getItemById(itemId);

    if (item) {
      const result = await dataModel.markItemRead(item);
      res.json(result);
    } else {
      res.json({ message: "Item not found" });
    }
  }
});

app.get("/item/bookmark", async (req: Request, res: Response) => {
  const itemId = req.query.id ? parseInt(req.query.id as string) : undefined;

  if (itemId === undefined) {
    res.json({ message: "id is needed" });
  } else {
    const item = await dataModel.getItemById(itemId);

    if (item) {
      const result = await dataModel.toggleItemBookmark(item);
      res.json(result);
    } else {
      res.json({ message: "Item not found" });
    }
  }
});

app.get("/categories", async (req: Request, res: Response) => {
  const categories = await dataModel.getFeedCategories();

  res.json(categories);
});

app.post("/categories", jsonParser, async (req: Request, res: Response) => {
  const result = await dataModel.insertFeedCategory(req.body);

  res.json(result);
});

app.put("/categories", jsonParser, async (req: Request, res: Response) => {
  const result = await dataModel.updateFeedCategory(req.body);

  res.json(result);
});

app.delete("/categories", async (req: Request, res: Response) => {
  const selectedFeedCategoryId = req.query.cid
    ? parseInt(req.query.cid as string)
    : undefined;

  if (selectedFeedCategoryId) {
    const selectedFeedCategory = await dataModel.getFeedCategoryById(
      selectedFeedCategoryId
    );

    if (selectedFeedCategory) {
      const result = await dataModel.removeFeedCategory(selectedFeedCategory);

      res.json(result);
    } else {
      res.status(404).json({ message: "No category found" });
    }
  } else {
    res.json({ mesage: "No category id found" });
  }
});

app.get("/categories/readstats", async (req: Request, res: Response) => {
  const categoryReadStats = await dataModel.getFeedCategoryReadStats();

  res.json(categoryReadStats);
});

app.get("/item-categories/readstats", async (req: Request, res: Response) => {
  try {
    pino.trace("Fetching item category read stats");
    const itemCategoryReadStats = await dataModel.getItemCategoryReadStats();
    pino.trace(
      { count: itemCategoryReadStats.length },
      "Item category read stats retrieved"
    );
    res.json(itemCategoryReadStats);
  } catch (error: any) {
    pino.error(
      { error: error.message || String(error) },
      "Error fetching item category read stats"
    );
    res.status(500).json({
      error: "Failed to fetch item category read stats",
      message: error.message || String(error),
    });
  }
});

app.get("/item-categories", async (req: Request, res: Response) => {
  try {
    pino.trace("Fetching item categories");
    const itemCategories = await dataModel.getItemCategories();
    pino.trace({ count: itemCategories.length }, "Item categories retrieved");
    res.json(itemCategories);
  } catch (error: any) {
    pino.error(
      { error: error.message || String(error) },
      "Error fetching item categories"
    );
    res.status(500).json({
      error: "Failed to fetch item categories",
      message: error.message || String(error),
    });
  }
});

app.post(
  "/item-categories",
  jsonParser,
  async (req: Request, res: Response) => {
    try {
      pino.trace("Creating item category");
      const itemCategory = req.body;
      const result = await dataModel.insertItemCategory(itemCategory);
      res.json({ success: result });
    } catch (error: any) {
      pino.error(
        { error: error.message || String(error) },
        "Error creating item category"
      );
      res.status(500).json({
        error: "Failed to create item category",
        message: error.message || String(error),
      });
    }
  }
);

app.put("/item-categories", jsonParser, async (req: Request, res: Response) => {
  try {
    pino.trace("Updating item category");
    const itemCategory = req.body;
    const result = await dataModel.updateItemCategory(itemCategory);
    res.json({ success: result });
  } catch (error: any) {
    pino.error(
      { error: error.message || String(error) },
      "Error updating item category"
    );
    res.status(500).json({
      error: "Failed to update item category",
      message: error.message || String(error),
    });
  }
});

app.delete("/item-categories", async (req: Request, res: Response) => {
  try {
    pino.trace("Deleting item category");
    const itemCategoryId = req.query.id
      ? parseInt(req.query.id as string)
      : undefined;
    if (itemCategoryId === undefined) {
      res.status(400).json({ error: "Missing item category ID" });
      return;
    }
    const result = await dataModel.deleteItemCategory(itemCategoryId);
    res.json({ success: result });
  } catch (error: any) {
    pino.error(
      { error: error.message || String(error) },
      "Error deleting item category"
    );
    res.status(500).json({
      error: "Failed to delete item category",
      message: error.message || String(error),
    });
  }
});

app.get("/item-categories/:id", async (req: Request, res: Response) => {
  try {
    pino.trace("Fetching item category by ID");
    const id = parseInt(req.params.id);
    const itemCategory = await dataModel.getItemCategoryById(id);
    res.json(itemCategory);
  } catch (error: any) {
    pino.error(
      { error: error.message || String(error) },
      "Error fetching item category"
    );
    res.status(500).json({
      error: "Failed to fetch item category",
      message: error.message || String(error),
    });
  }
});

app.get("/itemsread", async (req: Request, res: Response) => {
  const selectedFeedId = req.query.fid
    ? parseInt(req.query.fid as string)
    : undefined;

  const selectedFeedCategoryId = req.query.cid
    ? parseInt(req.query.cid as string)
    : undefined;

  // Support both single icid and multiple icids
  const selectedItemCategoryIds: number[] | undefined = req.query.icids
    ? JSON.parse(req.query.icids as string)
    : req.query.icid
      ? [parseInt(req.query.icid as string)]
      : undefined;

  if (selectedFeedId !== undefined) {
    const feed = await dataModel.getFeedById(selectedFeedId);

    if (feed) {
      const result = await dataModel.markItemsRead({ feed: feed });
      res.json(result);
    } else {
      res.json({ message: "Feed not found" });
    }
  } else if (selectedFeedCategoryId !== undefined) {
    const category = await dataModel.getFeedCategoryById(
      selectedFeedCategoryId
    );

    if (category) {
      const result = await dataModel.markItemsRead({
        feedCategory: category,
      });
      res.json(result);
    } else {
      res.json({ message: "Feed category not found" });
    }
  } else if (
    selectedItemCategoryIds !== undefined &&
    selectedItemCategoryIds.length > 0
  ) {
    const allItemCategories = await dataModel.getItemCategories();
    const itemCategories = allItemCategories.filter(
      (cat) => cat.id !== undefined && selectedItemCategoryIds.includes(cat.id)
    );

    if (itemCategories.length > 0) {
      const result = await dataModel.markItemsRead({
        itemCategories: itemCategories,
      });
      res.json(result);
    } else {
      res.json({ message: "Item categories not found" });
    }
  } else {
    const result = await dataModel.markItemsRead({});
    res.json(result);
  }
});

app.get("/feeds", async (req: Request, res: Response) => {
  const selectedFeedId = req.query.fid
    ? parseInt(req.query.fid as string)
    : undefined;

  const selectedFeedCategoryId = req.query.cid
    ? parseInt(req.query.cid as string)
    : undefined;

  let selectedFeedCategory;
  let feeds;
  let selectedFeed;

  if (selectedFeedId !== undefined) {
    selectedFeed = await dataModel.getFeedById(selectedFeedId);

    if (selectedFeed) {
      res.json(selectedFeed);
    } else {
      res.status(404).send({ message: "Feed not found" });
    }
  } else if (selectedFeedCategoryId !== undefined) {
    selectedFeedCategory = await dataModel.getFeedCategoryById(
      selectedFeedCategoryId
    );

    if (selectedFeedCategory) {
      feeds = await dataModel.getFeeds({ selectedFeedCategory });
      pino.trace({ feeds }, "Feeds retrieved for category");
      res.json(feeds);
    } else {
      res.status(404).send({ message: "Feed category not found" });
    }
  } else {
    feeds = await dataModel.getFeeds();
    res.json(feeds);
  }
});

app.delete("/feeds", async (req: Request, res: Response) => {
  const selectedFeedId = req.query.fid
    ? parseInt(req.query.fid as string)
    : undefined;

  if (selectedFeedId) {
    const selectedFeed = await dataModel.getFeedById(selectedFeedId);

    if (selectedFeed) {
      await dataModel.removeFeed(selectedFeedId);
      res.json(true);
    } else {
      res.status(404).send({ message: "Feed not found" });
    }
  } else {
    res.json(false);
  }
});

app.get("/feeds/readstats", async (req: Request, res: Response) => {
  const feedReadStats = await dataModel.getFeedReadStats();

  res.json(feedReadStats);
});

app.put("/feeds", jsonParser, async (req: Request, res: Response) => {
  const result = await dataModel.updateFeed(req.body);

  res.json(result);
});

app.post("/feeds", jsonParser, async (req: Request, res: Response) => {
  try {
    const result = await updater.addFeed(req.body);
    pino.trace({ result }, "Feed added successfully");
    res.json(result);
  } catch (error: any) {
    pino.error({ error: error.message || String(error) }, "Error adding feed");
    res.status(500).json({ error: error.message || String(error) });
  }
});

app.get("/checkfeed", async (req: Request, res: Response) => {
  const feedFinder = new FeedFinder();
  const feedUrl = req.query.url ? (req.query.url as string) : "";
  const feeds = await feedFinder.checkFeed(feedUrl);

  res.json(feeds);
});

app.post("/checkfeedurls", jsonParser, async (req: Request, res: Response) => {
  const checkedFeedsRes = await dataModel.checkFeedUrls(req.body);

  res.json(checkedFeedsRes);
});

app.post("/opml-import", jsonParser, async (req: Request, res: Response) => {
  try {
    pino.debug(req.body, "REQUEST BODY");

    const result = await dataModel.importOpml(req.body);

    res.json(result);
  } catch (error: any) {
    pino.error(
      { error: error.message || String(error) },
      "Error importing OPML"
    );
    res.status(500).json({ error: error.message || "Failed to import OPML" });
  }
});

app.post(
  "/opml-import-start",
  jsonParser,
  async (req: Request, res: Response) => {
    try {
      const jobId = makeOpmlImportJobId();
      opmlImportJobs.set(jobId, {
        status: "running",
        processedFeeds: 0,
        totalFeeds: 0,
        importedFeeds: 0,
      });

      void (async () => {
        try {
          const result = await dataModel.importOpml(req.body, (progress) => {
            const job = opmlImportJobs.get(jobId);
            if (!job) {
              return;
            }

            opmlImportJobs.set(jobId, {
              ...job,
              status: "running",
              processedFeeds: progress.processedFeeds,
              totalFeeds: progress.totalFeeds,
              importedFeeds: progress.processedFeeds,
            });
          });

          opmlImportJobs.set(jobId, {
            status: "completed",
            processedFeeds: result.processedFeeds,
            totalFeeds: result.totalFeeds,
            importedFeeds: result.importedFeeds,
          });
        } catch (error: any) {
          const job = opmlImportJobs.get(jobId);
          opmlImportJobs.set(jobId, {
            status: "failed",
            processedFeeds: job?.processedFeeds || 0,
            totalFeeds: job?.totalFeeds || 0,
            importedFeeds: job?.importedFeeds || 0,
            error: error.message || String(error),
          });
        }
      })();

      res.json({ jobId });
    } catch (error: any) {
      pino.error(
        { error: error.message || String(error) },
        "Error starting OPML import"
      );
      res
        .status(500)
        .json({ error: error.message || "Failed to start OPML import" });
    }
  }
);

app.get("/opml-import-progress", async (req: Request, res: Response) => {
  const jobId = String(req.query.jobId || "");

  if (!jobId) {
    return res.status(400).json({ error: "jobId is required" });
  }

  const job = opmlImportJobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: "OPML import job not found" });
  }

  res.json(job);
});

app.post(
  "/opml-import-preview",
  jsonParser,
  async (req: Request, res: Response) => {
    try {
      const filePath = String(req.body?.filePath || "");
      const opmlUrl = String(req.body?.opmlUrl || "");
      const result = await dataModel.inspectOpmlSource({ filePath, opmlUrl });
      res.json(result);
    } catch (error: any) {
      pino.error(
        { error: error.message || String(error) },
        "Error previewing OPML import"
      );
      res
        .status(500)
        .json({ error: error.message || "Failed to preview OPML" });
    }
  }
);

app.get("/opml-export", async (req: Request, res: Response) => {
  try {
    const opmlContent = await dataModel.exportOpml();
    res.setHeader("Content-Type", "application/xml");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="forest-feeds.opml"'
    );
    res.send(opmlContent);
  } catch (error: any) {
    pino.error(
      { error: error.message || String(error) },
      "Error exporting OPML"
    );
    res.status(500).json({ error: "Failed to export OPML" });
  }
});

// Settings endpoints
app.get("/settings", (req: Request, res: Response) => {
  const settings = settingsManager.getAllSettings();
  res.json(settings);
});

app.get("/settings/:key", (req: Request, res: Response) => {
  const { key } = req.params;
  const value = settingsManager.getSetting(key);

  if (value === undefined) {
    return res.status(404).json({ error: `Setting "${key}" not found` });
  }

  res.json({ [key]: value });
});

app.post("/settings", jsonParser, (req: Request, res: Response) => {
  const { key, value } = req.body;

  if (!key || typeof key !== "string") {
    return res
      .status(400)
      .json({ error: "Setting key is required and must be a string" });
  }

  if (value === undefined || typeof value !== "string") {
    return res
      .status(400)
      .json({ error: "Setting value is required and must be a string" });
  }

  settingsManager.setSetting(key, value);
  res.json({ [key]: value, message: "Setting updated successfully" });
});

app.delete("/settings/:key", (req: Request, res: Response) => {
  const { key } = req.params;
  settingsManager.deleteSetting(key);
  res.json({ message: `Setting "${key}" deleted successfully` });
});

app.post("/api/summarize", jsonParser, async (req: Request, res: Response) => {
  try {
    const { content, format, url } = req.body;

    if (!content) {
      return res.status(400).json({
        error: "Content is required",
        message: "Please provide content to summarize",
      });
    }

    if (!aiService.isConfigured()) {
      return res.status(503).json({
        error: "AI service not configured",
        message:
          "Please set the Gemini API key in settings to use this feature",
      });
    }

    let summary: string | null = null;
    let fromCache = false;

    // Check if summary already exists in database
    if (url) {
      summary = await dataModel.getItemSummary(url);
      if (summary) {
        fromCache = true;
        pino.info({ url }, "Summary retrieved from cache");
      }
    }

    // Generate summary if not cached
    if (!summary) {
      pino.info(
        { contentLength: content.length },
        "Summarizing article content"
      );
      summary = await aiService.summarizeArticle(content);

      // Save summary to database if URL is provided
      if (url) {
        await dataModel.updateItemSummary(url, summary);
      }
    }

    let responseContent = summary;
    if (format === "html" && summary) {
      responseContent = renderMarkdownToHtml(summary);
    }

    res.json({
      summary,
      html: format === "html" ? responseContent : undefined,
      fromCache,
    });
  } catch (error: any) {
    pino.error(
      { error: error.message || String(error) },
      "Error summarizing content"
    );
    res.status(500).json({
      error: "Failed to summarize content",
      message: error.message || String(error),
    });
  }
});

app.post(
  "/api/retrieve-latest",
  jsonParser,
  async (req: Request, res: Response) => {
    try {
      const { url, format } = req.body;

      if (!url) {
        return res.status(400).json({
          error: "URL is required",
          message: "Please provide a URL to retrieve",
        });
      }

      let markdown: string | null = null;
      let fromCache = false;

      // Check if latest content already exists in database
      markdown = await dataModel.getItemLatestContent(url);
      if (markdown) {
        fromCache = true;
        pino.info({ url }, "Latest content retrieved from cache");
      }

      // Fetch latest content if not cached
      if (!markdown) {
        pino.info({ url }, "Retrieving latest article content");
        markdown = await convertArticleToMarkdown(url);

        // Save latest content to database
        await dataModel.updateItemLatestContent(url, markdown);
      }

      let content = markdown;
      if (format === "html" && markdown) {
        content = renderMarkdownToHtml(markdown);
      }

      res.json({
        markdown,
        html: format === "html" ? content : undefined,
        fromCache,
      });
    } catch (error: any) {
      pino.error(
        { error: error.message || String(error) },
        "Error retrieving article content"
      );
      res.status(500).json({
        error: "Failed to retrieve article content",
        message: error.message || String(error),
      });
    }
  }
);

// Google AI Service metrics endpoints
app.get("/api/google-ai/metrics", (req: Request, res: Response) => {
  try {
    const metrics = aiService.getUsageMetrics();
    pino.debug({ metrics }, "Google AI usage metrics retrieved");
    res.json(metrics);
  } catch (error: any) {
    pino.error({ error }, "Failed to get Google AI usage metrics");
    res.status(500).json({
      error: "Failed to retrieve Google AI usage metrics",
      message: error.message || String(error),
    });
  }
});

app.get("/api/google-ai/quota-status", (req: Request, res: Response) => {
  try {
    const quotaStatus = aiService.getQuotaStatus();
    pino.debug(
      { status: quotaStatus.status },
      "Google AI quota status retrieved"
    );
    res.json(quotaStatus);
  } catch (error: any) {
    pino.error({ error }, "Failed to get Google AI quota status");
    res.status(500).json({
      error: "Failed to retrieve Google AI quota status",
      message: error.message || String(error),
    });
  }
});

app.post(
  "/api/google-ai/service-metrics",
  jsonParser,
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.body;

      if (!projectId || typeof projectId !== "string") {
        return res.status(400).json({
          error: "projectId is required",
          message: "Please provide a Google Cloud project ID",
        });
      }

      pino.info({ projectId }, "Fetching Google AI service metrics");
      const serviceMetrics =
        await serviceUsageManager.fetchServiceMetrics(projectId);

      if (!serviceMetrics) {
        return res.status(503).json({
          error: "Service Usage API not available",
          message: "Google Cloud credentials may not be configured",
        });
      }

      res.json(serviceMetrics);
    } catch (error: any) {
      pino.error({ error }, "Failed to fetch Google AI service metrics");
      res.status(500).json({
        error: "Failed to fetch Google AI service metrics",
        message: error.message || String(error),
      });
    }
  }
);

app.use((req: Request, res: Response) => {
  return res.status(404).send({ message: "Not found" });
});

export default class server {
  public static inst: Server;

  public static start(
    config: { tempMode?: boolean; port?: number } = {
      tempMode: false,
      port: projectConfig.dataServerPort,
    }
  ): Promise<Application> {
    return new Promise((resolve) => {
      pino.debug(config, "config");

      server.inst = app.listen(config.port, () => {
        pino.debug(`Server running on port ${config.port}`);

        resolve(app);
      });
    });
  }

  public static stop(): Promise<void> {
    return new Promise((resolve) => {
      pino.debug("Stopping server and disconnecting db");

      const dataDisconnectPromise = dataModel.disconnect();

      const serverDisconnectPromise = new Promise<void>(
        (serverDisconnectResolve) => {
          server.inst.close((error) => {
            if (error) {
              pino.error(error, "Error closing server");
            }

            serverDisconnectResolve();
          });
        }
      );

      Promise.all([dataDisconnectPromise, serverDisconnectPromise]).then(() => {
        resolve();
      });
    });
  }
}
