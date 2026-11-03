import type { PriceTier, SupportLevel, ThemeId } from "./schema";

export const THEMES: Record<ThemeId, { name: string; lead: string }> = {
  vibe: {
    name: "バイブコーディング",
    lead: "会話や指示でコードとアプリを進めるエディタ、エージェント、ビルダー。",
  },
  game: {
    name: "AIゲーム制作",
    lead: "絵、3D、音楽、声など、ゲームの素材と制作を助ける生成ツール。",
  },
  agent: {
    name: "AIエージェント",
    lead: "エージェントを組み立て、つなぎ、手元で動かすための土台。",
  },
};

export const SUPPORT_LABEL: Record<SupportLevel, string> = {
  supported: "対応",
  partial: "一部対応",
  unsupported: "非対応",
  unknown: "未確認",
};

export const TIER_LABEL: Record<PriceTier, string> = {
  free: "ライセンス料なし",
  freemium: "無料枠あり",
  subscription: "有料プラン中心",
  "open-source": "オープンソース",
  unknown: "料金未確認",
};

export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

const weekdayFormat = new Intl.DateTimeFormat("ja-JP", { weekday: "short", timeZone: "UTC" });

function weekdayOf(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return weekdayFormat.format(new Date(Date.UTC(year, month - 1, day)));
}

/** 2026/11/04(水) */
export function formatJaDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${year}/${month}/${day}(${weekdayOf(iso)})`;
}

/** 2026年11月4日(水) */
export function formatJaDateLong(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${year}年${Number(month)}月${Number(day)}日(${weekdayOf(iso)})`;
}

/** 11月4日(水) */
export function formatJaMonthDay(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${Number(month)}月${Number(day)}日(${weekdayOf(iso)})`;
}

export function latestDate(dates: string[]): string {
  return dates.reduce((latest, date) => (date > latest ? date : latest), dates[0] ?? "");
}

export function sourceLinkText(label: string): string {
  if (/[ぁ-んァ-ン一-龯]/.test(label)) return label;
  const lower = label.toLowerCase();
  let kind = "参照ページ";
  if (/pric|plan|subscription/.test(lower)) kind = "料金ページ";
  else if (/term|license/.test(lower)) kind = "利用条件";
  else if (/doc/.test(lower)) kind = "ドキュメント";
  else if (label.includes("/")) kind = "リポジトリ";
  return `${kind}（${label}）`;
}

export function siteHost(url: string): string {
  return new URL(url).host.replace(/^www\./, "");
}

export const CHECK_FIELD_LABEL = {
  ui: "日本語UI",
  input: "日本語入力",
  output: "日本語出力",
  pricing: "料金",
  commercial: "商用",
} as const;

export function absoluteUrl(pathname: string, site: URL): string {
  return new URL(pathname, site).href;
}
