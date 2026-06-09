export const ApiEndpoint = {
  Health: "/api/health",
  BridgePost: "/internal/bifrost/reddit-post",
  BridgeComment: "/internal/bifrost/reddit-comment",
  OnPostCreate: "/internal/menu/post-create",
} as const;

export type ApiEndpoint = (typeof ApiEndpoint)[keyof typeof ApiEndpoint];

export type HealthResponse = {
  type: "health";
  app: "gamecult-bifrost";
  status: "ok";
};

export type BridgePostRequest = {
  actor: string;
  source: string;
  subredditName: string;
  title: string;
  text: string;
  idempotencyKey?: string;
};

export type BridgeCommentRequest = {
  actor: string;
  source: string;
  parentId: string;
  text: string;
  idempotencyKey?: string;
};

export type BridgeReceipt = {
  type: "bifrost.reddit.receipt";
  action: "reddit-post" | "reddit-comment";
  actor: string;
  source: string;
  target: string;
  redditId: string;
  url: string;
  createdAt: string;
};
