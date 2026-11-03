# AIツール工房（aitoolkobo）

日本語でアプリやゲームを作る人向けの、AIツールディレクトリです。対象は次の三つだけです。

- バイブコーディング（Cursor、Claude Code、Lovable、Bolt、v0、Replit など）
- AIゲーム制作（画像、3D、音楽、音声）
- AIエージェント（ビルダー、フレームワーク、自動化、ローカル実行）

各ツールページには、日本語対応（UI・日本語入力・日本語出力）、確認できた料金、採点の内訳を出します。公式の円建てが確認できない金額は、為替で埋めず **未確認** と書きます。順位は [評価基準](src/lib/score.ts) の式だけに従います。

データはリポジトリ内の JSON / Markdown です。ツールの追加はファイルを足すだけで、次のビルドに載ります。

## 必要環境

- Node.js 22 以上
- npm

## ローカル開発

```bash
npm ci
npm run dev
```

開発サーバーは `http://localhost:4321` です。

本番と同じ静的ファイルを確認するときは、次です。

```bash
npm run build
npm run preview
```

## スクリプト

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー |
| `npm run validate` | ツール・カテゴリ・用途のスキーマと参照を検査 |
| `npm run build` | `dist/` へ静的ビルド |
| `npm run preview` | `dist/` を配信 |
| `npm run check:links` | ビルド後の内部リンクと、公式URLの 404 / 410 |
| `npm run ci` | validate → build → check:links |

`check:links` は先に `npm run build` が必要です。公式サイトがボットを 403 で拒んでも失敗にはしません。404 と 410 だけ失敗にします。

## Cloudflare Pages

静的サイトです。アダプタも Workers も使いません。無料枠の Pages で配信できます。

| 設定 | 値 |
| --- | --- |
| フレームワーク | Astro |
| ビルドコマンド | `npm run build` |
| ビルド出力ディレクトリ | `dist` |
| Node.js | 22（環境変数 `NODE_VERSION=22`） |
| 環境変数 | `PUBLIC_SITE_URL=https://aitoolkobo.pages.dev` |

`PUBLIC_SITE_URL` は末尾スラッシュなしです。未設定のときの既定値も `https://aitoolkobo.pages.dev` です。canonical、OGP、sitemap、RSS、`llms.txt`、JSON-LD はこの値をビルド時に埋め込みます。変数を変えたあとは再ビルドが必要です。

### 独自ドメイン（aitoolkobo.com）にするとき

1. Cloudflare Pages にカスタムドメイン `aitoolkobo.com` を追加する
2. 環境変数を `PUBLIC_SITE_URL=https://aitoolkobo.com` に変える
3. 再デプロイする

コード内のURLは `astro.config.mjs` の `site` から出るので、ファイルを書き換えなくて済みます。

## ディレクトリ

```
src/content/tools/        ツール 1件につき1 JSON
src/content/categories/   カテゴリ JSON
src/content/usecases/     用途別 Markdown
src/lib/schema.ts         スキーマ（Zod）
src/lib/score.ts          採点式と重み
src/pages/                ページ、RSS、llms.txt、robots.txt
public/                   favicon と OGP 画像
```

## ツールを追加する

1. `src/content/tools/<slug>.json` を作る。`<slug>` は URL になります（例: `cursor` → `/tools/cursor/`）。小文字の英数字とハイフンだけにしてください。
2. 下のスキーマに合わせて書きます。分からない日本語対応と、確認できない月額・円建ては推測せず `unknown` か `null` にします。
3. カテゴリは `src/content/categories/` にある id を `category` に書きます。
4. `npm run validate` を通し、`npm run dev` で `/tools/<slug>/` と、そのカテゴリの順位を見ます。

カテゴリを増やすときは `src/content/categories/<slug>.json` を追加します。`theme` は `vibe`（バイブコーディング）、`game`（AIゲーム制作）、`agent`（AIエージェント）のいずれかです。1カテゴリにツールは2件以上にしてください。

用途別ページを増やすときは `src/content/usecases/<slug>.md` を追加し、frontmatter の `tools` に既存ツールの slug と、短い推薦理由を書きます。並びはスコア順ではなく、その用途での順番です。

### スキーマ

`src/lib/schema.ts` が正です。要点だけ書きます。

