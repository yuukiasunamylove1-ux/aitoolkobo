import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const toolsDir = "src/content/tools";
const outDir = "public/logos";
await mkdir(outDir, { recursive: true });

const files = (await readdir(toolsDir)).filter((name) => name.endsWith(".json"));

async function fetchLogo(host) {
  const urls = [
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`,
    `https://icons.duckduckgo.com/ip3/${host}.ico`,
  ];
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
        headers: { "user-agent": "aitoolkobo-logo-fetch" },
      });
      if (!response.ok) continue;
      const type = response.headers.get("content-type") ?? "";
      const buf = Buffer.from(await response.arrayBuffer());
      if (buf.length < 80) continue;
      const ext = type.includes("png") || url.includes("sz=64") ? "png" : "ico";
      if (!type.startsWith("image/") && !type.includes("icon") && ext !== "png") continue;
      return { buf, ext };
    } catch {
      // try the next source
    }
  }
  return null;
}

async function one(file) {
  const id = file.replace(/\.json$/, "");
  const data = JSON.parse(await readFile(join(toolsDir, file), "utf8"));
  const host = new URL(data.url).hostname.replace(/^www\./, "");
  if (host === "github.com" || host.endsWith(".github.com")) {
    console.log(`skip ${id} (${host})`);
    return;
  }
  const logo = await fetchLogo(host);
  if (!logo) {
    console.log(`miss ${id} (${host})`);
    return;
  }
  const dest = join(outDir, `${id}.${logo.ext}`);
  await writeFile(dest, logo.buf);
  console.log(`ok ${id} ${logo.buf.length}b`);
}

const queue = [...files];
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const file = queue.shift();
      if (file) await one(file);
    }
  }),
);
