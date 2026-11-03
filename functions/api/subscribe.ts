/**
 * POST /api/subscribe
 *
 * Resend の連絡先を作り、RESEND_SEGMENT_ID のセグメントへ追加する。
 * 確認メールも歓迎メールも送らない。
 *
 * TODO: aitoolkobo.com を Resend で検証したら double opt-in の確認メールを送る。
 * pages.dev には検証済みの送信ドメインがないため、今は /emails を呼ばない。
 */

export type SubscribeEnv = {
  RESEND_API_KEY?: string;
  RESEND_SEGMENT_ID?: string;
};

export type RateLimitStore = {
  get(key: string): Promise<{ count: number } | null>;
  put(key: string, count: number, ttlSeconds: number): Promise<void>;
};

type SubscribeContext = {
  request: Request;
  env: SubscribeEnv;
};

const WINDOW_SECONDS = 10 * 60;
const MAX_ATTEMPTS = 5;
const MAX_BODY_BYTES = 4_096;
const CONTACTS_URL = "https://api.resend.com/contacts";

const MESSAGES = {
  subscribed: "登録を受け付けました。",
  already: "このアドレスはすでに登録されています。",
  invalidEmail: "メールアドレスの形式を確認してください。",
  consent: "配信への同意が必要です。",
  rateLimited: "短時間に何度も送信されています。しばらくしてからもう一度お試しください。",
  unavailable: "いま登録を受け付けられません。しばらくしてからもう一度お試しください。",
  failed: "登録を完了できませんでした。しばらくしてからもう一度お試しください。",
  badRequest: "送信内容を確認してください。",
  tooLarge: "送信内容が大きすぎます。",
} as const;

export const onRequestPost = (context: SubscribeContext): Promise<Response> => handleSubscribe(context.request, context.env);

export async function handleSubscribe(
  request: Request,
  env: SubscribeEnv,
  options: { store?: RateLimitStore; fetchImpl?: typeof fetch } = {},
): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const store = options.store ?? defaultStore();

  const lengthHeader = request.headers.get("content-length");
  if (lengthHeader && Number(lengthHeader) > MAX_BODY_BYTES) {
    return reply(request, 413, false, MESSAGES.tooLarge);
  }

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const allowed = await allowAttempt(store, ip);
  if (!allowed) return reply(request, 429, false, MESSAGES.rateLimited);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return reply(request, 400, false, MESSAGES.badRequest);
  }

  const honeypot = String(form.get("company") ?? "").trim();
  if (honeypot) {
    return reply(request, 200, true, MESSAGES.subscribed, "subscribed");
  }

  const email = normalizeEmail(String(form.get("email") ?? ""));
  if (!email) return reply(request, 400, false, MESSAGES.invalidEmail);
  if (form.get("consent") !== "yes") return reply(request, 400, false, MESSAGES.consent);

  const apiKey = env.RESEND_API_KEY?.trim();
  const segmentId = env.RESEND_SEGMENT_ID?.trim();
  if (!apiKey || !segmentId) {
    console.error("subscribe: RESEND_API_KEY or RESEND_SEGMENT_ID is missing");
    return reply(request, 503, false, MESSAGES.unavailable);
  }

  const created = await fetchImpl(CONTACTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      unsubscribed: false,
      segments: [{ id: segmentId }],
    }),
  });

  if (created.ok) return reply(request, 200, true, MESSAGES.subscribed, "subscribed");

  const createdError = await readJson(created);
  if (!isDuplicate(created.status, createdError)) {
    console.error(`subscribe: create contact failed (${created.status})`);
    return reply(request, 502, false, MESSAGES.failed);
  }

  const added = await fetchImpl(
    `${CONTACTS_URL}/${encodeURIComponent(email)}/segments/${encodeURIComponent(segmentId)}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
    },
  );
  if (added.ok) return reply(request, 200, true, MESSAGES.subscribed, "subscribed");
  if (added.status === 409 || isDuplicate(added.status, await readJson(added))) {
    return reply(request, 200, true, MESSAGES.already, "already");
  }

  console.error(`subscribe: add segment failed (${added.status})`);
  return reply(request, 502, false, MESSAGES.failed);
}

export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254) return null;
  if (email.includes("..") || /\s/.test(email)) return null;
  const pattern =
    /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
  return pattern.test(email) ? email : null;
}

async function allowAttempt(store: RateLimitStore, ip: string): Promise<boolean> {
  try {
    const current = await store.get(ip);
    const count = current?.count ?? 0;
    if (count >= MAX_ATTEMPTS) return false;
    await store.put(ip, count + 1, WINDOW_SECONDS);
    return true;
  } catch (error) {
    console.error("subscribe: rate limit store failed", error instanceof Error ? error.message : "unknown");
    return true;
  }
}

const isolateMemory = memoryStore();

function defaultStore(): RateLimitStore {
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  if (cache) return cloudflareCacheStore(cache);
  return isolateMemory;
}

function cloudflareCacheStore(cache: Cache): RateLimitStore {
  const urlFor = (key: string) =>
    `https://aitoolkobo.pages.dev/__rate/subscribe/${encodeURIComponent(key)}`;
  return {
    async get(key) {
      const hit = await cache.match(new Request(urlFor(key), { method: "GET" }));
      if (!hit) return null;
      const data = (await hit.json()) as { count?: number };
      return { count: Number(data.count) || 0 };
    },
    async put(key, count, ttlSeconds) {
      await cache.put(
        new Request(urlFor(key), { method: "GET" }),
        new Response(JSON.stringify({ count }), {
          headers: {
            "Cache-Control": `public, max-age=${ttlSeconds}`,
            "Content-Type": "application/json",
          },
        }),
      );
    },
  };
}

function memoryStore(): RateLimitStore {
  const entries = new Map<string, { count: number; expires: number }>();
  return {
    async get(key) {
      const entry = entries.get(key);
      if (!entry || entry.expires <= Date.now()) return null;
      return { count: entry.count };
    },
    async put(key, count, ttlSeconds) {
      entries.set(key, { count, expires: Date.now() + ttlSeconds * 1000 });
    },
  };
}

function isDuplicate(status: number, payload: unknown): boolean {
  if (status === 409) return true;
  const record = payload && typeof payload === "object" ? (payload as { message?: unknown; name?: unknown }) : {};
  const text = `${String(record.message ?? "")} ${String(record.name ?? "")}`;
  return /already exists/i.test(text);
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function wantsHtml(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("text/html") && !accept.includes("application/json");
}

function reply(
  request: Request,
  status: number,
  ok: boolean,
  message: string,
  result?: "subscribed" | "already",
): Response {
  if (wantsHtml(request)) {
    const title = ok ? "登録" : "登録できませんでした";
    const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} | AIツール工房</title>
</head>
<body style="margin:0;background:#f3efe4;color:#1f1a17;font-family:sans-serif;line-height:1.7">
  <main style="max-width:36rem;margin:0 auto;padding:2.5rem 1.25rem">
    <p style="letter-spacing:.12em;color:#a33b24;font-size:.82rem">AIツール工房</p>
    <h1 style="font-size:1.8rem">${title}</h1>
    <p>${message}</p>
    <p><a href="/" style="color:#7d2c1b">ホームへ戻る</a></p>
  </main>
</body>
</html>`;
    return new Response(html, {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  return new Response(JSON.stringify({ ok, message, status: result ?? (ok ? "subscribed" : "error") }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
