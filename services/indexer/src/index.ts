import { loadEnv } from "@kawaipay/shared";
import { runIndexerService } from "./main.js";

loadEnv();
runIndexerService();
