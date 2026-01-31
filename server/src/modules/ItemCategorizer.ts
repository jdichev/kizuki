import pinoLib from "pino";
import MixedDataModel from "./MixedDataModel";
import GoogleAiService from "./GoogleAiService";

const pino = pinoLib({
  level: process.env.LOG_LEVEL || "info",
  name: "ItemCategorizer",
});

const dataModel = MixedDataModel.getInstance();

export default class ItemCategorizer {
  private categorizationInProgress: boolean = false;

  /**
   * Formats items into a prompt-friendly string.
   */
  public static buildItemsPromptList(items: any[]): string {
    if (!items || items.length === 0) {
      return "";
    }

    return items
      .filter((item) => item.id !== undefined && item.title)
      .map((item) => {
        const feedPrefix = item.feedTitle ? `${item.feedTitle} ` : "";
        return `${item.id}: ${feedPrefix}${item.title}`;
      })
      .join("\n");
  }

  /**
   * Checks whether categorization is currently in progress.
   * @returns {boolean} True if categorization is in progress, false otherwise.
   */
  public get isCategorizationInProgress(): boolean {
    return this.categorizationInProgress;
  }

  /**
   * Shared categorization pipeline once items are selected.
   */
  private async runCategorization(
    items: any[],
    itemCategories: any[],
    aiService: GoogleAiService,
    logContext: string
  ): Promise<any[]> {
    const itemCategoriesForPrompt = itemCategories
      .map((cat) => cat.title)
      .join(", ");

    const preparedItems = ItemCategorizer.buildItemsPromptList(items);
    pino.trace({ preparedItems }, "Prepared items for AI service");

    const finalPrompt = `
  You are a categorization agent. What follows is a list where each line is article ID, article source, and article title.
  Group the list by categories and generate a new list that is formatted like next 2 lines and don't add other text:
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
      `${logContext} item categorization completed`
    );

    return groups;
  }

  /**
   * Categorizes uncategorized items
   * @returns The generated groups with their associated items
   */
  public async categorize(): Promise<any[]> {
    // Check if AI service is configured
    const aiService = GoogleAiService.getInstance();
    if (!aiService.isConfigured()) {
      pino.warn("AI Service not configured, skipping categorization");
      return [];
    }

    if (this.categorizationInProgress) {
      pino.warn("Categorization already in progress, skipping");
      return [];
    }

    try {
      this.categorizationInProgress = true;
      pino.debug("Starting prioritized item categorization");

      // Get all item categories to find Uncategorized (id=0)
      const itemCategories = await dataModel.getItemCategories();
      const uncategorizedCategory = itemCategories.find((cat) => cat.id === 0);

      if (!uncategorizedCategory) {
        pino.warn("Uncategorized item category (id=0) not found");
        return [];
      }

      // Just find items in Uncategorized category
      let items = await dataModel.getItems({
        unreadOnly: false,
        size: 500,
        selectedItemCategory: uncategorizedCategory,
        order: "published",
      });

      if (items.length === 0) {
        pino.debug("No uncategorized items found");
        return [];
      }

      pino.debug(
        { itemCount: items.length },
        "Found uncategorized items to categorize"
      );

      return this.runCategorization(
        items,
        itemCategories,
        aiService,
        "standard"
      );
    } catch (error: any) {
      pino.error(
        { error: error.message || String(error) },
        "Error during standard item categorization"
      );
      throw error;
    } finally {
      this.categorizationInProgress = false;
    }
  }
}
