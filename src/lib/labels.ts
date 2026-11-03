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

export function absoluteUrl(pathname: string, site: URL): string {
  return new URL(pathname, site).href;
}
