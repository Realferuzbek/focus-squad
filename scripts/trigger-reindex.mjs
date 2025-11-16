#!/usr/bin/env node
import { setTimeout as delay } from "timers/promises";

const runningOnVercel = process.env.VERCEL === "1";
const secret = process.env.INDEXER_SECRET;

if (!runningOnVercel || !secret) {
  process.exit(0);
}

const baseUrl =
  process.env.POST_DEPLOY_REINDEX_URL ||
  normalizeHost(process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL) ||
  process.env.SITE_BASE_URL;

if (!baseUrl) {
  console.warn("[postdeploy] missing base URL; skipping reindex trigger");
  process.exit(0);
}

const target = new URL("/api/reindex", baseUrl).toString();

const attemptTrigger = async () => {
  try {
    const res = await fetch(target, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    const json = await res.json().catch(() => ({}));
    console.info("[postdeploy] reindex triggered", json?.stats ?? json);
  } catch (error) {
    console.warn("[postdeploy] reindex trigger failed", error);
  }
};

// Delay slightly to ensure deployment is routable.
await delay(4_000);
await attemptTrigger();

function normalizeHost(value) {
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `https://${value}`;
}
