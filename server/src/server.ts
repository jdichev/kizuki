import { Server } from "net";
import express, { Application, Request, Response } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import pinoLib from "pino";
import MixedDataModel from "./modules/MixedDataModel";
import FeedUpdater from "./modules/FeedUpdater";
import FeedFinder from "./modules/FeedFinder";
import SettingsManager from "./modules/SettingsManager";
import projectConfig from "forestconfig";
import AiService from "./modules/AiService";

const pino = pinoLib({
  level: process.env.LOG_LEVEL || "info",
  name: "server",
});

const dataModel = MixedDataModel.getInstance();

const updater = new FeedUpdater();

const settingsManager = SettingsManager.getInstance();

const app: Application = express();

const jsonParser = bodyParser.json();

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

  const size = req.query.size ? parseInt(req.query.size as string) : undefined;

  const selectedFeedId = req.query.fid
    ? parseInt(req.query.fid as string)
    : undefined;

  const selectedFeedCategoryId = req.query.cid
    ? parseInt(req.query.cid as string)
    : undefined;

  let selectedFeed;
  let selectedFeedCategory;

  if (selectedFeedId !== undefined) {
    selectedFeed = await dataModel.getFeedById(selectedFeedId);
  } else if (selectedFeedCategoryId !== undefined) {
    selectedFeedCategory = await dataModel.getFeedCategoryById(
      selectedFeedCategoryId
    );
  }

  const items = await dataModel.getItems({
    unreadOnly,
    size,
    selectedFeed,
    selectedFeedCategory,
    order: "published",
  });
  res.json(items);
});

app.get("/groups", async (req: Request, res: Response) => {
  const unreadOnly = req.query.unread ? req.query.unread === "true" : false;

  const size = req.query.size ? parseInt(req.query.size as string) : undefined;

  const selectedFeedId = req.query.fid
    ? parseInt(req.query.fid as string)
    : undefined;

  const selectedFeedCategoryId = req.query.cid
    ? parseInt(req.query.cid as string)
    : undefined;

  let selectedFeed;
  let selectedFeedCategory;

  if (selectedFeedId !== undefined) {
    selectedFeed = await dataModel.getFeedById(selectedFeedId);
  } else if (selectedFeedCategoryId !== undefined) {
    selectedFeedCategory = await dataModel.getFeedCategoryById(
      selectedFeedCategoryId
    );
  }

  const items = await dataModel.getItems({
    unreadOnly,
    size,
    selectedFeed,
    selectedFeedCategory,
    order: "published",
  });

  const aiService = AiService.getInstance();

  const preparedItems = aiService.prepareItemsPrompt(items);
  pino.trace({ preparedItems }, "Prepared items for AI service");

  const finalPrompt = `
  You are a categorization agent. What follows is a list of article IDs and article titles.
  Group the list by generated category and generate a new list that looks like this:
  <AI generated category name>: <article id>, <article id>
  <AI generated category name>: <article id>, <article id>, <article id>

  The article list is below:
  ${preparedItems}
  `;

  const aiResponse = await aiService.generateContent(finalPrompt);
  pino.trace({ aiResponse }, "AI response for grouping items");

  const groups = aiService.parseAiGroupsResponse(aiResponse, items);

  res.json(groups);
});

app.get("/items/:itemId", async (req: Request, res: Response) => {
  const item = await dataModel.getItemById(parseInt(req.params.itemId));

  res.json(item);
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

app.get("/itemsread", async (req: Request, res: Response) => {
  const selectedFeedId = req.query.fid
    ? parseInt(req.query.fid as string)
    : undefined;

  const selectedFeedCategoryId = req.query.cid
    ? parseInt(req.query.cid as string)
    : undefined;

  if (selectedFeedId !== undefined) {
    const feed = await dataModel.getFeedById(selectedFeedId);

    if (feed) {
      const result = await dataModel.markItemsRead({ feed: feed });
      res.json(result);
    } else {
      res.json({ message: "Category not found" });
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
      res.json({ message: "Category not found" });
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
  pino.debug(req.body, "REQUEST BODY");

  const result = await dataModel.importOpml(req.body);

  res.json(result);
});

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
