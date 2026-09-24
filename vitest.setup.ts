import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnvFiles } from "./scripts/load-env";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

loadLocalEnvFiles(projectRoot);
