import pinoLib from "pino";
import MixedDataModel from "./MixedDataModel";
import AiService from "./AiService";

const pino = pinoLib({
  level: process.env.LOG_LEVEL || "info",
  name: "ItemCategorizer",
});

const dataModel = MixedDataModel.getInstance();

export default class ItemCategorizer {
  private categorizationInProgress: boolean = false;

  /**
   * Checks whether categorization is currently in progress.
   * @returns {boolean} True if categorization is in progress, false otherwise.
   */
  public get isCategorizationInProgress(): boolean {
    return this.categorizationInProgress;
  }

  /**
   * Categorizes items using AI and updates them with the generated categories.
   * @param options - Options for filtering items to categorize
   * @param options.unreadOnly - Whether to only categorize unread items
   * @param options.size - Maximum number of items to categorize
   * @param options.selectedFeedId - Optional feed ID to filter items
   * @param options.selectedFeedCategoryId - Optional feed category ID to filter items
   * @returns The generated groups with their associated items
   */
  public async categorizeItems(
    options: {
      unreadOnly?: boolean;
      size?: number;
      selectedFeedId?: number;
      selectedFeedCategoryId?: number;
    } = {}
  ): Promise<any[]> {
    if (this.categorizationInProgress) {
      pino.warn("Categorization already in progress, skipping");
      return [];
    }

    try {
      this.categorizationInProgress = true;
      pino.debug(options, "Starting item categorization");

      const {
        unreadOnly = false,
        size,
        selectedFeedId,
        selectedFeedCategoryId,
      } = options;

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

      if (items.length === 0) {
        pino.debug("No items to categorize");
        return [];
      }

      const itemCategories = await dataModel.getItemCategories();
      const itemCategoriesForPrompt = itemCategories
        .map((cat) => cat.title)
        .join(", ");

      const aiService = AiService.getInstance();

      const preparedItems = aiService.prepareItemsPrompt(items);
      pino.trace({ preparedItems }, "Prepared items for AI service");

      const finalPrompt = `
  You are a categorization agent. What follows is a list of article IDs and article titles.
  Group the list by categories and generate a new list that looks like this:
  <AI generated category name>: <article id>, <article id>
  <AI generated category name>: <article id>, <article id>, <article id>

  Our already existing categories are: ${itemCategoriesForPrompt}. Preferrably use these categories when possible.

  The article list is below:
  ${preparedItems}
  `;

      const aiResponse = await aiService.generateContent(finalPrompt);
      pino.trace({ aiResponse }, "AI response for grouping items");

      const groups = aiService.parseAiGroupsResponse(aiResponse, items);
      await dataModel.updateItemsWithCategories(groups, itemCategories);

      pino.info(
        { groupCount: groups.length, itemCount: items.length },
        "Item categorization completed"
      );

      return groups;
    } catch (error: any) {
      pino.error(
        { error: error.message || String(error) },
        "Error during item categorization"
      );
      throw error;
    } finally {
      this.categorizationInProgress = false;
    }
  }

  /**
   * Categorizes all items in the system.
   * @param options - Options for categorization
   * @param options.unreadOnly - Whether to only categorize unread items (default: false)
   * @param options.size - Maximum number of items to categorize
   * @returns The generated groups with their associated items
   */
  public async categorizeAllItems(
    options: {
      unreadOnly?: boolean;
      size?: number;
    } = {}
  ): Promise<any[]> {
    pino.info("Starting full item categorization");
    return this.categorizeItems(options);
  }
}
