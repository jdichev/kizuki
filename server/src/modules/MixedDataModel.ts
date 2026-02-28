import fs from "fs";
import os from "os";
import path from "path";
import DOMPurify from "dompurify";
import Database from "better-sqlite3";
import { JSDOM } from "jsdom";
import pinoLib from "pino";
import opmlParser from "./OpmlParser";
import FeedFinder from "./FeedFinder";

const pino = pinoLib({
  level: process.env.LOG_LEVEL || "info",
  name: "MixedDataModel",
});

const { window } = new JSDOM("<!DOCTYPE html>");

// @ts-ignore
const domPurify = DOMPurify(window);

const createTables = `
CREATE TABLE IF NOT EXISTS "feed_categories" (
	"id"	INTEGER NOT NULL UNIQUE,
	"title"	TEXT NOT NULL,
	"text"	TEXT,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "feeds" (
	"id"	INTEGER NOT NULL UNIQUE,
	"title"	TEXT,
	"url"	TEXT,
	"feedUrl"	TEXT,
	"feedType"	TEXT,
	"error"	INTEGER DEFAULT 0,
	"feedCategoryId"	INTEGER DEFAULT 0,
	"updateFrequency"	INTEGER DEFAULT 0,
	PRIMARY KEY("id" AUTOINCREMENT)
);

CREATE TABLE IF NOT EXISTS "item_categories" (
  "id"	INTEGER NOT NULL UNIQUE,
  "title"	TEXT NOT NULL,
	"text"	TEXT,
  PRIMARY KEY("id" AUTOINCREMENT)
);

CREATE TABLE IF NOT EXISTS "items" (
	"id"	INTEGER NOT NULL UNIQUE,
	"url"	TEXT NOT NULL UNIQUE,
	"title"	TEXT NOT NULL,
	"content"	TEXT,
	"feed_id"	INTEGER NOT NULL DEFAULT 0,
	"published"	INTEGER NOT NULL DEFAULT 0,
	"comments"	TEXT,
	"read"	INTEGER NOT NULL DEFAULT 0,
	"bookmarked"	INTEGER NOT NULL DEFAULT 0,
	"created"	INTEGER,
	"json_content"	TEXT,
	"itemCategoryId"	INTEGER DEFAULT 0,
	"summary"	TEXT,
	"latest_content"	TEXT,
	PRIMARY KEY("id" AUTOINCREMENT)
);
`;

const seedData = `
INSERT OR IGNORE INTO feed_categories (id, title, text)
VALUES (0, 'Uncategorized', 'Uncategorized');

INSERT OR IGNORE INTO item_categories (id, title, text) VALUES
-- General News & Lifestyle (0-99)
(0, 'Uncategorized', 'General content that does not fit into specific categories.'),
(1, 'Politics & Government', 'Local, national, and international political news, policy, and elections.'),
(2, 'Business & Finance', 'Markets, economy, personal finance, startups, and corporate news.'),
(3, 'Science & Environment', 'Natural sciences, space, climate change, and sustainability.'),
(4, 'Health & Wellness', 'Medicine, mental health, fitness, nutrition, and medical research.'),
(5, 'Sports', 'Professional and amateur sports, athlete profiles, and game coverage.'),
(6, 'Entertainment & Arts', 'Movies, music, television, theater, and fine arts.'),
(7, 'Lifestyle & Fashion', 'Trends, clothing, home decor, and personal style.'),
(8, 'Travel & Tourism', 'Destinations, hospitality, aviation, and travel tips.'),
(9, 'Food & Drink', 'Recipes, restaurants, cooking techniques, and beverage reviews.'),
(10, 'Education', 'Schools, universities, pedagogy, and lifelong learning.'),
(11, 'Society & Culture', 'Social issues, human rights, religion, and cultural commentary.'),
(12, 'Automotive', 'Cars, motorcycles, electric vehicles, and transportation tech.'),
(13, 'Real Estate', 'Property markets, architecture, and urban development.'),
(14, 'Law & Justice', 'Legal news, court cases, crime, and civil rights.'),
(15, 'Parenting & Family', 'Childcare, family dynamics, and youth development.'),
(16, 'Opinion & Editorial', 'Op-eds, columns, and subjective commentary.'),
(17, 'Hobbies & Interests', 'Niche pursuits like gardening, crafting, or collecting.'),

-- AI & Data Science (100-199)
(100, 'Artificial Intelligence', 'General AI news, research, and industry trends.'),
(101, 'Machine Learning', 'Algorithms, supervised/unsupervised learning, and model training.'),
(102, 'Generative AI & LLMs', 'Large Language Models, image generation, and creative AI tools.'),
(103, 'Computer Vision', 'Image recognition, spatial computing, and visual data processing.'),
(104, 'Data Science & Big Data', 'Data engineering, analytics, and large-scale data processing.'),

-- Software Engineering (200-299)
(200, 'Software Development', 'General software engineering practices and methodologies.'),
(201, 'Web Development', 'Frontend and backend web technologies (React, Node, etc.).'),
(202, 'Mobile Development', 'iOS, Android, and cross-platform mobile frameworks.'),
(203, 'DevOps & CI/CD', 'Automation, deployment pipelines, and developer operations.'),
(204, 'Game Development', 'Game engines (Unity, Unreal), physics, and interactive design.'),
(205, 'Embedded Systems', 'Programming for microcontrollers and specialized hardware.'),
(206, 'Open Source', 'Community-driven software, licensing, and public repositories.'),

-- Infrastructure & Security (300-499)
(300, 'Cloud Computing', 'AWS, Azure, Google Cloud, and serverless architectures.'),
(301, 'Networking & 5G', 'Telecommunications, network protocols, and 5G/6G tech.'),
(302, 'Blockchain & Web3', 'Distributed ledgers, smart contracts, and decentralized tech.'),
(400, 'Cybersecurity', 'General security news, threat intelligence, and defense.'),
(401, 'Hacking & Vulnerabilities', 'Penetration testing, exploits, and security research.'),
(402, 'Cryptography', 'Encryption standards, privacy tech, and secure communication.'),

-- Hardware & Consumer Tech (500-699)
(500, 'Hardware & Components', 'General PC hardware, peripherals, and components.'),
(501, 'Semiconductors & Chips', 'CPUs, GPUs, fabrication (TSMC, Intel), and architecture.'),
(502, 'Quantum Computing', 'Next-gen computing using quantum mechanics.'),
(503, 'Robotics & Automation', 'Industrial robots, drones, and autonomous systems.'),
(600, 'Consumer Electronics', 'Smartphones, laptops, and smart home devices.'),
(601, 'AR / VR / XR', 'Augmented, Virtual, and Mixed Reality hardware/software.'),
(602, 'Wearables', 'Smartwatches, health trackers, and hearables.'),
(603, 'Space Tech', 'Satellite technology, rocket engineering, and space exploration.');
`;

// main data service
export default class DataService {
  private static instance: DataService;

  private database!: Database.Database;
  private ftsReady: boolean = false;
  private static readonly FTS_VERSION = "unicode61-2";

