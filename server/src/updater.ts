// Import pino for logging
import pinoLib from "pino";
// Import the FeedUpdater class from a local module
import FeedUpdater from "./modules/FeedUpdater";

const INTERVAL_MS = 10 * 60_000; // 10 minutes
const DRIFT_THRESHOLD_MS = 30_000; // treat significant drift uniformly

const pino = pinoLib({
  level: process.env.LOG_LEVEL || "trace",
  name: "updater",
});

/**
 * Updater class responsible for scheduling and managing periodic updates.
 */
export default class Updater {
  private static timer?: NodeJS.Timeout;

  /**
   * Safely triggers a feed update, but only if no update is currently in progress.
   * @param feedUpdater - The FeedUpdater instance to use for the update.
   */
  private static safeUpdate(feedUpdater: FeedUpdater) {
    if (feedUpdater.isUpdateInProgress) {
      pino.warn("Update already in progress, skipping this update cycle");

      return;
    }

    void feedUpdater
      .updateItems()
      .catch((err) => pino.error(err, "Update failed"));
  }

  /**
   * Starts the updater service.
   * Initializes an immediate update and schedules periodic updates every 10 minutes.
   */
  public static start() {
    const feedUpdater = new FeedUpdater();
    pino.debug(`Updating regularly`);

    this.safeUpdate(feedUpdater);

    // Self-scheduling timer with drift detection and resynchronization
    let nextAt = Date.now() + INTERVAL_MS;

    const scheduleNext = () => {
      const now = Date.now();
      const drift = now - nextAt;

      // Detect any significant drift
      const hasSignificantDrift = drift > DRIFT_THRESHOLD_MS;

      // Always run the update
      this.safeUpdate(feedUpdater);

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
