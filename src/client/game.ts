import { navigateTo } from "@devvit/web/client";
import { ApiEndpoint, type HealthResponse } from "../shared/api.ts";

const statusElement = document.getElementById("bridge-status");

document.getElementById("docs-link")?.addEventListener("click", () => {
  navigateTo("https://developers.reddit.com/docs");
});

async function refreshStatus(): Promise<void> {
  if (!statusElement) {
    return;
  }

  try {
    const response = await fetch(ApiEndpoint.Health);
    const data = (await response.json()) as HealthResponse;
    statusElement.textContent =
      data.status === "ok" ? "Bridge actuator online" : "Bridge status unknown";
  } catch (error) {
    console.error("Unable to read bridge status", error);
    statusElement.textContent = "Bridge status unavailable";
  }
}

void refreshStatus();
