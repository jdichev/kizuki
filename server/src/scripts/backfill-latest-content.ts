import DataService from "../modules/MixedDataModel";
import pinoLib from "pino";

const pino = pinoLib({
  level: process.env.LOG_LEVEL || "info",
  name: "BackfillLatestContent",
});

async function run(): Promise<void> {
  const dataModel = DataService.getInstance();

  try {
    pino.info(
      "Starting backfill for latest_content and latest_content_word_count"
    );

    const result = await dataModel.backfillLatestContentAndWordCount();

    pino.info(
      {
        scanned: result.scanned,
        latestContentUpdated: result.latestContentUpdated,
        wordCountUpdated: result.wordCountUpdated,
      },
      "Backfill completed"
    );
  } catch (error) {
    pino.error({ error }, "Backfill failed");
    process.exitCode = 1;
  } finally {
    await dataModel.disconnect();
  }
}

run();
