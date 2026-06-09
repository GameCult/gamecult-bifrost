import type { IncomingMessage, ServerResponse } from "node:http";
import { context, reddit } from "@devvit/web/server";
import type {
  PartialJsonValue,
  UiResponse,
} from "@devvit/web/shared";
import {
  ApiEndpoint,
  type BridgeCommentRequest,
  type BridgePostRequest,
  type BridgeReceipt,
  type HealthResponse,
} from "../shared/api.ts";
import { once } from "node:events";

export async function serverOnRequest(
  req: IncomingMessage,
  rsp: ServerResponse,
): Promise<void> {
  try {
    await onRequest(req, rsp);
  } catch (err) {
    if (err instanceof BridgeError) {
      writeJSON<ErrorResponse>(
        err.status,
        { error: err.message, status: err.status },
        rsp,
      );
      return;
    }

    const msg = `server error; ${err instanceof Error ? err.stack : err}`;
    console.error(msg);
    writeJSON<ErrorResponse>(500, { error: msg, status: 500 }, rsp);
  }
}

async function onRequest(
  req: IncomingMessage,
  rsp: ServerResponse,
): Promise<void> {
  const endpoint = getEndpoint(req.url);
  if (!endpoint) {
    writeJSON<ErrorResponse>(404, { error: "not found", status: 404 }, rsp);
    return;
  }

  let body: BridgeReceipt | HealthResponse | UiResponse;
  switch (endpoint) {
    case ApiEndpoint.Health:
      body = { type: "health", app: "gamecult-bifrost", status: "ok" };
      break;
    case ApiEndpoint.BridgePost:
      assertBridgeSecret(req);
      body = await onBridgePost(req);
      break;
    case ApiEndpoint.BridgeComment:
      assertBridgeSecret(req);
      body = await onBridgeComment(req);
      break;
    case ApiEndpoint.OnPostCreate:
      body = await onMenuNewPost();
      break;
    default:
      endpoint satisfies never;
      writeJSON<ErrorResponse>(404, { error: "not found", status: 404 }, rsp);
      return;
  }

  writeJSON<PartialJsonValue>(200, body, rsp);
}

type ErrorResponse = {
  error: string;
  status: number;
};

async function onBridgePost(req: IncomingMessage): Promise<BridgeReceipt> {
  const request = validatePostRequest(await readJSON<BridgePostRequest>(req));
  const post = await reddit.submitPost({
    subredditName: request.subredditName,
    title: request.title,
    text: renderGovernedBody(request.text, request),
    sendreplies: false,
    runAs: "APP",
  });

  return {
    type: "bifrost.reddit.receipt",
    action: "reddit-post",
    actor: request.actor,
    source: request.source,
    target: `r/${request.subredditName}`,
    redditId: post.id,
    url: post.url || redditPermalink(post.permalink),
    createdAt: new Date().toISOString(),
  };
}

async function onBridgeComment(req: IncomingMessage): Promise<BridgeReceipt> {
  const request = validateCommentRequest(
    await readJSON<BridgeCommentRequest>(req),
  );
  const comment = await reddit.submitComment({
    id: normalizeThingId(request.parentId),
    text: renderGovernedBody(request.text, request),
    runAs: "APP",
  });

  return {
    type: "bifrost.reddit.receipt",
    action: "reddit-comment",
    actor: request.actor,
    source: request.source,
    target: request.parentId,
    redditId: comment.id,
    url: comment.url || redditPermalink(comment.permalink),
    createdAt: new Date().toISOString(),
  };
}

async function onMenuNewPost(): Promise<UiResponse> {
  const subreddit = await reddit.getCurrentSubreddit();
  const post = await reddit.submitCustomPost({
    subredditName: subreddit.name,
    title: "Bifrost bridge intake",
    textFallback: {
      text:
        "Bifrost owns governed GameCult crossings into Reddit. " +
        "Canonical proposals, approvals, and receipts remain in Bifrost.",
    },
    postData: {
      kind: "gamecult-bifrost-bridge-hub",
      createdBy: context.username ?? "unknown",
    },
  });

  return {
    showToast: { text: `Bridge hub ${post.id} created.`, appearance: "success" },
    navigateTo: post.url || redditPermalink(post.permalink),
  };
}

function getEndpoint(url: string | undefined): ApiEndpoint | undefined {
  if (!url || url === "/") {
    return undefined;
  }

  const pathname = new URL(url, "https://devvit.local").pathname;
  return Object.values(ApiEndpoint).find((endpoint) => endpoint === pathname);
}

function assertBridgeSecret(req: IncomingMessage): void {
  const expectedSecret = process.env.BIFROST_REDDIT_BRIDGE_SECRET;
  if (!expectedSecret) {
    return;
  }

  const actualSecret = req.headers["x-bifrost-bridge-secret"];
  if (actualSecret !== expectedSecret) {
    throw new BridgeError(401, "invalid bridge secret");
  }
}

function validatePostRequest(request: BridgePostRequest): BridgePostRequest {
  assertNonEmpty(request.actor, "actor");
  assertNonEmpty(request.source, "source");
  assertNonEmpty(request.subredditName, "subredditName");
  assertNonEmpty(request.title, "title");
  assertNonEmpty(request.text, "text");
  return request;
}

function validateCommentRequest(
  request: BridgeCommentRequest,
): BridgeCommentRequest {
  assertNonEmpty(request.actor, "actor");
  assertNonEmpty(request.source, "source");
  assertNonEmpty(request.parentId, "parentId");
  assertNonEmpty(request.text, "text");
  return request;
}

function assertNonEmpty(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new BridgeError(400, `missing ${field}`);
  }
}

function normalizeThingId(id: string): `t1_${string}` | `t3_${string}` {
  if (id.startsWith("t1_") || id.startsWith("t3_")) {
    return id as `t1_${string}` | `t3_${string}`;
  }

  throw new BridgeError(400, "parentId must be a t1_ comment or t3_ post id");
}

function renderGovernedBody(
  body: string,
  request: BridgePostRequest | BridgeCommentRequest,
): string {
  const idempotency = request.idempotencyKey
    ? `\n\nBifrost idempotency: ${request.idempotencyKey}`
    : "";

  return `${body.trim()}\n\n---\nBifrost source: ${request.source}\nActor: ${request.actor}${idempotency}`;
}

function redditPermalink(permalink: string): string {
  if (permalink.startsWith("http")) {
    return permalink;
  }

  return `https://www.reddit.com${permalink}`;
}

function writeJSON<T extends PartialJsonValue>(
  status: number,
  json: Readonly<T>,
  rsp: ServerResponse,
): void {
  const body = JSON.stringify(json);
  const len = Buffer.byteLength(body);
  rsp.writeHead(status, {
    "Content-Length": len,
    "Content-Type": "application/json",
  });
  rsp.end(body);
}

async function readJSON<T>(req: IncomingMessage): Promise<T> {
  const chunks: Uint8Array[] = [];
  req.on("data", (chunk) => chunks.push(chunk));
  await once(req, "end");
  return JSON.parse(`${Buffer.concat(chunks)}`);
}

class BridgeError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
