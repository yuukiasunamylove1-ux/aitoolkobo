export const SITE_NAME = "AIツール工房";

export const SITE_DESCRIPTION =
  "日本語で開発する人のためのAIツールディレクトリ。バイブコーディング、AIゲーム制作、AIエージェントを、日本語対応と料金と公開した採点式で比べます。";

export function pageGraph(input: {
  site: string;
  url: string;
  name: string;
  description: string;
  type?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": input.type ?? "WebPage",
    inLanguage: "ja",
    name: input.name,
    description: input.description,
    url: input.url,
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: input.site,
      inLanguage: "ja",
    },
  };
}
