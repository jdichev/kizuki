import fs from "fs";
import os from "os";
import path from "path";
import DOMPurify from "dompurify";
import { Database } from "sqlite3";
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
BEGIN TRANSACTION;
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

COMMIT;
`;

const seedData = `
INSERT OR IGNORE INTO feed_categories (id, title, text)
VALUES (0, "Uncategorized", "Uncategorized");

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

  private database: Database;

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

    this.database = new Database(dbPath, (err) => {
      if (err) {
        pino.error({ err }, "Database opening error");
      }

      const pragmaSettings = `
        pragma journal_mode = WAL;
        pragma synchronous = off;
        pragma temp_store = memory;
        pragma mmap_size = 30000000000;
      `;

      this.database.exec(pragmaSettings, (innerErr) => {
        if (innerErr) {
          pino.error(innerErr, "Error pragma settings");
        }

        pino.debug("pragma seetings executed");
      });

      // Create tables (safe due to IF NOT EXISTS)
      this.database.exec(createTables, (createErr) => {
        if (createErr) {
          pino.error(createErr, "Error creating tables");
        }

        // Seed default data (safe due to INSERT OR IGNORE)
        this.database.exec(seedData, (seedErr) => {
          if (seedErr) {
            pino.error(seedErr, "Error seeding data");
          }

          // Run migrations for new columns
          this.runMigrations();

          pino.debug(
            `Database initialized in mode ${tempInstance ? "temp" : "not-temp"}`
          );
        });
      });

      // const twoWeeksAgo = new Date();
      // twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      // const twoWeeksAgoTime = twoWeeksAgo.getTime();

      // const query = `DELETE FROM items WHERE published < ${twoWeeksAgoTime}`;

      // this.database.run(query, (error) => {
      //   if (error) {
      //     pino.error(error);
      //   }
      // });

      // pino.info("Removed all items older than 2 weeks");
    });
  }

  public disconnect(): Promise<void> {
    return new Promise((resolve) => {
      this.database.close((error) => {
        if (error) {
          pino.error(error, "Error closing database");
        }

        resolve();
      });
    });
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

    // Try to add summary column (will fail silently if it already exists)
    this.database.run(addSummaryColumn, (error) => {
      if (error && !error.message.includes("duplicate column")) {
        pino.debug("Summary column might already exist or migration skipped");
      } else if (!error) {
        pino.info("Added summary column to items table");
      }
    });

    // Try to add latest_content column (will fail silently if it already exists)
    this.database.run(addLatestContentColumn, (error) => {
      if (error && !error.message.includes("duplicate column")) {
        pino.debug(
          "Latest_content column might already exist or migration skipped"
        );
      } else if (!error) {
        pino.info("Added latest_content column to items table");
      }
    });
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

    return new Promise((resolve) => {
      this.database.get(query, feedUrl, (error, row) => {
        if (error) {
          pino.error(error);
        }

        resolve(row as Feed);
      });
    });
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

    return new Promise((resolve) => {
      this.database.get(query, feedId, (error, row) => {
        if (error) {
          pino.error(error);
        }

        resolve(row as Feed);
      });
    });
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

    let whereQuery = `
      WHERE
      feeds.feedCategoryId = __CATEGORY_IDS_PLACEHOLDER__
    `;

    if (params.selectedFeedCategory) {
      whereQuery = whereQuery.replace(
        "__CATEGORY_IDS_PLACEHOLDER__",
        String(params.selectedFeedCategory.id)
      );
      query = query.replace("__WHERE_PLACEHOLDER__", whereQuery);
    } else {
      query = query.replace("__WHERE_PLACEHOLDER__", "");
    }

    return new Promise((resolve) => {
      this.database.all(query, (err, rows) => {
        if (err) {
          pino.error(err);
        }

        resolve((rows as Feed[]) || []);
      });
    });
  }

  public async removeFeeds(): Promise<void> {
    const query = `
      BEGIN TRANSACTION;
        DELETE FROM items;
        DELETE FROM feeds;
      COMMIT;
    `;

    return new Promise<void>((resolve) => {
      this.database.exec(query, (error) => {
        if (error) {
          pino.error(error);
        }

        pino.debug("removed feeds and related items");

        resolve();
      });
    });
  }

  public async removeFeed(feedId: number): Promise<void> {
    const query = `
      BEGIN TRANSACTION;
        DELETE FROM items
        WHERE feed_id = ${feedId};
        DELETE FROM feeds
        WHERE id = ${feedId};
      COMMIT;
    `;

    return new Promise<void>((resolve) => {
      this.database.exec(query, (error) => {
        if (error) {
          pino.error(error);
        }

        pino.debug(`removed feed ${feedId} and related items`);

        resolve();
      });
    });
  }

  private async feedExists(feed: Feed) {
    const query = `
      SELECT id FROM feeds
      WHERE feedUrl = ?
    `;

    return new Promise((resolve) => {
      this.database.get(query, feed.feedUrl, (error, row) => {
        if (error) {
          pino.error(error);
        }

        resolve(row);
      });
    });
  }

  // public async updateFeedTimings(
  //   feed: Feed,
  //   timingFields: {
  //     updateFrequency: number;
  //   }
  // ) {
  //   const query = `
  //     UPDATE feeds
  //     SET
  //       updateFrequency = ?
  //     WHERE
  //       id = ?
  //   `;

  //   return new Promise<boolean>((resolve) => {
  //     this.database.run(
  //       query,
  //       [timingFields.updateFrequency, feed.id],
  //       (error) => {
  //         if (error) {
  //           pino.error(error);
  //           resolve(false);
  //         }

  //         pino.debug("feed timing updated %o %o", feed, timingFields);
  //         resolve(true);
  //       }
  //     );
  //   });
  // }

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

    return new Promise<boolean>((resolve) => {
      this.database.run(
        query,
        [feed.title, feed.feedCategoryId, feed.feedUrl, feed.id],
        (error) => {
          if (error) {
            pino.error(error);
            resolve(false);
          }

          pino.debug("feed updated %o", feed);
          resolve(true);
        }
      );
    });
  }

  public async insertFeed(feed: Feed) {
    pino.debug(feed, "input for insert feed");

    const query = `
      INSERT INTO feeds (title, url, feedUrl, feedType, feedCategoryId)
      VALUES( ?, ?, ?, ?, ? );
    `;

    const feedExists = await this.feedExists(feed);

    if (feedExists) {
      pino.debug("Feed already exists");

      return Promise.resolve();
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

    return new Promise<void>((resolve) => {
      this.database.run(
        query,
        [feed.title, feed.url, feed.feedUrl, feed.feedType, categoryId],
        (error) => {
          if (error) {
            pino.error(error);
          }

          pino.debug(feed, "feed added");

          resolve();
        }
      );
    });
  }

  public async checkFeedUrls(urls: string[]): Promise<string[]> {
    const query = `
      SELECT feedUrl
      FROM feeds
      WHERE
        feedUrl IN ('${urls.join("', '")}')
    `;

    return new Promise((resolve) => {
      this.database.all(query, (error, rows) => {
        if (error) {
          pino.error(error);
        }

        const res = rows.map((record) => {
          // @ts-ignore
          return record.feedUrl;
        });

        resolve(res);
      });
    });
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

    return new Promise((resolve) => {
      this.database.all(query, (error, rows) => {
        if (error) {
          pino.error(error);
        }

        resolve((rows as FeedReadStat[]) || []);
      });
    });
  }

  public async removeFeedCategory(
    feedCategory: FeedCategory
  ): Promise<boolean> {
    const query = `
      BEGIN TRANSACTION;
        UPDATE feeds
        SET feedCategoryId = 0
        WHERE feedCategoryId = ${feedCategory.id};

        DELETE FROM feed_categories
        WHERE id = ${feedCategory.id};
      COMMIT;
    `;

    return new Promise((resolve) => {
      this.database.exec(query, (error) => {
        if (error) {
          pino.error(error);
        }

        pino.debug(`removed category ${feedCategory.title} and assigned items
        to default category`);

        resolve(true);
      });
    });
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

    return new Promise((resolve) => {
      this.database.all(query, (error, rows) => {
        if (error) {
          pino.error(error);
        }

        resolve((rows as FeedCategoryReadStat[]) || []);
      });
    });
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

    return new Promise((resolve) => {
      this.database.all(query, (error, rows) => {
        if (error) {
          pino.error(error);
        }

        resolve((rows as ItemCategoryReadStat[]) || []);
      });
    });
  }

  public async getFeedCategoryById(
    feedCategoryId: number
  ): Promise<FeedCategory | undefined> {
    const query = `
      SELECT *
      FROM feed_categories
      WHERE id = ?
    `;

    return new Promise((resolve) => {
      this.database.get(query, feedCategoryId, (error, row) => {
        if (error) {
          pino.error(error);
        }

        resolve((row as FeedCategory) || undefined);
      });
    });
  }

  public async getFeedCategories(): Promise<FeedCategory[]> {
    const query = `
      SELECT id, title
      FROM feed_categories
    `;

    return new Promise((resolve) => {
      this.database.all(query, (error, rows) => {
        if (error) {
          pino.error(error);
        }

        resolve((rows as FeedCategory[]) || []);
      });
    });
  }

  private async feedCategoryExists(feedCategory: FeedCategory) {
    const query = `
      SELECT id FROM feed_categories
      WHERE title = ?
    `;

    return new Promise((resolve) => {
      this.database.get(query, feedCategory.title, (error, row) => {
        if (error) {
          pino.error(error);
        }

        resolve(row);
      });
    });
  }

  public async insertFeedCategory(
    feedCategory: FeedCategory
  ): Promise<boolean> {
    const query = `
      INSERT INTO feed_categories (title, text)
      VALUES( ?, ? );
    `;

    pino.debug(feedCategory);

    const feedCategoryExists = await this.feedCategoryExists(feedCategory);

    if (feedCategoryExists) {
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      this.database.run(
        query,
        [feedCategory.title, feedCategory.text],
        (error) => {
          if (error) {
            pino.error(error);
          }

          resolve(true);
        }
      );
    });
  }

  public async updateFeedCategory(
    feedCategory: FeedCategory
  ): Promise<boolean> {
    const query = `
      UPDATE feed_categories
      SET title = ?, text = ?
      WHERE id = ?;
    `;

    const feedCategoryExists = await this.feedCategoryExists(feedCategory);

    if (feedCategoryExists) {
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      this.database.run(
        query,
        [feedCategory.title, feedCategory.text, feedCategory.id],
        (error) => {
          if (error) {
            pino.error(error);
          }

          resolve(true);
        }
      );
    });
  }

  public async importOpml(options: {
    filePath?: string;
    fileContent?: string;
  }) {
    let opmlContent: string;

    if (options.filePath) {
      // Electron path: read from file system
      opmlContent = fs.readFileSync(options.filePath, "utf-8");
    } else if (options.fileContent) {
      // Browser: use content directly
      opmlContent = options.fileContent;
    } else {
      throw new Error("Either filePath or fileContent must be provided");
    }

    const opmlData = opmlParser.load(opmlContent);
    const feedFinder = new FeedFinder();

    pino.debug({ categories: opmlData.categories }, "OPML categories");

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
    const categoryTitleToIdMap = new Map<string, number>();
    allCategories.forEach((category) => {
      categoryTitleToIdMap.set(category.title, category.id ?? 0);
    });

    pino.debug({ feeds: opmlData.feeds }, "OPML Feeds");
    for (const feed of opmlData.feeds) {
      pino.debug(feed);
      // @ts-ignore
      const feedRes = await feedFinder.checkFeed(feed.feedUrl);
      if (feedRes.length) {
        const feedToInsert = feedRes[0];
        // Use the category ID mapping to set the feedCategoryId directly
        if (feed.categoryTitle) {
          feedToInsert.feedCategoryId =
            categoryTitleToIdMap.get(feed.categoryTitle) || 0;
        }
        await this.insertFeed(feedToInsert);
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
  }

  private async getFeedIds(feedCategory: FeedCategory): Promise<number[]> {
    const query = `
      SELECT id FROM feeds
      WHERE feedCategoryId = ?
    `;

    return new Promise((resolve) => {
      this.database.all(query, feedCategory.id, (error, rows: Feed[]) => {
        if (error) {
          pino.error(error);
        }

        let feedIds: number[] = [];

        if (rows.length) {
          // @ts-ignore
          feedIds = rows.map((feed) => {
            return feed.id;
          });
        }

        resolve(feedIds);
      });
    });
  }

  // Item Categories Methods
  public async getItemCategories(): Promise<Category[]> {
    const query = `
      SELECT id, title, text
      FROM item_categories
    `;

    return new Promise((resolve) => {
      this.database.all(query, (error, rows) => {
        if (error) {
          pino.error(error);
        }

        resolve((rows as Category[]) || []);
      });
    });
  }

  private async itemCategoryExists(itemCategory: Category) {
    const query = `
      SELECT id FROM item_categories
      WHERE title = ?
    `;

    return new Promise((resolve) => {
      this.database.get(query, itemCategory.title, (error, row) => {
        if (error) {
          pino.error(error);
        }

        resolve(row);
      });
    });
  }

  public async insertItemCategory(itemCategory: Category): Promise<boolean> {
    const query = `
      INSERT INTO item_categories (title, text)
      VALUES( ?, ? );
    `;

    pino.debug(itemCategory);

    const itemCategoryExists = await this.itemCategoryExists(itemCategory);

    if (itemCategoryExists) {
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      this.database.run(
        query,
        [itemCategory.title, itemCategory.text],
        (error) => {
          if (error) {
            pino.error(error);
          }

          resolve(true);
        }
      );
    });
  }

  public async updateItemCategory(itemCategory: Category): Promise<boolean> {
    const query = `
      UPDATE item_categories
      SET title = ?, text = ?
      WHERE id = ?
    `;

    pino.debug(itemCategory);

    return new Promise((resolve) => {
      this.database.run(
        query,
        [itemCategory.title, itemCategory.text, itemCategory.id],
        (error) => {
          if (error) {
            pino.error(error);
            resolve(false);
          } else {
            resolve(true);
          }
        }
      );
    });
  }

  public async deleteItemCategory(itemCategoryId: number): Promise<boolean> {
    const query = `
      DELETE FROM item_categories
      WHERE id = ?
    `;

    return new Promise((resolve) => {
      this.database.run(query, [itemCategoryId], (error) => {
        if (error) {
          pino.error(error);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  public async getItemCategoryById(
    itemCategoryId: number
  ): Promise<Category | null> {
    const query = `
      SELECT id, title, text
      FROM item_categories
      WHERE id = ?
    `;

    return new Promise((resolve) => {
      this.database.get(query, [itemCategoryId], (error, row) => {
        if (error) {
          pino.error(error);
          resolve(null);
        } else {
          resolve((row as Category) || null);
        }
      });
    });
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
    itemCategory?: Category;
  }) {
    let query = `
      UPDATE items
      SET read = 1
      __WHERE_PLACEHOLDER__
    `;

    if (params.itemCategory) {
      const whereQuery = `
        WHERE itemCategoryId = ${params.itemCategory.id}
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
      if (!params.itemCategory && !params.feed) {
        query = query.replace("__WHERE_PLACEHOLDER__", "");
      }
    }

    return new Promise((resolve) => {
      this.database.run(query, (error: Error) => {
        if (error) {
          pino.error(error);
        }

        resolve(1);
      });
    });
  }

  public async markMultipleItemsRead(items: Item[]) {
    let query = `
      UPDATE items
      SET read = 1
      WHERE id IN (__IDS_PLACEHOLDER__)
    `;

    const itemIds = items.map((item) => item.id);

    query = query.replace("__IDS_PLACEHOLDER__", itemIds.join(", "));

    return new Promise((resolve) => {
      this.database.run(query, (error: Error, id: number) => {
        if (error) {
          pino.error(error);
        }

        resolve(id);
      });
    });
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

    return new Promise((resolve) => {
      this.database.get(
        query,
        itemId,
        (error: Error, row: Item | undefined) => {
          if (error) {
            pino.error(error);
          }

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

            row.content = row.content.replace(
              /<a /gim,
              '<a target="_blank" rel="noreferrer noopener" '
            );

            if (row.json_content) {
              row.jsonContent = JSON.parse(row.json_content);
              delete row.json_content;
            }
          }

          resolve(row);
        }
      );
    });
  }

  public async markItemRead(item: Item) {
    const query = `
      UPDATE items
      SET read = 1
      WHERE id = ?
    `;

    return new Promise((resolve) => {
      this.database.run(query, item.id, (error: Error) => {
        if (error) {
          pino.error(error);
        }

        resolve(item.id);
      });
    });
  }

  public async toggleItemBookmark(item: Item) {
    const currentBookmarkStatus = item.bookmarked ? 0 : 1;
    const query = `
      UPDATE items
      SET bookmarked = ?
      WHERE id = ?
    `;

    return new Promise((resolve) => {
      this.database.run(
        query,
        [currentBookmarkStatus, item.id],
        (error: Error) => {
          if (error) {
            pino.error(error);
          }

          resolve({
            id: item.id,
            bookmarked: currentBookmarkStatus,
          });
        }
      );
    });
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

    return new Promise((resolve) => {
      this.database.run(query, [itemCategoryId, itemId], (error: Error) => {
        if (error) {
          pino.error(error);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  public async getItems(
    params: {
      size: number | undefined;
      unreadOnly?: boolean;
      bookmarkedOnly?: boolean;
      selectedFeedCategory?: FeedCategory | undefined;
      selectedFeed?: Feed | undefined;
      selectedItemCategory?: Category | undefined;
      selectedItemCategoryIds?: number[] | undefined;
      order?: string;
    } = {
      size: 50,
      unreadOnly: false,
      bookmarkedOnly: false,
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
      LEFT JOIN feeds ON
        feeds.id = items.feed_id
      __WHERE_PLACEHOLDER1__
      __WHERE_PLACEHOLDER2__
      ORDER BY items.${params.order ? params.order : "created"} DESC
      LIMIT ?
    `;

    pino.debug({ params }, "Parameters for getItems");
    console.log("Parameters for getItems", params);

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

      whereQuery1 = whereQuery1.replace(
        "__CATEGORY_IDS_PLACEHOLDER__",
        feedIds.join(", ")
      );

      query = query.replace("__WHERE_PLACEHOLDER1__", whereQuery1);

      filteredById = true;

      // todo fix cleanup
      if (feedIds.length === 0) {
        query = query.replace("__WHERE_PLACEHOLDER1__", "");
      }
    } else {
      query = query.replace("__WHERE_PLACEHOLDER1__", "");
    }

    let whereQuery2 = "";
    let operator;

    if (params.unreadOnly || params.bookmarkedOnly) {
      if (filteredById) {
        operator = "AND";
      } else {
        operator = "WHERE";
      }

      const conditions = [];
      if (params.unreadOnly) {
        conditions.push("items.read = 0");
      }
      if (params.bookmarkedOnly) {
        conditions.push("items.bookmarked = 1");
      }

      whereQuery2 = `
      ${operator} ${conditions.join(" AND ")}
    `;
      query = query.replace("__WHERE_PLACEHOLDER2__", whereQuery2);
    } else {
      query = query.replace("__WHERE_PLACEHOLDER2__", "");
    }

    pino.trace({ query }, "Final items query");
    pino.debug(
      {
        query,
        params: {
          unreadOnly: params.unreadOnly,
          bookmarkedOnly: params.bookmarkedOnly,
          size: params.size,
        },
      },
      "Executing getItems query"
    );

    return new Promise((resolve) => {
      this.database.all(query, [params.size], (error, rows) => {
        if (error) {
          pino.error(error);
        }

        resolve((rows as Item[]) || []);
      });
    });
  }

  public async removeItems(): Promise<boolean> {
    const query = "DELETE FROM items";

    return new Promise((resolve) => {
      this.database.run(query, (error) => {
        if (error) {
          pino.error(error);
        }

        resolve(true);
      });

      pino.info("Removed all items");
    });
  }

  private async itemExists(item: Item) {
    const query = `
      SELECT id FROM items
      WHERE url = ?
    `;

    return new Promise((resolve) => {
      this.database.get(query, item.link, (error, row) => {
        if (error) {
          pino.error(error);
        }

        resolve(row);
      });
    });
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
      return Promise.resolve();
    }

    const query = `
      INSERT INTO items (url, title, content, feed_id, published, comments, created, json_content)
      VALUES ( ?, ?, ?, ?, ?, ?, ?, ? )
    `;

    return new Promise<void>((resolve) => {
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
      if (item.id && item.id.includes("yt:video:")) {
        const vidId = item.id.replace("yt:video:", "");
        jsonContent = JSON.stringify({
          "yt-id": vidId,
        });
      }

      const publishedTime = DataService.getItemPublishedTime(item);

      const createdTime = Date.now();

      this.database.run(
        query,
        [
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
          jsonContent,
        ],
        (error) => {
          if (error) {
            pino.error(error);
            pino.trace("ITEM URL: %s,\nFEED: %s", item.link, feedId);
          }

          resolve();
        }
      );
    });
  }

  public async markFeedError(feed: Feed): Promise<boolean> {
    const query = `
      UPDATE feeds
      SET error = error + 1
      WHERE id = ?
    `;

    return new Promise((resolve) => {
      this.database.run(query, feed.id, (error) => {
        if (error) {
          pino.error(error);
        }

        resolve(true);
      });
    });
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

    return new Promise((resolve) => {
      this.database.all(query, (error, rows) => {
        if (error) {
          pino.error(error);
        }

        resolve((rows as Item[]) || []);
      });
    });
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

    // Process each group
    for (const group of groups) {
      const categoryId = categoryNameToIdMap.get(group.name) ?? 0;

      // Update all items in this group with the category ID
      for (const item of group.items) {
        if (item.id === undefined || item.id === null) {
          pino.debug({ item }, "Skipping item without ID in category update");
          continue;
        }

        const query = `
          UPDATE items
          SET itemCategoryId = ?
          WHERE id = ?
        `;

        await new Promise<void>((resolve) => {
          this.database.run(query, [categoryId, item.id], (error) => {
            if (error) {
              pino.error(error, `Error updating item ${item.id} category`);
            }

            resolve();
          });
        });
      }
    }

    pino.debug("Items updated with categories from AI grouping");
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

    return new Promise((resolve) => {
      this.database.get(query, [url], (error, row: any) => {
        if (error) {
          pino.error({ error, url }, "Error retrieving item summary");
          resolve(null);
        } else {
          resolve(row?.summary || null);
        }
      });
    });
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

    return new Promise((resolve) => {
      this.database.get(query, [url], (error, row: any) => {
        if (error) {
          pino.error({ error, url }, "Error retrieving item latest content");
          resolve(null);
        } else {
          resolve(row?.latest_content || null);
        }
      });
    });
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

    return new Promise((resolve) => {
      this.database.run(query, [summary, url], (error) => {
        if (error) {
          pino.error({ error, url }, "Error updating item summary");
        } else {
          pino.debug({ url }, "Item summary updated successfully");
        }
        resolve();
      });
    });
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

    return new Promise((resolve) => {
      this.database.run(query, [content, url], (error) => {
        if (error) {
          pino.error({ error, url }, "Error updating item latest content");
        } else {
          pino.debug({ url }, "Item latest content updated successfully");
        }
        resolve();
      });
    });
  }
}
