import { navigateTo, requestExpandedMode } from "@devvit/web/client";

document.getElementById("open-button")?.addEventListener("click", (event) => {
  requestExpandedMode(event, "game");
});

document.getElementById("docs-link")?.addEventListener("click", () => {
  navigateTo("https://developers.reddit.com/docs");
});
