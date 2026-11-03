import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { categorySchema, toolSchema, usecaseSchema } from "../src/lib/schema";
import { WEIGHTS, breakdownFor } from "../src/lib/score";

const root = new URL("..", import.meta.url).pathname;
const today = new Date().toISOString().slice(0, 10);
let failed = false;

function fail(message: string) {
  failed = true;
  console.error(`error: ${message}`);
}

const weightSum = Object.values(WEIGHTS).reduce((sum, value) => sum + value, 0);
if (weightSum !== 100) fail(`重みの合計が ${weightSum} です。100 にしてください。`);

function readJsonDir(dir: string) {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const id = name.replace(/\.json$/, "");
      const raw = JSON.parse(readFileSync(join(dir, name), "utf8"));
      return { id, raw };
    });
}

const categories = new Map<string, ReturnType<typeof categorySchema.parse>>();
for (const file of readJsonDir(join(root, "src/content/categories"))) {
  const parsed = categorySchema.safeParse(file.raw);
  if (!parsed.success) {
    fail(`categories/${file.id}: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`);
    continue;
  }
  categories.set(file.id, parsed.data);
}

const tools = new Map<string, ReturnType<typeof toolSchema.parse>>();
for (const file of readJsonDir(join(root, "src/content/tools"))) {
  const parsed = toolSchema.safeParse(file.raw);
  if (!parsed.success) {
    fail(
      `tools/${file.id}: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
    continue;
  }
  if (!categories.has(parsed.data.category)) {
    fail(`tools/${file.id}: 未知のカテゴリ ${parsed.data.category}`);
  }
  if (parsed.data.lastChecked > today) {
    fail(`tools/${file.id}: lastChecked が未来です (${parsed.data.lastChecked})`);
  }
  if (!parsed.data.url.startsWith("https://") || !parsed.data.pricing.sourceUrl.startsWith("https://")) {
    fail(`tools/${file.id}: URL は https にしてください。`);
  }
  tools.set(file.id, parsed.data);
  breakdownFor(parsed.data);
}

for (const [id, category] of categories) {
  const count = [...tools.values()].filter((tool) => tool.category === id).length;
  if (count < 2) fail(`categories/${id}: ツールが ${count} 件です。2件以上にしてください。`);
  if (!["vibe", "game", "agent"].includes(category.theme)) {
    fail(`categories/${id}: 未知のテーマです。`);
  }
}

const usecaseDir = join(root, "src/content/usecases");
for (const name of readdirSync(usecaseDir).filter((file) => file.endsWith(".md"))) {
  const id = name.replace(/\.md$/, "");
  const text = readFileSync(join(usecaseDir, name), "utf8");
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    fail(`usecases/${id}: frontmatter がありません。`);
    continue;
  }
  const parsed = usecaseSchema.safeParse(parse(match[1]));
  if (!parsed.success) {
    fail(
      `usecases/${id}: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
    continue;
  }
  const seen = new Set<string>();
  for (const item of parsed.data.tools) {
    if (!tools.has(item.slug)) fail(`usecases/${id}: 未知のツール ${item.slug}`);
    if (seen.has(item.slug)) fail(`usecases/${id}: ツール ${item.slug} が重複しています。`);
    seen.add(item.slug);
  }
}

if (tools.size < 20) fail(`ツールが ${tools.size} 件です。20件以上にしてください。`);

if (failed) process.exit(1);
console.log(`ok: tools ${tools.size}, categories ${categories.size}`);
