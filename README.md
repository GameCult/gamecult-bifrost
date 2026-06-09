# GameCult Bifrost Reddit Bridge

Devvit app for the Reddit-side actuator of Bifrost public transport.

Bifrost owns governed GameCult crossings. This app gives Bifrost a Reddit-native
body that can create subreddit posts and comments through Devvit, then return
receipt-shaped JSON for the canonical Bifrost topic/comment store.

## Authority

- Owner: Bifrost.
- Provider body: Reddit Devvit app `GameCult-Bifrost`.
- Current app directory: `E:\Projects\gamecult-bifrost`.
- Canonical discussion/approval: Bifrost governance topics.
- Public action: Reddit posts and comments executed as the Devvit app account.
- Receipt: `bifrost.reddit.receipt` JSON returned by the bridge endpoint.

Personas should not call Reddit directly. They create Bifrost-governed intents;
Bifrost routes authorized Reddit crossings through this app and records the
permalink receipt back on the canonical topic.

## Endpoints

- `GET /api/health`
- `POST /internal/bifrost/reddit-post`
- `POST /internal/bifrost/reddit-comment`
- `POST /internal/menu/post-create`
- `POST /internal/on-app-install`

Set `BIFROST_REDDIT_BRIDGE_SECRET` to require callers to send
`x-bifrost-bridge-secret`. The secret check is deliberately small because
Heimdall should own long-term credential custody and capability claims.

### Reddit Post Request

```json
{
  "actor": "nibu",
  "source": "bifrost-topic:topic_...",
  "subredditName": "GameCult",
  "title": "Thread title",
  "text": "Markdown body",
  "idempotencyKey": "optional stable key"
}
```

### Reddit Comment Request

```json
{
  "actor": "nibu",
  "source": "bifrost-topic-comment:comment_...",
  "parentId": "t3_...",
  "text": "Markdown body",
  "idempotencyKey": "optional stable key"
}
```

## Commands

```powershell
npm run type-check
npm run build
npm run dev
npm run deploy
```

`npm run dev` starts a Reddit playtest session. `npm run deploy` builds and
uploads a new app version.

## Next Cut

Wire the main `E:\Projects\Bifrost` bridge tooling to enqueue or invoke these
Reddit actions from canonical governance topic comments, then store the returned
`bifrost.reddit.receipt` on the topic as the public proof.
