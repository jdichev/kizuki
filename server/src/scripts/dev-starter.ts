import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env file BEFORE importing modules
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import forestserver from "../main";

forestserver.start();
