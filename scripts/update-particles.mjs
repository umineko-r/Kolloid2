import fs from "node:fs/promises";
import path from "node:path";
import Parser from "rss-parser";

const parser = new Parser();

const CONTRIBUTORS_PATH = path.join(process.cwd(), "src", "data", "contributors.json");
const OUT_PATH = path.join(process.cwd(), "public", "data", "particles.json");

// 既存の手動particlesを残したい場合は true
const MERGE_WITH_EXISTING = true;

function toYMD(dateLike) {
  if (!dateLike) return null;
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function stableId(contributor, siteType, link) {
  // linkから短い安定IDを作る（内容が変わっても同一リンクなら同一ID）
  const base = Buffer.from(link).toString("base64url").slice(0, 12);
  return `${contributor}-${siteType}-${base}`;
}

function normalizeFeedItem(feedDef, item) {
  const link = (item.link || item.guid || "").trim();
  const title = (item.title || "").trim();
  if (!link || !title) return null;

  const updatedAt = toYMD(item.isoDate || item.pubDate);

  return {
    id: stableId(feedDef.contributor, feedDef.siteType, link),
    contributor: feedDef.contributor,
    title,
    link,
    genre: feedDef.genre,
    siteType: feedDef.siteType,
    updatedAt: updatedAt || undefined,
  };
}

async function readJsonSafe(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function collectFeeds(contributorsMap) {
  const feeds = [];
  for (const [contributor, data] of Object.entries(contributorsMap || {})) {
    const defs = data.feeds || data.feed || []; // feed でも feeds でも受ける
    if (!Array.isArray(defs)) continue;

    for (const def of defs) {
      if (!def?.url || !def?.siteType || !def?.genre) continue;
      feeds.push({
        contributor,
        siteType: def.siteType,
        genre: def.genre,
        url: def.url,
      });
    }
  }
  return feeds;
}

async function main() {
  const contributorsMap = await readJsonSafe(CONTRIBUTORS_PATH, {});
  const feedDefs = collectFeeds(contributorsMap);

  if (feedDefs.length === 0) {
    console.error("[update] no feeds found in contributors.json");
    process.exit(1);
  }

  const fetched = [];

  for (const fd of feedDefs) {
    try {
      const res = await parser.parseURL(fd.url);
      const items = Array.isArray(res.items) ? res.items : [];
      for (const item of items) {
        const p = normalizeFeedItem(fd, item);
        if (p) fetched.push(p);
      }
      console.log(`[update] ok: ${fd.contributor} ${fd.siteType} -> ${items.length} items`);
    } catch (e) {
      console.warn(`[update] failed: ${fd.contributor} ${fd.siteType} ${fd.url}`);
      console.warn(e);
    }
  }

  // 既存particlesとマージ（手動分がある場合）
  const existing = MERGE_WITH_EXISTING ? await readJsonSafe(OUT_PATH, []) : [];
  const existingArr = Array.isArray(existing) ? existing : [];

  // linkで一意化（重複防止）
  const byLink = new Map();

  // 既存 → 新規の順で入れると、新規が同linkで上書きされる
  for (const p of existingArr) {
    if (p?.link) byLink.set(p.link, p);
  }
  for (const p of fetched) {
    byLink.set(p.link, p);
  }

  const merged = [...byLink.values()];

  // updatedAt降順（無いものは後ろへ）
  merged.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(merged, null, 2), "utf-8");

  console.log(`[update] wrote ${merged.length} particles -> ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