| フィールド | 内容 |
| --- | --- |
| `name` | 表示名 |
| `url` | 公式サイト（https） |
| `category` | カテゴリの slug |
| `description` | 一覧と meta description に使う短い説明（24〜160字） |
| `detail` | ツールページの本文（40〜520字） |
| `platforms` | 例: `ブラウザ`、`CLI`、`デスクトップ` |
| `pricing.tier` | `free` / `freemium` / `subscription` / `open-source` / `unknown` |
| `pricing.currency` | 月額を書くとき `USD` / `EUR` / `JPY`。無いときは `null` |
| `pricing.monthlyAmount` | 個人向け有料の入口の、月払い定価。年額割引の月あたりは入れない。不明なら `null` |
| `pricing.yenAmount` | 公式が円建てで出している金額だけ。換算値は入れず、無ければ `null` |
| `pricing.short` | カード用の短い料金（48字以内） |
| `pricing.label` | ツールページの料金説明。何を確認し、何を未確認にしたかを書く |
| `pricing.sourceUrl` | 料金の参照元 |
| `japanese.ui` / `input` / `output` | `supported`（対応）/ `partial`（一部対応）/ `unsupported`（非対応）/ `unknown`（未確認） |
| `japanese.note` | その判断の根拠 |
| `editorial.features` / `usability` / `updates` | `score` は 1〜5 または `null`。`note` は理由。基準はサイトの評価基準ページと同じ |
| `addedAt` | このディレクトリへ追加した日（`YYYY-MM-DD`）。製品の発売日ではない |
| `lastChecked` | 料金と日本語対応を確認した日 |
| `sources` | 参照リンクの配列 |

`free` と `open-source` と `unknown` では `monthlyAmount` を `null` にしてください。価格点は tier から付きます。`open-source` は、リポジトリが寛容なライセンスだと確認できたときだけ使います。

### 記入例

```json
{
  "name": "Example",
  "url": "https://example.com",
  "category": "ai-app-builders",
  "description": "会話からWebアプリの画面を作るビルダーです。無料枠の有無は公式を見てください。",
  "detail": "ブラウザ上で画面を生成します。確認日時点の公式料金は Free と、Pro 月$20 です。円建ては未確認です。",
  "platforms": ["ブラウザ"],
  "pricing": {
    "tier": "freemium",
    "currency": "USD",
    "monthlyAmount": 20,
    "yenAmount": null,
    "short": "Pro 月$20〜",
    "label": "公式料金の Pro は月$20。Free あり。円建ては未確認です。",
    "sourceUrl": "https://example.com/pricing"
  },
  "japanese": {
    "ui": "unknown",
    "input": "unknown",
    "output": "unknown",
    "note": "UI・入力・出力ともに、公式の対応範囲を確認できていません。"
  },
  "editorial": {
    "features": { "score": 4, "note": "画面生成と公開が一つの製品でできます。" },
    "usability": { "score": 5, "note": "ブラウザだけでその日のうちに画面が出ます。" },
    "updates": { "score": null, "note": "直近の公式リリース日は特定できていません。" }
  },
  "addedAt": "2026-11-03",
  "lastChecked": "2026-11-03",
  "sources": [{ "label": "公式サイト", "url": "https://example.com" }]
}
```

## 採点

重みと式は `src/lib/score.ts` にあり、サイトの `/scoring/` が同じ定数を表示します。

- 機能 30%、日本語対応 25%、価格 15%、使いやすさ 20%、更新頻度 10%
- 各項目は 5 点満点。得点は「素点 ÷ 5 × 有効な重み」の合計（100点満点、小数第1位）
- 未確認の項目は 0 点にせず、重みごと外して残りを 100% に割り戻す
- 日本語点は UI・入力・出力がすべて確認できたときだけ付く
- 価格点は月払いの定価を帯で決める。ユーロはドルと同じ数字の帯で、円にもドルにも換算しない
- ライセンス料がない、またはオープンソースで購読が不要なら価格は 5。API の従量はこの点数に含めない

## ページ

- `/` ホーム
- `/categories/` と `/categories/<slug>/` カテゴリ順位
- `/tools/<slug>/` ツール
- `/usecases/` と `/usecases/<slug>/` 用途別おすすめ
- `/new/` 追加日の新しい順
- `/scoring/` 評価基準
- `/rss.xml` 新着の RSS
- `/llms.txt` 文章モデル向けの案内
- `/about/` `/privacy/` `/contact/` `/ads/` 運営・法務のプレースホルダ

お問い合わせとニュースレターのフォームは画面だけで、送信先は未接続です（TODO）。有料の配信サービスは使っていません。

## CI

`.github/workflows/ci.yml` が、pull request と push で `npm ci`、スキーマ検査、本番ビルド、リンク検査を実行します。
