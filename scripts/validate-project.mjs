import {missingAppAnchors} from './project-routes.mjs';
import { readFile, access } from "node:fs/promises";
import { execFile } from "node:child_process";
import process from "node:process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const requiredFiles = [
  "index.html",
  "app/index.html",
  "app/styles.css",
  "app/app.js",
  "PRODUCT.md",
  "ROADMAP.md",
  "ARCHITECTURE.md",
  "SECURITY.md",
  "docs/DECISIONS.md",
  "docs/ENVIRONMENTS.md",
  "docs/DEFINITION_OF_DONE.md"
];

const requiredSections = ["comparison", "features", "plugins", "tariffs", "faq"];
const environments = ["development", "staging", "production"];
const errors = [];
const forbiddenTrackedFiles = /(^|\/)(?:\.env(?:\..+)?|.+\.(?:pem|key|p12|pfx|db|sqlite|sqlite3))$/i;
const secretPatterns = [
  { name: "private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "GitHub token", pattern: /\b(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}\b/ },
  { name: "OpenAI-style secret", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { name: "Slack token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
  { name: "AWS access key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "FunPay session cookie", pattern: /\b(?:PHPSESSID|golden_key)=[^\s;]{8,}/i }
];

for (const file of requiredFiles) {
  try {
    await access(file);
  } catch {
    errors.push(`Missing required file: ${file}`);
  }
}

const html = await readFile("index.html", "utf8");

if (!/^<!doctype html>/i.test(html.trimStart())) errors.push("index.html must start with a doctype");
if (!/<html\s+lang="ru"/i.test(html)) errors.push("index.html must declare lang=ru");
if (!/<title>[^<]+<\/title>/i.test(html)) errors.push("index.html must contain a title");

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
if (duplicateIds.length) errors.push(`Duplicate HTML ids: ${duplicateIds.join(", ")}`);

const idSet = new Set(ids);
for (const section of requiredSections) {
  if (!idSet.has(section)) errors.push(`Missing required section id: ${section}`);
}

const localAnchors = [...html.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);
const missingAnchors = [...new Set(localAnchors.filter((anchor) => !idSet.has(anchor)))];
if (missingAnchors.length) errors.push(`Broken local anchors: ${missingAnchors.join(", ")}`);

const appHtml = await readFile("app/index.html", "utf8");
if (!/^<!doctype html>/i.test(appHtml.trimStart())) errors.push("app/index.html must start with a doctype");
if (!/<html\s+lang="ru"/i.test(appHtml)) errors.push("app/index.html must declare lang=ru");
if (!/<title>[^<]+<\/title>/i.test(appHtml)) errors.push("app/index.html must contain a title");

const appIds = [...appHtml.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
const duplicateAppIds = [...new Set(appIds.filter((id, index) => appIds.indexOf(id) !== index))];
if (duplicateAppIds.length) errors.push(`Duplicate app HTML ids: ${duplicateAppIds.join(", ")}`);

const appIdSet = new Set(appIds);
// Cabinet sections are hash routes backed by data-view, not necessarily ids.
for (const match of appHtml.matchAll(/\bdata-view=["']([a-z-]+)["']/g)) appIdSet.add(match[1]);
const appAnchors = [...appHtml.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);
const raritySource = await readFile('app/plugin-rarity.js','utf8');
const knownPlugins = new Set([...raritySource.matchAll(/["'](zetslay\.[a-z0-9-]+)["']\s*:/g)].map(m=>m[1]));
const brokenAppAnchors = missingAppAnchors(appAnchors,appIdSet,knownPlugins);
if (brokenAppAnchors.length) errors.push(`Broken app local anchors: ${brokenAppAnchors.join(", ")}`);

for (const environment of environments) {
  const path = `config/environments/${environment}.json`;
  let config;
  try {
    config = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    errors.push(`Invalid environment file ${path}: ${error.message}`);
    continue;
  }

  if (config.name !== environment) errors.push(`${path}: name must be ${environment}`);
  if (typeof config.branch !== "string" || !config.branch) errors.push(`${path}: branch is required`);
  if (typeof config.debug !== "boolean") errors.push(`${path}: debug must be boolean`);
  if (typeof config.telemetry !== "boolean") errors.push(`${path}: telemetry must be boolean`);
  if (typeof config.allowTestData !== "boolean") errors.push(`${path}: allowTestData must be boolean`);
}

const { stdout: trackedOutput } = await execFileAsync("git", ["ls-files", "-z"], { encoding: "utf8" });
const trackedFiles = trackedOutput.split("\0").filter(Boolean);
const textFiles = trackedFiles.filter((file) => !/\.(?:png|jpe?g|webp|gif|ico|woff2?|pdf|zip)$/i.test(file));

for (const file of trackedFiles) {
  if (file === ".env.example") continue;
  if (forbiddenTrackedFiles.test(file)) errors.push(`Sensitive file type must not be tracked: ${file}`);
}

for (const file of textFiles) {
  const content = await readFile(file, "utf8");
  for (const secret of secretPatterns) {
    if (secret.pattern.test(content)) errors.push(`Possible ${secret.name} detected in ${file}`);
  }
}

if (errors.length) {
  console.error("ZetSlay validation failed:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`ZetSlay validation passed: ${requiredFiles.length} required files, ${ids.length + appIds.length} unique ids across two surfaces, ${environments.length} environments, ${trackedFiles.length} tracked files scanned.`);

