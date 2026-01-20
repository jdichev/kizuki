import forestserver from "./server";
import Updater from "./updater";
import projectConfig from "forestconfig";

export default class Main {
  static async start() {
    await forestserver.start({ port: projectConfig.dataServerPort });

    // Start updater after 30 seconds delay
    setTimeout(() => {
      Updater.start();
    }, 30e3);
  }

  static stop() {
    forestserver.stop();
    Updater.stop();
  }
}