  private static parseSearchQuery(searchQuery: string): {
    scope: "all" | "title" | "desc";
    term: string;
  } {
    const normalizedQuery = searchQuery.normalize("NFKC").trim();
    const prefixedQueryMatch = normalizedQuery.match(
      /^(title|desc)\s*:\s*(.*)$/i
    );

    if (!prefixedQueryMatch) {
      return {
        scope: "all",
        term: normalizedQuery,
      };
    }

    return {
      scope: prefixedQueryMatch[1].toLowerCase() === "title" ? "title" : "desc",
      term: prefixedQueryMatch[2].trim(),
    };
  }

  private static buildFtsQuery(
    searchQuery: string,
    scope: "all" | "title" | "desc" = "all"
  ): string {
    const tokens = searchQuery
      .normalize("NFKC")
      .trim()
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 0)
      .map((token) => `"${token.replace(/"/g, '""')}"*`);

    if (tokens.length === 0) {
      return "";
    }

    const tokenQuery = tokens.join(" AND ");

    if (scope === "title") {
      return `{title} : ${tokenQuery}`;
    }

    if (scope === "desc") {
      return `{content summary latest_content} : ${tokenQuery}`;
    }

    return tokenQuery;
  }

  constructor() {
    const tempInstance = process.env.NODE_ENV === "test";
    const storageDir = tempInstance
      ? path.join(os.tmpdir(), ".forest-temp")
      : path.join(os.homedir(), ".forest");

    const dbFileName = "feeds.db";

    const dbPath = path.join(storageDir, dbFileName);

    pino.debug({ dbPath }, "Database path");

    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    try {
      this.database = new Database(dbPath);

      const pragmaSettings = `
        pragma journal_mode = WAL;
        pragma synchronous = off;
        pragma temp_store = memory;
        pragma mmap_size = 30000000000;
      `;

      this.database.exec(pragmaSettings);
      pino.debug("pragma settings executed");

      // Create tables (safe due to IF NOT EXISTS)
      this.database.exec(createTables);
      pino.debug("tables created");

      // Seed default data (safe due to INSERT OR IGNORE)
      this.database.exec(seedData);
      pino.debug("data seeded");

      // Run migrations for new columns
      this.runMigrations();

      pino.debug(
        `Database initialized in mode ${tempInstance ? "temp" : "not-temp"}`
      );
    } catch (err) {
      pino.error({ err }, "Database opening or initialization error");
    }
  }

  public async disconnect(): Promise<void> {
    try {
      this.database.close();
    } catch (error) {
      pino.error(error, "Error closing database");
    }
  }

  public static getInstance(): DataService {
    if (this.instance === undefined) {
      this.instance = new DataService();
    }

    return this.instance;
  }

  private runMigrations(): void {
    // Migration: Add summary column if it doesn't exist
    const addSummaryColumn = `
      ALTER TABLE items ADD COLUMN summary TEXT;
    `;

    // Migration: Add latest_content column if it doesn't exist
    const addLatestContentColumn = `
      ALTER TABLE items ADD COLUMN latest_content TEXT;
    `;

    const ensureItemsFts = `
      CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
        title,
        content,
        summary,
        latest_content,
        content='items',
        content_rowid='id',
        tokenize='unicode61 remove_diacritics 2'
      );

      CREATE TRIGGER IF NOT EXISTS items_ai AFTER INSERT ON items BEGIN
        INSERT INTO items_fts(rowid, title, content, summary, latest_content)
        VALUES (new.id, new.title, new.content, new.summary, new.latest_content);
      END;

      CREATE TRIGGER IF NOT EXISTS items_ad AFTER DELETE ON items BEGIN
        INSERT INTO items_fts(items_fts, rowid, title, content, summary, latest_content)
        VALUES('delete', old.id, old.title, old.content, old.summary, old.latest_content);
      END;

      CREATE TRIGGER IF NOT EXISTS items_au AFTER UPDATE ON items BEGIN
        INSERT INTO items_fts(items_fts, rowid, title, content, summary, latest_content)
        VALUES('delete', old.id, old.title, old.content, old.summary, old.latest_content);
        INSERT INTO items_fts(rowid, title, content, summary, latest_content)
        VALUES (new.id, new.title, new.content, new.summary, new.latest_content);
      END;
    `;

    const rebuildItemsFts = `
      DROP TRIGGER IF EXISTS items_ai;
      DROP TRIGGER IF EXISTS items_ad;
      DROP TRIGGER IF EXISTS items_au;
      DROP TABLE IF EXISTS items_fts;

      CREATE VIRTUAL TABLE items_fts USING fts5(
        title,
        content,
        summary,
        latest_content,
        content='items',
        content_rowid='id',
        tokenize='unicode61 remove_diacritics 2'
      );

      CREATE TRIGGER items_ai AFTER INSERT ON items BEGIN
        INSERT INTO items_fts(rowid, title, content, summary, latest_content)
        VALUES (new.id, new.title, new.content, new.summary, new.latest_content);
      END;

      CREATE TRIGGER items_ad AFTER DELETE ON items BEGIN
        INSERT INTO items_fts(items_fts, rowid, title, content, summary, latest_content)
        VALUES('delete', old.id, old.title, old.content, old.summary, old.latest_content);
      END;

      CREATE TRIGGER items_au AFTER UPDATE ON items BEGIN
        INSERT INTO items_fts(items_fts, rowid, title, content, summary, latest_content)
        VALUES('delete', old.id, old.title, old.content, old.summary, old.latest_content);
        INSERT INTO items_fts(rowid, title, content, summary, latest_content)
        VALUES (new.id, new.title, new.content, new.summary, new.latest_content);
      END;

      INSERT INTO items_fts(items_fts) VALUES('rebuild');
    `;

    // Try to add summary column (will fail silently if it already exists)
    try {
      this.database.exec(addSummaryColumn);
      pino.info("Added summary column to items table");
    } catch (error: any) {
      if (!error.message.includes("duplicate column")) {
        pino.debug("Summary column might already exist or migration skipped");
      }
    }

    // Try to add latest_content column (will fail silently if it already exists)
    try {
      this.database.exec(addLatestContentColumn);
      pino.info("Added latest_content column to items table");
    } catch (error: any) {
      if (!error.message.includes("duplicate column")) {
        pino.debug(
          "Latest_content column might already exist or migration skipped"
        );
      }
    }

    try {
      const createMetaTable = `
        CREATE TABLE IF NOT EXISTS app_meta (
          key TEXT PRIMARY KEY,
          value TEXT
        );
      `;

      this.database.exec(createMetaTable);

      const row = this.database
        .prepare(`SELECT value FROM app_meta WHERE key = 'fts_version'`)
        .get() as { value?: string } | undefined;

      const currentVersion = row?.value;
      const shouldRebuild = !currentVersion || currentVersion !== DataService.FTS_VERSION;

      const execSql = shouldRebuild ? rebuildItemsFts : ensureItemsFts;

      this.database.exec(execSql);

      if (shouldRebuild) {
        this.database
          .prepare(
            `INSERT INTO app_meta (key, value)
             VALUES ('fts_version', ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value;`
          )
          .run(DataService.FTS_VERSION);
      }

      this.ftsReady = true;
      if (shouldRebuild) {
        pino.info("FTS rebuilt for items search");
      } else {
        pino.info("FTS ensured for items search");
      }
    } catch (error: any) {
      this.ftsReady = false;
      pino.warn(
        { error: error.message },
        "FTS setup failed; falling back to non-FTS text search"
      );
    }
  }

  public async getFeedByUrl(feedUrl: string): Promise<Feed> {
    const query = `
      SELECT
        *
      FROM
        feeds
      WHERE
        feedUrl = ?
    `;

    try {
      const row = this.database.prepare(query).get(feedUrl);
      return row as Feed;
    } catch (error) {
      pino.error(error);
      throw error;
    }
  }

  public async getFeedById(feedId: number): Promise<Feed> {
    const query = `
      SELECT
        *
      FROM
        feeds
      WHERE
        id = ?
    `;

    try {
      const row = this.database.prepare(query).get(feedId);
      return row as Feed;
    } catch (error) {
      pino.error(error);
      throw error;
    }
  }

  public async getFeeds(
    params: {
      selectedFeedCategory?: FeedCategory | undefined;
    } = { selectedFeedCategory: undefined }
  ): Promise<Feed[]> {
    let query = `
      SELECT
        feeds.id,
        feeds.title,
        feeds.url,
        feeds.feedUrl,
        feeds.feedType,
        feeds.feedCategoryId,
        feeds.error,
        feeds.updateFrequency,
        feed_categories.title as categoryTitle,
        count(items.feed_id) as itemsCount
      FROM
        feeds
      LEFT JOIN feed_categories ON
        feed_categories.id = feeds.feedCategoryId
      LEFT JOIN
        items
      ON
        items.feed_id = feeds.id
      __WHERE_PLACEHOLDER__
      GROUP BY
        feeds.id
    `;

    if (params.selectedFeedCategory) {
      const whereQuery = `
        WHERE
        feeds.feedCategoryId = ${params.selectedFeedCategory.id}
      `;
      query = query.replace("__WHERE_PLACEHOLDER__", whereQuery);
    } else {
      query = query.replace("__WHERE_PLACEHOLDER__", "");
    }

    try {
      const rows = this.database.prepare(query).all();
      return (rows as Feed[]) || [];
    } catch (err) {
      pino.error(err);
      return [];
    }
  }

  public async removeFeeds(): Promise<void> {
    try {
      this.database.transaction(() => {
        this.database.prepare("DELETE FROM items").run();
        this.database.prepare("DELETE FROM feeds").run();
      })();
      pino.debug("removed feeds and related items");
    } catch (error) {
      pino.error(error);
      throw error;
    }
  }

  public async removeFeed(feedId: number): Promise<void> {
    try {
      this.database.transaction(() => {
        this.database.prepare("DELETE FROM items WHERE feed_id = ?").run(feedId);
        this.database.prepare("DELETE FROM feeds WHERE id = ?").run(feedId);
      })();
      pino.debug(`removed feed ${feedId} and related items`);
    } catch (error) {
      pino.error(error);
      throw error;
    }
  }

  private async feedExists(feed: Feed) {
    const query = `
      SELECT id FROM feeds
      WHERE feedUrl = ?
    `;

    try {
      return this.database.prepare(query).get(feed.feedUrl);
    } catch (error) {
      pino.error(error);
      return undefined;
    }
  }

  public async updateFeed(feed: Feed): Promise<boolean> {
    const query = `
      UPDATE feeds
      SET
        title = ?,
        feedCategoryId = ?,
        feedUrl = ?
      WHERE
        id = ?
    `;

    try {
      this.database
        .prepare(query)
        .run(feed.title, feed.feedCategoryId, feed.feedUrl, feed.id);
      pino.debug("feed updated %o", feed);
      return true;
    } catch (error) {
      pino.error(error);
      return false;
    }
  }

  public async insertFeed(feed: Feed) {
    pino.debug(feed, "input for insert feed");

    const query = `
      INSERT INTO feeds (title, url, feedUrl, feedType, feedCategoryId)
      VALUES( ?, ?, ?, ?, ? );
    `;

    const feedExist = await this.feedExists(feed);

    if (feedExist) {
      pino.debug("Feed already exists");

      return;
    }

    let categoryId: number;

    if (feed.feedCategoryId !== undefined && feed.feedCategoryId > 0) {
      // Use provided feedCategoryId directly (set during OPML import)
      categoryId = feed.feedCategoryId;
    } else {
      // Fallback: lookup category by title
      const feedCategories = await this.getFeedCategories();

      const relatedCategory = feedCategories.find((feedCategory) => {
        return feedCategory.title === feed.categoryTitle;
      });

      categoryId = relatedCategory?.id ?? 0;
    }

    pino.debug("Category id: %s", categoryId);

    try {
      this.database
        .prepare(query)
        .run(feed.title, feed.url, feed.feedUrl, feed.feedType, categoryId);
      pino.debug(feed, "feed added");
    } catch (error) {
      pino.error(error);
    }
  }

  public async checkFeedUrls(urls: string[]): Promise<string[]> {
    if (urls.length === 0) return [];
    const placeholders = urls.map(() => "?").join(", ");
    const query = `
      SELECT feedUrl
      FROM feeds
      WHERE
        feedUrl IN (${placeholders})
    `;

    try {
      const rows = this.database.prepare(query).all(urls) as { feedUrl: string }[];
      return rows.map((record) => record.feedUrl);
    } catch (error) {
      pino.error(error);
      return [];
    }
  }

  public async getFeedReadStats(): Promise<FeedReadStat[]> {
    const query = `
      SELECT
        feeds.id,
        feeds.title,
        count(items.feed_id) as unreadCount
      FROM
        feeds
      LEFT JOIN
        items
      ON
        items.feed_id = feeds.id
      WHERE
        items.read = 0
      GROUP BY
        feeds.id
    `;

    try {
      const rows = this.database.prepare(query).all();
      return (rows as FeedReadStat[]) || [];
    } catch (error) {
      pino.error(error);
      return [];
    }
  }

  public async removeFeedCategory(
    feedCategory: FeedCategory
  ): Promise<boolean> {
    try {
      this.database.transaction(() => {
        this.database
          .prepare("UPDATE feeds SET feedCategoryId = 0 WHERE feedCategoryId = ?")
          .run(feedCategory.id);
        this.database
          .prepare("DELETE FROM feed_categories WHERE id = ?")
          .run(feedCategory.id);
      })();

      pino.debug(`removed category ${feedCategory.title} and assigned items
        to default category`);

      return true;
    } catch (error) {
      pino.error(error);
      return false;
    }
  }

  public async getFeedCategoryReadStats(): Promise<FeedCategoryReadStat[]> {
    const query = `
      SELECT
        feed_categories.id,
        feed_categories.title,
        count(items.feed_id) as unreadCount
      FROM
        feed_categories
      LEFT JOIN
        feeds
      ON
        feeds.feedCategoryId = feed_categories.id
      LEFT JOIN
        items
      ON
        items.feed_id = feeds.id
      WHERE
        items.read = 0
      GROUP BY
        feed_categories.id
    `;

    try {
      const rows = this.database.prepare(query).all();
      return (rows as FeedCategoryReadStat[]) || [];
    } catch (error) {
      pino.error(error);
      return [];
    }
  }

  public async getItemCategoryReadStats(): Promise<ItemCategoryReadStat[]> {
    const query = `
      SELECT
        item_categories.id,
        item_categories.title,
        count(items.itemCategoryId) as unreadCount
      FROM
        item_categories
      LEFT JOIN
        items
      ON
        items.itemCategoryId = item_categories.id
      WHERE
        items.read = 0
      GROUP BY
        item_categories.id
    `;

    try {
      const rows = this.database.prepare(query).all();
      return (rows as ItemCategoryReadStat[]) || [];
    } catch (error) {
      pino.error(error);
      return [];
    }
  }

  public async getFeedCategoryById(
    feedCategoryId: number
  ): Promise<FeedCategory | undefined> {
    const query = `
      SELECT *
      FROM feed_categories
      WHERE id = ?
    `;

    try {
      const row = this.database.prepare(query).get(feedCategoryId);
      return (row as FeedCategory) || undefined;
    } catch (error) {
      pino.error(error);
      return undefined;
    }
  }

  public async getFeedCategories(): Promise<FeedCategory[]> {
    const query = `
      SELECT id, title
      FROM feed_categories
    `;

    try {
      const rows = this.database.prepare(query).all();
      return (rows as FeedCategory[]) || [];
    } catch (error) {
      pino.error(error);
      return [];
    }
  }

  private async feedCategoryExists(feedCategory: FeedCategory) {
    const query = `
      SELECT id FROM feed_categories
      WHERE title = ?
    `;

    try {
      return this.database.prepare(query).get(feedCategory.title);
    } catch (error) {
      pino.error(error);
      return undefined;
    }
  }

  public async insertFeedCategory(
    feedCategory: FeedCategory
  ): Promise<boolean> {
    const query = `
      INSERT INTO feed_categories (title, text)
      VALUES( ?, ? );
    `;

    pino.debug(feedCategory);

    const exist = await this.feedCategoryExists(feedCategory);

    if (exist) {
      return false;
    }

    try {
      this.database.prepare(query).run(feedCategory.title, feedCategory.text);
      return true;
    } catch (error) {
      pino.error(error);
      return false;
    }
  }

  public async updateFeedCategory(
    feedCategory: FeedCategory
  ): Promise<boolean> {
    const query = `
      UPDATE feed_categories
      SET title = ?, text = ?
      WHERE id = ?;
    `;

    const exist = await this.feedCategoryExists(feedCategory);

    if (exist) {
      return false;
    }

    try {
      this.database
        .prepare(query)
        .run(feedCategory.title, feedCategory.text, feedCategory.id);
      return true;
    } catch (error) {
      pino.error(error);
      return false;
    }
  }

  public async importOpml(
    options: {
      filePath?: string;
      fileContent?: string;
      opmlUrl?: string;
      targetCategoryId?: number;
    },
    onProgress?: (progress: {
      processedFeeds: number;
      totalFeeds: number;
    }) => void
  ): Promise<{
    processedFeeds: number;
    totalFeeds: number;
    importedFeeds: number;
  }> {
    let opmlContent: string;
    let targetCategoryId: number | undefined;

    if (options.targetCategoryId !== undefined) {
      const parsedTargetCategoryId = Number(options.targetCategoryId);
      if (!Number.isInteger(parsedTargetCategoryId)) {
        throw new Error("Invalid targetCategoryId");
      }

      const targetCategory = await this.getFeedCategoryById(
        parsedTargetCategoryId
      );

      if (!targetCategory) {
        throw new Error("Target category does not exist");
      }

      targetCategoryId = parsedTargetCategoryId;
    }

    if (options.filePath) {
      // Electron path: read from file system
      opmlContent = fs.readFileSync(options.filePath, "utf-8");
    } else if (options.fileContent) {
      // Browser: use content directly
      opmlContent = options.fileContent;
    } else if (options.opmlUrl) {
      const response = await fetch(options.opmlUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch OPML URL: ${response.status}`);
      }

      opmlContent = await response.text();
    } else {
      throw new Error(
        "One of filePath, fileContent, or opmlUrl must be provided"
      );
    }

    const opmlData = opmlParser.load(opmlContent);
    const totalFeeds = opmlData.feeds.length;
    let processedFeeds = 0;
    let importedFeeds = 0;
    const feedFinder = new FeedFinder();
    const existingFeeds = await this.getFeeds();
    const existingFeedUrls = new Set(
      existingFeeds
        .map((existingFeed) => existingFeed.feedUrl)
        .filter((feedUrl): feedUrl is string => !!feedUrl)
    );
    const opmlSeenFeedUrls = new Set<string>();

    if (onProgress) {
      onProgress({ processedFeeds, totalFeeds });
    }

    pino.debug({ categories: opmlData.categories }, "OPML categories");

    const categoryTitleToIdMap = new Map<string, number>();
    if (targetCategoryId === undefined) {
      // Insert all categories in parallel
      await Promise.all(
        opmlData.categories.map(
          async (feedCategory: { text?: string; title?: string }) => {
            if (!feedCategory.title && !feedCategory.text) {
              return;
            }

            pino.debug(
              { feedCategory },
              "Inserting feed category from OPML import"
            );

            await this.insertFeedCategory({
              title: feedCategory.title ?? "NO_TITLE",
              text: feedCategory.text ?? "NO_TEXT",
            });
          }
        )
      );

      // Create a mapping of category titles to IDs
      const allCategories = await this.getFeedCategories();
      allCategories.forEach((category) => {
        categoryTitleToIdMap.set(category.title, category.id ?? 0);
      });
    }

    pino.debug({ feeds: opmlData.feeds }, "OPML Feeds");
    for (const feed of opmlData.feeds) {
      const feedUrl = String(feed.feedUrl || "").trim();

      if (
        !feedUrl ||
        existingFeedUrls.has(feedUrl) ||
        opmlSeenFeedUrls.has(feedUrl)
      ) {
        processedFeeds += 1;
        if (onProgress) {
          onProgress({ processedFeeds, totalFeeds });
        }
        continue;
      }

      opmlSeenFeedUrls.add(feedUrl);
      pino.debug(feed);
      // @ts-ignore
      const feedRes = await feedFinder.checkFeed(feedUrl);
      if (feedRes.length) {
        const feedToInsert = feedRes[0];
        if (targetCategoryId !== undefined) {
          feedToInsert.feedCategoryId = targetCategoryId;
        } else if (feed.categoryTitle) {
          // Use the category ID mapping to set the feedCategoryId directly
          feedToInsert.feedCategoryId =
            categoryTitleToIdMap.get(feed.categoryTitle) || 0;
        }
        await this.insertFeed(feedToInsert);
        existingFeedUrls.add(feedUrl);
        importedFeeds += 1;
      }
      processedFeeds += 1;
      if (onProgress) {
        onProgress({ processedFeeds, totalFeeds });
      }
      // else {
      //   // @ts-ignore
      //   const feedRes2 = await feedFinder.checkFeed(feed.url);
      //   if (feedRes2.length) {
      //     await this.insertFeed(feedRes2[0]);
      //   }
      // }
    }

    pino.info("Imported %d feeds", opmlData.feeds.length);

    return {
      processedFeeds,
      totalFeeds,
      importedFeeds,
    };
  }

  public async inspectOpmlSource(options: {
    filePath?: string;
    opmlUrl?: string;
  }): Promise<{
    sourceExists: boolean;
    isValid: boolean;
    feedsCount: number;
    categoriesCount: number;
    newFeedsCount: number;
    error?: string;
  }> {
    const normalizedFilePath = (options.filePath || "").trim();
    const normalizedOpmlUrl = (options.opmlUrl || "").trim();

    if (!normalizedFilePath && !normalizedOpmlUrl) {
      return {
        sourceExists: false,
        isValid: false,
        feedsCount: 0,
        categoriesCount: 0,
        newFeedsCount: 0,
        error: "filePath or opmlUrl is required",
      };
    }

    try {
      let opmlContent = "";

      if (normalizedFilePath) {
        if (!fs.existsSync(normalizedFilePath)) {
          return {
            sourceExists: false,
            isValid: false,
            feedsCount: 0,
            categoriesCount: 0,
            newFeedsCount: 0,
            error: "File does not exist",
          };
        }

        opmlContent = fs.readFileSync(normalizedFilePath, "utf-8");
      } else {
        const response = await fetch(normalizedOpmlUrl);
        if (!response.ok) {
          return {
            sourceExists: false,
            isValid: false,
            feedsCount: 0,
            categoriesCount: 0,
            newFeedsCount: 0,
            error: `Failed to fetch OPML URL: ${response.status}`,
          };
        }

        opmlContent = await response.text();
      }

      const opmlData = opmlParser.load(opmlContent);
      const existingFeeds = await this.getFeeds();
      const existingFeedUrls = new Set(
        existingFeeds
          .map((feed) => feed.feedUrl)
          .filter((feedUrl): feedUrl is string => !!feedUrl)
      );

      const newFeedsCount = opmlData.feeds.filter((feed) => {
        return !!feed.feedUrl && !existingFeedUrls.has(feed.feedUrl);
      }).length;

      return {
        sourceExists: true,
        isValid: true,
        feedsCount: opmlData.feeds.length,
        categoriesCount: opmlData.categories.length,
        newFeedsCount,
      };
    } catch (error: any) {
      return {
        sourceExists: true,
        isValid: false,
        feedsCount: 0,
        categoriesCount: 0,
        newFeedsCount: 0,
        error: error.message || "Invalid OPML file",
      };
    }
  }

  private async getFeedIds(feedCategory: FeedCategory): Promise<number[]> {
    const query = `
      SELECT id FROM feeds
      WHERE feedCategoryId = ?
    `;

    try {
      const rows = this.database.prepare(query).all(feedCategory.id) as Feed[];
      return rows.map((feed) => feed.id as number);
    } catch (error) {
      pino.error(error);
      return [];
    }
  }

  // Item Categories Methods
  public async getItemCategories(): Promise<Category[]> {
    const query = `
      SELECT id, title, text
      FROM item_categories
    `;

    try {
      const rows = this.database.prepare(query).all();
      return (rows as Category[]) || [];
    } catch (error) {
      pino.error(error);
      return [];
    }
  }

  private async itemCategoryExists(itemCategory: Category) {
    const query = `
      SELECT id FROM item_categories
      WHERE title = ?
    `;

    try {
      return this.database.prepare(query).get(itemCategory.title);
    } catch (error) {
      pino.error(error);
      return undefined;
    }
  }

  public async insertItemCategory(itemCategory: Category): Promise<boolean> {
    const query = `
      INSERT INTO item_categories (title, text)
      VALUES( ?, ? );
    `;

    pino.debug(itemCategory);

    const exist = await this.itemCategoryExists(itemCategory);

    if (exist) {
      return false;
    }

    try {
      this.database.prepare(query).run(itemCategory.title, itemCategory.text);
      return true;
    } catch (error) {
      pino.error(error);
      return false;
    }
  }

  public async updateItemCategory(itemCategory: Category): Promise<boolean> {
    const query = `
      UPDATE item_categories
      SET title = ?, text = ?
      WHERE id = ?
    `;

    pino.debug(itemCategory);

    try {
      this.database
        .prepare(query)
        .run(itemCategory.title, itemCategory.text, itemCategory.id);
      return true;
    } catch (error) {
      pino.error(error);
      return false;
    }
  }

  public async deleteItemCategory(itemCategoryId: number): Promise<boolean> {
    const query = `
      DELETE FROM item_categories
      WHERE id = ?
    `;

    try {
      this.database.prepare(query).run(itemCategoryId);
      return true;
    } catch (error) {
      pino.error(error);
      return false;
    }
  }

  public async getItemCategoryById(
    itemCategoryId: number
  ): Promise<Category | null> {
    const query = `
      SELECT id, title, text
      FROM item_categories
      WHERE id = ?
    `;

    try {
      const row = this.database.prepare(query).get(itemCategoryId);
      return (row as Category) || null;
    } catch (error) {
      pino.error(error);
      return null;
    }
  }

  public async exportOpml(): Promise<string> {
    const categories = await this.getFeedCategories();
    const feeds = await this.getFeeds();

    // Build OPML structure
    const opmlLines: string[] = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<opml version="2.0">',
      "  <head>",
      "    <title>Forest Feeds</title>",
      "  </head>",
      "  <body>",
    ];

    // Group feeds by category
    const feedsByCategory: { [key: number]: Feed[] } = {};
    const uncategorizedFeeds: Feed[] = [];

    feeds.forEach((feed: Feed) => {
      if (feed.feedCategoryId === null || feed.feedCategoryId === undefined) {
        uncategorizedFeeds.push(feed);
      } else {
        if (!feedsByCategory[feed.feedCategoryId]) {
          feedsByCategory[feed.feedCategoryId] = [];
        }
        feedsByCategory[feed.feedCategoryId].push(feed);
      }
    });

    // Add uncategorized feeds
    uncategorizedFeeds.forEach((feed: Feed) => {
      opmlLines.push(
        `    <outline type="rss" text="${this.escapeXml(feed.title)}" xmlUrl="${this.escapeXml(feed.feedUrl)}" />`
      );
    });

    // Add categorized feeds
    categories.forEach((category: FeedCategory) => {
      if (category.id === undefined) return; // Skip if no id
      opmlLines.push(
        `    <outline text="${this.escapeXml(category.title)}" type="category">`
      );
      if (feedsByCategory[category.id]) {
        feedsByCategory[category.id].forEach((feed: Feed) => {
          opmlLines.push(
            `      <outline type="rss" text="${this.escapeXml(feed.title)}" xmlUrl="${this.escapeXml(feed.feedUrl)}" />`
          );
        });
      }
      opmlLines.push("    </outline>");
    });

    opmlLines.push("  </body>", "</opml>");

    return opmlLines.join("\n");
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  public async markItemsRead(params: {
    feedCategory?: FeedCategory;
    feed?: Feed;
    itemCategories?: Category[];
  }) {
    let query = `
      UPDATE items
      SET read = 1
      __WHERE_PLACEHOLDER__
    `;

    if (params.itemCategories && params.itemCategories.length > 0) {
      const categoryIds = params.itemCategories.map((cat) => cat.id).join(", ");
      const whereQuery = `
        WHERE itemCategoryId IN (${categoryIds})
      `;

      query = query.replace("__WHERE_PLACEHOLDER__", whereQuery);
    } else if (params.feed) {
      const whereQuery = `
        WHERE feed_id = ${params.feed.id}
      `;

      query = query.replace("__WHERE_PLACEHOLDER__", whereQuery);
    }
    if (params.feedCategory) {
      let whereQuery = `
        WHERE feed_id IN (__IDS_PLACEHOLDER__)
      `;

      const feedIds = await this.getFeedIds(params.feedCategory);

      whereQuery = whereQuery.replace(
        "__IDS_PLACEHOLDER__",
        feedIds.join(", ")
      );
      query = query.replace("__WHERE_PLACEHOLDER__", whereQuery);
    } else {
      if (!params.itemCategories && !params.feed) {
        query = query.replace("__WHERE_PLACEHOLDER__", "");
      }
    }

    try {
      this.database.prepare(query).run();
      return 1;
    } catch (error) {
      pino.error(error);
      return 0;
    }
  }

  public async markMultipleItemsRead(items: Item[]) {
    if (items.length === 0) return 0;
    const itemIds = items.map((item) => item.id).join(", ");
    const query = `
      UPDATE items
      SET read = 1
      WHERE id IN (${itemIds})
    `;

    try {
      const result = this.database.prepare(query).run();
      return result.changes;
    } catch (error) {
      pino.error(error);
      return 0;
    }
  }

  public async getItemById(itemId: number): Promise<Item | undefined> {
    const query = `
      SELECT
        items.id,
        items.title,
        items.content,
        items.json_content,
        items.published,
        items.read,
        items.bookmarked,
        items.url,
        items.feed_id AS feedId,
        feeds.title AS feedTitle,
        feeds.feedCategoryId,
        item_categories.title AS categoryTitle
      FROM
        items
      LEFT JOIN feeds ON
        feeds.id = items.feed_id
      LEFT JOIN item_categories ON
        item_categories.id = items.itemCategoryId
      WHERE items.id = ?
    `;

    try {
      const row = this.database.prepare(query).get(itemId) as Item | undefined;

      if (row) {
        // @ts-ignore
        row.content = domPurify.sanitize(row.content, {
          FORBID_TAGS: ["style"],
          FORBID_ATTR: [
            "style",
            "width",
            "height",
            "class",
            "id",
            "bgcolor",
          ],
        });

        row.content = row.content!.replace(
          /<a /gim,
          '<a target="_blank" rel="noreferrer noopener" '
        );

        if ((row as any).json_content) {
          row.jsonContent = JSON.parse((row as any).json_content);
          delete (row as any).json_content;
        }
      }

      return row;
    } catch (error) {
      pino.error(error);
      return undefined;
    }
  }

  public async markItemRead(item: Item) {
    const query = `
      UPDATE items
      SET read = 1
      WHERE id = ?
    `;

    try {
      this.database.prepare(query).run(item.id);
      return item.id;
    } catch (error) {
      pino.error(error);
      return undefined;
    }
  }

  public async toggleItemBookmark(item: Item) {
    const currentBookmarkStatus = item.bookmarked ? 0 : 1;
    const query = `
      UPDATE items
      SET bookmarked = ?
      WHERE id = ?
    `;

    try {
      this.database.prepare(query).run(currentBookmarkStatus, item.id);
      return {
        id: item.id,
        bookmarked: currentBookmarkStatus,
      };
    } catch (error) {
      pino.error(error);
      return undefined;
    }
  }

  public async assignItemToCategory(
    itemId: number,
    itemCategoryId: number
  ): Promise<boolean> {
    const query = `
      UPDATE items
      SET itemCategoryId = ?
      WHERE id = ?
    `;

    try {
      this.database.prepare(query).run(itemCategoryId, itemId);
      return true;
    } catch (error) {
      pino.error(error);
      return false;
    }
  }

  public async getItems(
    params: {
      size: number | undefined;
      unreadOnly?: boolean;
      bookmarkedOnly?: boolean;
      searchQuery?: string;
      selectedFeedCategory?: FeedCategory | undefined;
      selectedFeed?: Feed | undefined;
      selectedItemCategory?: Category | undefined;
      selectedItemCategoryIds?: number[] | undefined;
      order?: string;
    } = {
      size: 50,
      unreadOnly: false,
      bookmarkedOnly: false,
      searchQuery: "",
      selectedFeedCategory: undefined,
      selectedFeed: undefined,
      selectedItemCategory: undefined,
      selectedItemCategoryIds: undefined,
      order: "published",
    }
  ): Promise<Item[]> {
    let query = `
      SELECT
        items.id,
        items.title,
        items.published,
        items.read,
        items.bookmarked,
        items.feed_id AS feedId,
        feeds.title AS feedTitle,
        feeds.feedCategoryId
      FROM
        items
      __SEARCH_JOIN_PLACEHOLDER__
      LEFT JOIN feeds ON
        feeds.id = items.feed_id
      __WHERE_PLACEHOLDER1__
      __WHERE_PLACEHOLDER2__
      ORDER BY items.${params.order ? params.order : "created"} DESC
      LIMIT ?
    `;

    pino.debug({ params }, "Parameters for getItems");

    let whereQuery1 = `
      WHERE
      items.feed_id IN (__CATEGORY_IDS_PLACEHOLDER__)
    `;

    let filteredById = false;
    if (
      params.selectedItemCategoryIds &&
      params.selectedItemCategoryIds.length > 0
    ) {
      // Filter by multiple item category IDs
      whereQuery1 = `
      WHERE
      items.itemCategoryId IN (${params.selectedItemCategoryIds.join(", ")})
    `;
      query = query.replace("__WHERE_PLACEHOLDER1__", whereQuery1);

      filteredById = true;
    } else if (params.selectedItemCategory) {
      whereQuery1 = `
      WHERE
      items.itemCategoryId = ${params.selectedItemCategory.id}
    `;
      query = query.replace("__WHERE_PLACEHOLDER1__", whereQuery1);

      filteredById = true;
    } else if (params.selectedFeed) {
      whereQuery1 = whereQuery1.replace(
        "__CATEGORY_IDS_PLACEHOLDER__",
        `${params.selectedFeed.id}`
      );
      query = query.replace("__WHERE_PLACEHOLDER1__", whereQuery1);

      filteredById = true;
    } else if (params.selectedFeedCategory) {
      const feedIds = await this.getFeedIds(params.selectedFeedCategory);

      if (feedIds.length > 0) {
        whereQuery1 = whereQuery1.replace(
          "__CATEGORY_IDS_PLACEHOLDER__",
          feedIds.join(", ")
        );

        query = query.replace("__WHERE_PLACEHOLDER1__", whereQuery1);

        filteredById = true;
      } else {
        query = query.replace("__WHERE_PLACEHOLDER1__", "WHERE 1=0");
        filteredById = true;
      }
    } else {
      query = query.replace("__WHERE_PLACEHOLDER1__", "");
    }

    let whereQuery2 = "";
    const conditions: string[] = [];
    const parsedSearchQuery = DataService.parseSearchQuery(
      params.searchQuery || ""
    );
    const hasSearchQuery = Boolean(parsedSearchQuery.term);
    const useFtsSearch = hasSearchQuery && this.ftsReady;

    if (useFtsSearch) {
      query = query.replace(
        "__SEARCH_JOIN_PLACEHOLDER__",
        "INNER JOIN items_fts ON items_fts.rowid = items.id"
      );
    } else {
      query = query.replace("__SEARCH_JOIN_PLACEHOLDER__", "");
    }

    if (params.unreadOnly) {
      conditions.push("items.read = 0");
    }

    if (params.bookmarkedOnly) {
      conditions.push("items.bookmarked = 1");
    }

    if (hasSearchQuery) {
      if (useFtsSearch) {
        conditions.push("items_fts MATCH ?");
      } else {
        if (parsedSearchQuery.scope === "title") {
          conditions.push("LOWER(items.title) LIKE LOWER(?)");
        } else if (parsedSearchQuery.scope === "desc") {
          conditions.push(`
            (
              LOWER(items.content) LIKE LOWER(?) OR
              LOWER(items.summary) LIKE LOWER(?) OR
              LOWER(items.latest_content) LIKE LOWER(?)
            )
          `);
        } else {
          conditions.push(`
            (
              LOWER(items.title) LIKE LOWER(?) OR
              LOWER(items.content) LIKE LOWER(?) OR
              LOWER(items.summary) LIKE LOWER(?) OR
              LOWER(items.latest_content) LIKE LOWER(?)
            )
          `);
        }
      }
    }

    if (conditions.length > 0) {
      const operator = filteredById ? "AND" : "WHERE";
      whereQuery2 = `
      ${operator} ${conditions.join(" AND ")}
    `;
      query = query.replace("__WHERE_PLACEHOLDER2__", whereQuery2);
    } else {
      query = query.replace("__WHERE_PLACEHOLDER2__", "");
    }

    pino.trace({ query }, "Final items query");

    const queryParams: Array<string | number | undefined> = [];

    if (hasSearchQuery) {
      if (useFtsSearch) {
        const ftsQuery = DataService.buildFtsQuery(
          parsedSearchQuery.term,
          parsedSearchQuery.scope
        );
        queryParams.push(ftsQuery || '""');
      } else {
        const searchPattern = `%${parsedSearchQuery.term}%`;

        if (parsedSearchQuery.scope === "title") {
          queryParams.push(searchPattern);
        } else if (parsedSearchQuery.scope === "desc") {
          queryParams.push(searchPattern, searchPattern, searchPattern);
        } else {
          queryParams.push(
            searchPattern,
            searchPattern,
            searchPattern,
            searchPattern
          );
        }
      }
    }

    queryParams.push(params.size);

    try {
      const rows = this.database.prepare(query).all(queryParams);
      return (rows as Item[]) || [];
    } catch (error) {
      pino.error(error);
      return [];
    }
  }

  public async searchItems(
    params: {
      query: string;
      size?: number;
    } = {
      query: "",
      size: 100,
    }
  ): Promise<Item[]> {
    const parsedSearchQuery = DataService.parseSearchQuery(params.query);
    const trimmedQuery = parsedSearchQuery.term;
    const size = params.size ?? 100;

    if (!trimmedQuery) {
      return [];
    }

    if (this.ftsReady) {
      const ftsQuery = DataService.buildFtsQuery(
        trimmedQuery,
        parsedSearchQuery.scope
      );

      const ftsSearchQuery = `
        SELECT
          items.id,
          items.title,
          items.url,
          items.published,
          items.read,
          items.bookmarked,
          items.feed_id AS feedId,
          feeds.title AS feedTitle
        FROM
          items
        INNER JOIN items_fts ON
          items_fts.rowid = items.id
        LEFT JOIN feeds ON
          feeds.id = items.feed_id
        WHERE
          items_fts MATCH ?
        ORDER BY items.published DESC
        LIMIT ?
      `;

      try {
        const rows = this.database
          .prepare(ftsSearchQuery)
          .all(ftsQuery || '""', size);
        return (rows as Item[]) || [];
      } catch (error) {
        pino.error(error);
        return [];
      }
    }

    let whereClause = `
      LOWER(items.title) LIKE LOWER(?) OR
      LOWER(items.content) LIKE LOWER(?) OR
      LOWER(items.summary) LIKE LOWER(?) OR
      LOWER(items.latest_content) LIKE LOWER(?)
    `;

    const queryParams: Array<string | number> = [];
    const searchPattern = `%${trimmedQuery}%`;

    if (parsedSearchQuery.scope === "title") {
      whereClause = "LOWER(items.title) LIKE LOWER(?)";
      queryParams.push(searchPattern);
    } else if (parsedSearchQuery.scope === "desc") {
      whereClause = `
        LOWER(items.content) LIKE LOWER(?) OR
        LOWER(items.summary) LIKE LOWER(?) OR
        LOWER(items.latest_content) LIKE LOWER(?)
      `;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    } else {
      queryParams.push(
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern
      );
    }

    const query = `
      SELECT
        items.id,
        items.title,
        items.url,
        items.published,
        items.read,
        items.bookmarked,
        items.feed_id AS feedId,
        feeds.title AS feedTitle
      FROM
        items
      LEFT JOIN feeds ON
        feeds.id = items.feed_id
      WHERE
        ${whereClause}
      ORDER BY items.published DESC
      LIMIT ?
    `;
    queryParams.push(size);

    try {
      const rows = this.database.prepare(query).all(queryParams);
      return (rows as Item[]) || [];
    } catch (error) {
      pino.error(error);
      return [];
    }
  }

  public async removeItems(): Promise<boolean> {
    const query = "DELETE FROM items";

    try {
      this.database.prepare(query).run();
      pino.info("Removed all items");
      return true;
    } catch (error) {
      pino.error(error);
      return false;
    }
  }

  private async itemExists(item: Item) {
    const query = `
      SELECT id FROM items
      WHERE url = ?
    `;

    try {
      return this.database.prepare(query).get(item.link);
    } catch (error) {
      pino.error(error);
      return undefined;
    }
  }

  public static getItemPublishedTime(item: Item) {
    const possibleDateProperties = ["publishedRaw"];
    const dateProperty: string =
      possibleDateProperties.find((datePropertyName) => {
        return item.hasOwnProperty(datePropertyName);
      }) || "";

    const publishedTime =
      possibleDateProperties.includes(dateProperty) && item[dateProperty] !== ""
        ? Date.parse(item[dateProperty])
        : Date.now();

    return publishedTime;
  }

  /**
   * Cleans a string by removing emojis and invisible characters.
   *
   * @param str
   * @returns Cleaned string
   */
  private static cleanString(str: string) {
    str = str
      // 1. Remove the actual icons/pictographs
      .replace(/\p{Extended_Pictographic}/gu, "")
      // 2. Remove Zero-Width Joiners and Variation Selectors left behind
      .replace(/[\u200d\ufe0f]/g, "")
      // 3. Optional: Trim extra spaces left by removed emojis
      .replace(/\s{2,}/g, " ")
      .trim();

    str = str.replace(/[^\x20-\x7E\u00A1-\uFFFF]/gu, " ");

    return str;
  }

  public async insertItem(item: Item, feedId: number | undefined) {
    // Check if item already exists by URL
    const exists = await this.itemExists(item);

    if (exists) {
      pino.trace(
        { itemUrl: item.link, feedId },
        "Item already exists, skipping insertion"
      );
      return;
    }

    const query = `
      INSERT INTO items (url, title, content, feed_id, published, comments, created, json_content)
      VALUES ( ?, ?, ?, ?, ?, ?, ?, ? )
    `;

    let content = "";

    if (item.content !== undefined) {
      content = item.content;
    }

    if (item["content:encoded"] !== undefined) {
      content = item["content:encoded"];
    }

    // picture elements
    content = content.replace(/ data\-srcset\=/gim, " srcset=");
    content = content.replace(/ data\-sizes\=/gim, " sizes=");
    // relative links not allowed
    content = content.replace(/href="(\/|(?!http))[^"]+"/gim, "");
    // relative src not allowed
    content = content.replace(/src="(\/|(?!http))[^"]+"/gim, "");
    // all links should openin new window
    content = content.replace(
      /<a /gim,
      '<a target="_blank" rel="noreferrer noopener" '
    );

    if (item.description) {
      content += item.description;
    }

    let jsonContent = "";
    if (item.id && typeof item.id === "string" && item.id.includes("yt:video:")) {
      const vidId = item.id.replace("yt:video:", "");
      jsonContent = JSON.stringify({
        "yt-id": vidId,
      });
    }

    const publishedTime = DataService.getItemPublishedTime(item);

    const createdTime = Date.now();

    try {
      this.database.prepare(query).run(
        item.link,
        DataService.cleanString(
          domPurify.sanitize(item.title, { ALLOWED_TAGS: [] })
        ),
        domPurify.sanitize(content, {
          FORBID_TAGS: ["style", "script", "svg"],
          FORBID_ATTR: ["style", "width", "height", "class", "id"],
        }),
        feedId,
        publishedTime,
        item.comments,
        createdTime,
        jsonContent
      );
    } catch (error) {
      pino.error(error);
      pino.trace("ITEM URL: %s,\nFEED: %s", item.link, feedId);
    }
  }

  public async markFeedError(feed: Feed): Promise<boolean> {
    const query = `
      UPDATE feeds
      SET error = error + 1
      WHERE id = ?
    `;

    try {
      this.database.prepare(query).run(feed.id);
      return true;
    } catch (error) {
      pino.error(error);
      return false;
    }
  }

  public async getFeedsLastFirstItems(): Promise<Item[]> {
    const query = `
      SELECT
        feeds.id,
        items.url
      FROM feeds
      JOIN items
      ON items.feed_id = feeds.id
      GROUP BY items.feed_id
      ORDER BY items.published DESC
    `;

    try {
      const rows = this.database.prepare(query).all();
      return (rows as Item[]) || [];
    } catch (error) {
      pino.error(error);
      return [];
    }
  }

  public async updateItemsWithCategories(
    groups: Array<{ name: string; items: Item[] }>,
    itemCategories: Category[]
  ): Promise<void> {
    // Create a map of category names to their IDs for quick lookup
    const categoryNameToIdMap = new Map<string, number>();
    itemCategories.forEach((category) => {
      categoryNameToIdMap.set(category.title, category.id ?? 0);
    });

    try {
      const updateStmt = this.database.prepare(`
        UPDATE items
        SET itemCategoryId = ?
        WHERE id = ?
      `);

      this.database.transaction(() => {
        for (const group of groups) {
          const categoryId = categoryNameToIdMap.get(group.name) ?? 0;

          for (const item of group.items) {
            if (item.id === undefined || item.id === null) {
              pino.debug({ item }, "Skipping item without ID in category update");
              continue;
            }
            updateStmt.run(categoryId, item.id);
          }
        }
      })();

      pino.debug("Items updated with categories from AI grouping");
    } catch (error) {
      pino.error(error, "Error updating items categories");
    }
  }

  /**
   * Retrieve the summary for an item by URL
   * @param url The item URL
   * @returns The summary text if it exists, null otherwise
   */
  public async getItemSummary(url: string): Promise<string | null> {
    const query = `
      SELECT summary
      FROM items
      WHERE url = ? AND summary IS NOT NULL
    `;

    try {
      const row = this.database.prepare(query).get(url) as any;
      return row?.summary || null;
    } catch (error) {
      pino.error({ error, url }, "Error retrieving item summary");
      return null;
    }
  }

  /**
   * Retrieve the latest_content for an item by URL
   * @param url The item URL
   * @returns The latest content if it exists, null otherwise
   */
  public async getItemLatestContent(url: string): Promise<string | null> {
    const query = `
      SELECT latest_content
      FROM items
      WHERE url = ? AND latest_content IS NOT NULL
    `;

    try {
      const row = this.database.prepare(query).get(url) as any;
      return row?.latest_content || null;
    } catch (error) {
      pino.error({ error, url }, "Error retrieving item latest content");
      return null;
    }
  }

  /**
   * Update the summary column for an item by URL
   * @param url The item URL
   * @param summary The summary text to save
   */
  public async updateItemSummary(url: string, summary: string): Promise<void> {
    const query = `
      UPDATE items
      SET summary = ?
      WHERE url = ?
    `;

    try {
      this.database.prepare(query).run(summary, url);
      pino.debug({ url }, "Item summary updated successfully");
    } catch (error) {
      pino.error({ error, url }, "Error updating item summary");
    }
  }

  /**
   * Update the latest_content column for an item by URL
   * @param url The item URL
   * @param content The latest content to save
   */
  public async updateItemLatestContent(
    url: string,
    content: string
  ): Promise<void> {
    const query = `
      UPDATE items
      SET latest_content = ?
      WHERE url = ?
    `;

    try {
      this.database.prepare(query).run(content, url);
      pino.debug({ url }, "Item latest content updated successfully");
    } catch (error) {
      pino.error({ error, url }, "Error updating item latest content");
    }
  }
}
