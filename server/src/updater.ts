// Import pino for logging
import pinoLib from "pino";
// Import the FeedUpdater class from a local module
import FeedUpdater from "./modules/FeedUpdater";
import ItemCategorizer from "./modules/ItemCategorizer";

const INTERVAL_MS = 10 * 60_000; // 10 minutes
const DRIFT_THRESHOLD_MS = 30_000; // treat significant drift uniformly

const pino = pinoLib({
  level: process.env.LOG_LEVEL || "info",
  name: "updater",
});

/**
 * Updater class responsible for scheduling and managing periodic updates.
 */
export default class Updater {
  private static timer?: NodeJS.Timeout;

  /**
   * Safely triggers a feed update, but only if no update is currently in progress.
   * After a successful update, categorizes uncategorized items if categorization is not in progress.
   * @param feedUpdater - The FeedUpdater instance to use for the update.
   * @param itemCategorizer - The ItemCategorizer instance to use for categorization.
   */
  private static safeUpdate(
    feedUpdater: FeedUpdater,
    itemCategorizer: ItemCategorizer
  ) {
    if (feedUpdater.isUpdateInProgress) {
      pino.warn("Update already in progress, skipping this update cycle");

      return;
    }

    void feedUpdater
      .updateItems()
      .then(() => {
        if (itemCategorizer.isCategorizationInProgress) {
          pino.debug(
            "Categorization already in progress, skipping categorization"
          );
          return [];
        }

        pino.debug(
          "Feed update completed, starting prioritized item categorization"
        );
        return itemCategorizer.categorizePrioritized();
      })
      .then((groups) => {
        if (groups.length > 0) {
          pino.info(
            { groupCount: groups.length },
            "Item categorization completed after feed update"
          );
        }
      })
      .catch((err) => pino.error(err, "Update or categorization failed"));
  }

  /**
   * Starts the updater service.
   * Initializes an immediate update and schedules periodic updates every 10 minutes.
   */
  public static start() {
    const feedUpdater = new FeedUpdater();
    const itemCategorizer = new ItemCategorizer();
    pino.debug(`Updating regularly`);

    this.safeUpdate(feedUpdater, itemCategorizer);

    // Self-scheduling timer with drift detection and resynchronization
    let nextAt = Date.now() + INTERVAL_MS;

    const scheduleNext = () => {
      const now = Date.now();
      const drift = now - nextAt;

      // Detect any significant drift
      const hasSignificantDrift = drift > DRIFT_THRESHOLD_MS;

      // Always run the update
      this.safeUpdate(feedUpdater, itemCategorizer);

      // Adjust schedule, with logging on drift
      if (hasSignificantDrift) {
        pino.warn(
          { drift },
          "Significant drift detected; resynchronizing schedule"
        );
        nextAt = Date.now() + INTERVAL_MS;
      } else {
        nextAt += INTERVAL_MS;
      }
      const delay = Math.max(0, nextAt - Date.now());
      this.timer = setTimeout(scheduleNext, delay);
    };
    this.timer = setTimeout(scheduleNext, INTERVAL_MS);
  }

  /**
   * Stops the updater service.
   * Stops the scheduled task from running.
   */
  public static stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }
}
