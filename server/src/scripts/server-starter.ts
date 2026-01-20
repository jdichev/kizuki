import forestserver from "../server";
import projectConfig from "forestconfig";

forestserver.start({ port: projectConfig.dataServerPort });
