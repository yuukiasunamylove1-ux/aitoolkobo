import type { APIContext } from "astro";
import { getCollection } from "astro:content";
import { THEMES } from "../lib/labels";
import { SITE_DESCRIPTION, SITE_NAME } from "../lib/seo";

export async function GET(context: APIContext) {
  const site = context.site!;
  const href = (path: string) => new URL(path, site).href;
  const tools = (await getCollection("tools")).sort((a, b) => a.data.name.localeCompare(b.data.name, "ja"));
  const categories = (await getCollection("categories")).sort((a, b) => a.data.order - b.data.order);
  const usecases = (await getCollection("usecases")).sort((a, b) => a.data.order - b.data.order);

  const lines = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    "日本語の個人開発者とゲーム／アプリ制作者向けのディレクトリです。対象はバイブコーディング、AIゲーム制作、AIエージェントです。",
    "料金の円建てと、UI・日本語入力・日本語出力は、確認できた事実だけを書き、不明な項目は未確認です。為替の推測換算はしません。",
    "カテゴリ内の順位は /scoring/ の公開式だけに従います。",
    "",
    "## サイト",
    "",
    `- [ホーム](${href("/")})`,
    `- [カテゴリ](${href("/categories/")})`,
    `- [用途別おすすめ](${href("/usecases/")})`,
    `- [新着AIツール](${href("/new/")})`,
    `- [評価基準](${href("/scoring/")}): 重み、日本語の対応表、価格帯、未確認の除外`,
    `- [RSS](${href("/rss.xml")})`,
    `- [運営者情報](${href("/about/")})`,
    `- [プライバシーポリシー](${href("/privacy/")})`,
    `- [広告・アフィリエイト表記](${href("/ads/")})`,
    "",
    "## カテゴリ",
    "",
    ...categories.map(
      (category) =>
        `- [${category.data.name}](${href(`/categories/${category.id}/`)}): ${THEMES[category.data.theme].name}。${category.data.description}`,
    ),
    "",
    "## 用途",
    "",
    ...usecases.map(
      (item) => `- [${item.data.title}](${href(`/usecases/${item.id}/`)}): ${item.data.description}`,
    ),
    "",
    "## ツール",
    "",
    ...tools.map(
      (tool) => `- [${tool.data.name}](${href(`/tools/${tool.id}/`)}): ${tool.data.description} 公式: ${tool.data.url}`,
    ),
    "",
    "## 引用するとき",
    "",
    "順位や点数を引用する場合は、評価基準ページの式と、ツールページの確認日を併記してください。円価格が未確認のツールを、円の確定料金として扱わないでください。",
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
