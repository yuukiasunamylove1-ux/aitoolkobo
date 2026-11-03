import assert from "node:assert/strict";
import test from "node:test";
import { handleSubscribe, normalizeEmail, type RateLimitStore } from "../functions/api/subscribe.ts";

const env = { RESEND_API_KEY: "re_test", RESEND_SEGMENT_ID: "seg_test" };

function store(): RateLimitStore {
  const counts = new Map<string, number>();
  return {
    async get(key) {
      const count = counts.get(key);
      return count == null ? null : { count };
    },
    async put(key, count) {
      counts.set(key, count);
    },
  };
}

function request(fields: Record<string, string>, accept = "application/json", ip = "203.0.113.5") {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.set(key, value);
  return new Request("https://aitoolkobo.pages.dev/api/subscribe", {
    method: "POST",
    headers: { Accept: accept, "CF-Connecting-IP": ip },
    body,
  });
}

const valid = { email: "Reader@Example.com", consent: "yes" };

test("normalizeEmail lowercases a normal address and rejects junk", () => {
  assert.equal(normalizeEmail("  Reader@Example.com "), "reader@example.com");
  assert.equal(normalizeEmail("not-an-email"), null);
  assert.equal(normalizeEmail("a@b"), null);
  assert.equal(normalizeEmail(`${"a".repeat(250)}@example.com`), null);
});

test("missing secrets return 503 and do not call Resend", async () => {
  let called = false;
  const response = await handleSubscribe(request(valid), {}, {
    store: store(),
    fetchImpl: async () => {
      called = true;
      return new Response(null, { status: 500 });
    },
  });
  assert.equal(response.status, 503);
  const payload = await response.json();
  assert.equal(payload.ok, false);
  assert.match(payload.message, /受け付けられません/);
  assert.equal(called, false);
});

test("invalid email and missing consent are rejected", async () => {
  const badEmail = await handleSubscribe(request({ email: "nope", consent: "yes" }), env, { store: store() });
  assert.equal(badEmail.status, 400);
  assert.match((await badEmail.json()).message, /形式/);

  const noConsent = await handleSubscribe(request({ email: "reader@example.com", consent: "" }), env, {
    store: store(),
  });
  assert.equal(noConsent.status, 400);
  assert.match((await noConsent.json()).message, /同意/);
});

test("honeypot skips Resend and looks successful", async () => {
  let called = false;
  const response = await handleSubscribe(request({ ...valid, company: "https://spam.example" }), env, {
    store: store(),
    fetchImpl: async () => {
      called = true;
      return new Response(null, { status: 500 });
    },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  assert.equal(called, false);
});

test("creates a contact in the segment and does not send mail", async () => {
  const calls: { url: string; body: string }[] = [];
  const response = await handleSubscribe(request(valid), env, {
    store: store(),
    fetchImpl: async (input, init) => {
      calls.push({ url: String(input), body: String(init?.body ?? "") });
      return Response.json({ object: "contact", id: "contact_1" }, { status: 201 });
    },
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.status, "subscribed");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.resend.com/contacts");
  assert.equal(calls.some((call) => call.url.includes("/emails")), false);
  const body = JSON.parse(calls[0].body);
  assert.equal(body.email, "reader@example.com");
  assert.equal(body.unsubscribed, false);
  assert.deepEqual(body.segments, [{ id: "seg_test" }]);
});

test("duplicate contacts are added to the segment", async () => {
  const urls: string[] = [];
  const response = await handleSubscribe(request(valid, "application/json", "203.0.113.9"), env, {
    store: store(),
    fetchImpl: async (input, init) => {
      const url = String(input);
      urls.push(url);
      if (url.endsWith("/contacts")) {
        return Response.json({ message: "Contact already exists", name: "validation_error" }, { status: 409 });
      }
      assert.equal(init?.method, "POST");
      assert.match(url, /\/contacts\/reader%40example.com\/segments\/seg_test$/);
      return Response.json({ id: "seg_test" }, { status: 200 });
    },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "subscribed");
  assert.equal(urls.length, 2);
});

test("already in the segment is still a success", async () => {
  const response = await handleSubscribe(request(valid, "application/json", "203.0.113.10"), env, {
    store: store(),
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.endsWith("/contacts")) {
        return Response.json({ message: "Contact already exists" }, { status: 409 });
      }
      return Response.json({ message: "Contact already exists" }, { status: 409 });
    },
  });
  assert.equal(response.status, 200);
  assert.match((await response.json()).message, /すでに登録/);
});

test("sixth attempt from the same IP is limited", async () => {
  let calls = 0;
  const shared = store();
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    return Response.json({ id: "contact_1" }, { status: 201 });
  };
  for (let i = 0; i < 5; i += 1) {
    const response = await handleSubscribe(request(valid, "application/json", "203.0.113.20"), env, {
      store: shared,
      fetchImpl,
    });
    assert.equal(response.status, 200);
  }
  const blocked = await handleSubscribe(request(valid, "application/json", "203.0.113.20"), env, {
    store: shared,
    fetchImpl,
  });
  assert.equal(blocked.status, 429);
  assert.equal(calls, 5);
});

test("a browser form post gets Japanese HTML", async () => {
  const response = await handleSubscribe(
    request(valid, "text/html,application/xhtml+xml", "203.0.113.30"),
    env,
    {
      store: store(),
      fetchImpl: async () => Response.json({ id: "contact_1" }, { status: 201 }),
    },
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/html/);
  const html = await response.text();
  assert.match(html, /lang="ja"/);
  assert.match(html, /登録を受け付けました/);
  assert.match(html, /ホームへ戻る/);
});
