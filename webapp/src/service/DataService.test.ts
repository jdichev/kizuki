import DataService from "./DataService";
import fetchMock from "jest-fetch-mock";
import ItemsTable from "../components/ItemsTable";

fetchMock.enableMocks();

let dataService: DataService;

beforeEach(() => {
  dataService = DataService.getInstance();
  fetchMock.resetMocks();
});

test("Data service getInstance", async () => {
  expect(dataService instanceof DataService).toEqual(true);
});

test("Test getFeedCategories", async () => {
  fetchMock.mockResponseOnce(JSON.stringify([]));
  const feedCategories = await dataService.getFeedCategories();

  expect(feedCategories).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("Test getFeedCategoriesReadStats", async () => {
  fetchMock.mockResponseOnce(JSON.stringify([]));
  const feedCategoriesReadStats = await dataService.getFeedCategoryReadStats();

  expect(feedCategoriesReadStats).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("Test getFeedReadStats", async () => {
  fetchMock.mockResponseOnce(JSON.stringify([]));
  const feedReadStats = await dataService.getFeedReadStats();

  expect(feedReadStats).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("Test getUpdaterStatus", async () => {
  fetchMock.mockResponseOnce(
    JSON.stringify({
      inProgress: true,
      stage: "fetching",
      totalFeeds: 10,
      processedFeeds: 3,
      startedAt: 1,
      updatedAt: 2,
      lastCompletedAt: null,
    })
  );

  const updaterStatus = await dataService.getUpdaterStatus();

  expect(updaterStatus).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("Test getItems", async () => {
  //  todo: needs to check parameter setting logic
  fetchMock.mockResponseOnce(JSON.stringify([]));
  const items = await dataService.getItems();

  expect(items).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("Test getItem", async () => {
  //  todo: needs to check parameter setting logic
  fetchMock.mockResponseOnce(JSON.stringify([]));
  const item = await dataService.getItem(1);

  expect(item).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("Test markItemsRead", async () => {
  //  todo: needs to check parameter setting logic
  fetchMock.mockResponseOnce(JSON.stringify([]));
  const res = await dataService.markItemsRead({});

  expect(res).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("Test markItemRead", async () => {
  //  todo: needs to check parameter setting logic
  fetchMock.mockResponseOnce(JSON.stringify([]));
  const res = await dataService.markItemRead({ id: 1 } as Item);

  expect(res).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("Test getFeeds", async () => {
  //  todo: needs to check parameter setting logic
  fetchMock.mockResponseOnce(JSON.stringify([]));
  const feeds = await dataService.getFeeds();

  expect(feeds).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("Test getFeedById", async () => {
  //  todo: needs to check parameter setting logic
  fetchMock.mockResponseOnce(JSON.stringify([]));
  const feed = await dataService.getFeedById(1);

  expect(feed).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("Test removeFeed", async () => {
  //  todo: needs to check parameter setting logic
  fetchMock.mockResponseOnce(JSON.stringify([]));
  const res = await dataService.removeFeed(1);

  expect(res).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("Test updateFeed", async () => {
  //  todo: needs to check parameter setting logic
  fetchMock.mockResponseOnce(JSON.stringify([]));
  const res = await dataService.updateFeed({} as Feed);

  expect(res).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("Test checkFeedUrls", async () => {
  //  todo: needs to check parameter setting logic
  fetchMock.mockResponseOnce(JSON.stringify([]));
  const res = await dataService.checkFeedUrls(["test"]);

  expect(res).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("Test addFeed", async () => {
  //  todo: needs to check parameter setting logic
  fetchMock.mockResponseOnce(JSON.stringify([]));
  const res = await dataService.addFeed({} as Feed);

  expect(res).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("Test addFeedCategory", async () => {
  //  todo: needs to check parameter setting logic
  fetchMock.mockResponseOnce(JSON.stringify([]));
  const res = await dataService.addFeedCategory({} as FeedCategory);

  expect(res).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("Test removeFeedCategory", async () => {
  //  todo: needs to check parameter setting logic
  fetchMock.mockResponseOnce(JSON.stringify([]));
  const res = await dataService.removeFeedCategory(1);

  expect(res).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("Test updateFeedCategory", async () => {
  //  todo: needs to check parameter setting logic
  fetchMock.mockResponseOnce(JSON.stringify([]));
  const res = await dataService.updateFeedCategory({} as FeedCategory);

  expect(res).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("Test importOpmlFile", async () => {
  //  todo: needs to check parameter setting logic
  fetchMock.mockResponseOnce(JSON.stringify([]));
  const res = await dataService.importOpmlFile({ filePath: "./test.opml" });

  expect(res).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
