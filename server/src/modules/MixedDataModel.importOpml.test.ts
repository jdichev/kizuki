import DataService from "./MixedDataModel";

describe("MixedDataModel importOpml", () => {
  let dataModel: DataService;

  beforeEach(() => {
    dataModel = new DataService();
  });

  afterEach(async () => {
    await dataModel.disconnect();
  });

  it("assigns an existing feed to the matching existing category from OPML", async () => {
    const uniqueId = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const categoryTitle = `YT channels ${uniqueId}`;
    const feedUrl = `https://example.com/feed-${uniqueId}.xml`;

    await dataModel.insertFeedCategory({
      title: categoryTitle,
      text: categoryTitle,
      autoSummarize: null,
    });

    const category = (await dataModel.getFeedCategories()).find(
      (candidate) => candidate.title === categoryTitle
    );

    expect(category).toBeDefined();

    await dataModel.insertFeed({
      title: `Existing feed ${uniqueId}`,
      url: `https://example.com/${uniqueId}`,
      feedUrl,
      feedType: "rss",
      feedCategoryId: 0,
      autoSummarize: null,
    });

    const beforeImport = await dataModel.getFeedByUrl(feedUrl);
    expect(beforeImport.feedCategoryId).toBe(0);

    const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Test import</title>
  </head>
  <body>
    <outline text="${categoryTitle}" type="category">
      <outline text="Existing feed ${uniqueId}" xmlUrl="${feedUrl}" htmlUrl="https://example.com/${uniqueId}" type="rss" />
    </outline>
  </body>
</opml>`;

    const result = await dataModel.importOpml({ fileContent: opml });

    expect(result.importedFeeds).toBe(0);

    const afterImport = await dataModel.getFeedByUrl(feedUrl);
    expect(afterImport.feedCategoryId).toBe(category?.id);
  });
});
