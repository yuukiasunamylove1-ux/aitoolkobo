import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const dist = join(root, "dist");
let failed = false;

function fail(message: string) {
  failed = true;
  console.error(`error: ${message}`);
}

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

const htmlFiles = walk(dist).filter((file) => file.endsWith(".html"));
if (htmlFiles.length === 0) fail("dist に HTML がありません。先にビルドしてください。");

const home = htmlFiles.find((file) => file.endsWith("/index.html") && file.includes(`${join(dist, "index.html")}`))
  ?? join(dist, "index.html");
const homeHtml = readFileSync(home, "utf8");
if (!homeHtml.includes('lang="ja"')) fail("html lang=\"ja\" がありません。");
if (!homeHtml.includes('action="/api/subscribe"')) fail("購読フォームの送信先がありません。");
if (!homeHtml.includes("新着メールの受信に同意します")) fail("購読の同意文がありません。");
if (!homeHtml.includes('href="/privacy/"')) fail("同意文からプライバシーポリシーへリンクしていません。");
if (homeHtml.includes("このフォームは画面だけで")) fail("未接続だった購読フォームの案内が残っています。");

const privacyHtml = readFileSync(join(dist, "privacy/index.html"), "utf8");
if (!privacyHtml.includes("Resend")) fail("プライバシーポリシーに Resend の記載がありません。");

for (const required of ["robots.txt", "sitemap-index.xml", "llms.txt", "rss.xml", "og.png", "favicon.svg"]) {
  try {
    statSync(join(dist, required));
  } catch {
    fail(`dist/${required} がありません。`);
  }
}

function existsInDist(pathname: string) {
  const clean = pathname.split("#")[0].split("?")[0];
  if (clean === "" || clean === "/") return true;
  const relative = clean.replace(/^\//, "");
  const candidates = [
    join(dist, relative),
    join(dist, relative, "index.html"),
    join(dist, `${relative}.html`),
  ];
  return candidates.some((candidate) => {
    try {
      return statSync(candidate).isFile();
    } catch {
      return false;
    }
  });
}

const hrefs = new Set<string>();
for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  for (const match of html.matchAll(/href="([^"]+)"/g)) hrefs.add(match[1]);
}

for (const href of hrefs) {
  if (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("#")
  ) {
    continue;
  }
  const path = href.startsWith("/") ? href : `/${href}`;
  if (!existsInDist(path)) fail(`内部リンク切れ: ${href}`);
}

const toolDir = join(root, "src/content/tools");
const official = readdirSync(toolDir)
  .filter((name) => name.endsWith(".json"))
  .map((name) => {
    const data = JSON.parse(readFileSync(join(toolDir, name), "utf8")) as { url: string };
    return { name, url: data.url };
  });

async function checkExternal(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "aitoolkobo-link-check/0.1",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (response.status === 404 || response.status === 410) {
      fail(`${url} が ${response.status} です。`);
      return;
    }
    if (response.status >= 400 && ![401, 403, 429, 503].includes(response.status)) {
      console.warn(`warn: ${url} は ${response.status}（失敗にはしません）`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`warn: ${url} に到達できません (${message})。失敗にはしません。`);
  } finally {
    clearTimeout(timer);
  }
}

const queue = [...official];
const workers = Array.from({ length: 5 }, async () => {
  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) return;
    await checkExternal(next.url);
  }
});
await Promise.all(workers);

if (failed) process.exit(1);
console.log(`ok: html ${htmlFiles.length}, internal hrefs ${hrefs.size}, official ${official.length}`);
