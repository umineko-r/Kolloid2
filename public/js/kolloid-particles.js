// public/js/kolloid-particles.js
// 更新情報JSONを読み込み、粒子として表示する版（自動cap対応）
// - enableLinks=true: JSON粒子（リンク/hoverあり）
// - enableLinks=false: ダミー粒子（リンク/hoverなし）
//
// ★重要：enableLinks は「起動時固定」ではなく、bodyのdata属性を毎回参照して強制的に反映する
//        これにより、もし p5 がページ遷移で生き残っても About/Statement では確実にリンクOFFになる。
console.log("[kolloid] particles.js loaded v=20251223-1");

function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function clamp(x, min, max) {
  return Math.max(min, Math.min(max, x));
}

function selectItems(allItems, opts) {
  const {
    totalCount,
    newRatio = 0.3,
    recentDays = 30,
    instagramPerAccountCap = 5,
  } = opts;

  const normalized = (Array.isArray(allItems) ? allItems : [])
    .map((it) => ({
      ...it,
      _updatedAt: toDate(it.updatedAt),
      _key: it.id || it.link,
    }))
    .filter((it) => it.creator && it.title && it.link && it._key);

  if (normalized.length === 0) return [];

  // Instagram 制限（1アカウント5投稿）
  const ig = normalized.filter((it) => it.siteType === "instagram");
  const nonIg = normalized.filter((it) => it.siteType !== "instagram");

  const igByAccount = new Map();
  for (const it of ig) {
    const key = (it.account || it.creator || "").trim() || "unknown";
    if (!igByAccount.has(key)) igByAccount.set(key, []);
    igByAccount.get(key).push(it);
  }

  const igCapped = [];
  for (const [, arr] of igByAccount) {
    arr.sort((a, b) => {
      const ta = a._updatedAt ? a._updatedAt.getTime() : 0;
      const tb = b._updatedAt ? b._updatedAt.getTime() : 0;
      return tb - ta;
    });
    igCapped.push(...arr.slice(0, instagramPerAccountCap));
  }

  const items = [...nonIg, ...igCapped];

  // Contributors 数 M
  const contributors = new Set(items.map((x) => x.creator)).size || 1;

  // 新しめ候補
  const now = new Date();
  const cutoff = new Date(now.getTime() - recentDays * 24 * 60 * 60 * 1000);

  const recentPool = items.filter((it) => it._updatedAt && it._updatedAt >= cutoff);

  const sortedByNew = [...items].sort((a, b) => {
    const ta = a._updatedAt ? a._updatedAt.getTime() : 0;
    const tb = b._updatedAt ? b._updatedAt.getTime() : 0;
    return tb - ta;
  });

  const newPool =
    recentPool.length > 0
      ? recentPool
      : sortedByNew.slice(0, Math.ceil(totalCount * 0.5));

  const newCount = Math.min(newPool.length, Math.round(totalCount * newRatio));

  const newPicked = shuffle([...newPool]).slice(0, newCount);
  const pickedKeys = new Set(newPicked.map((x) => x._key));

  const remaining = items.filter((x) => !pickedKeys.has(x._key));
  const randomCount = Math.max(0, totalCount - newPicked.length);

  // 自動 cap 計算
  const autoCap = clamp(Math.floor(randomCount / contributors), 2, 5);

  function pickWithCap(candidates, want, cap) {
    const counts = new Map();
    const out = [];
    const shuffled = shuffle([...candidates]);

    for (const it of shuffled) {
      if (out.length >= want) break;
      const key = it.creator;
      const c = counts.get(key) || 0;
      if (c >= cap) continue;
      counts.set(key, c + 1);
      out.push(it);
    }
    return out;
  }

  let randomPicked = pickWithCap(remaining, randomCount, autoCap);

  // 足りない場合は緩める（場を埋める）
  if (randomPicked.length < randomCount) {
    for (const extra of [1, 2, 9999]) {
      const cap = autoCap + extra;
      const used = new Set(randomPicked.map((x) => x._key));
      const rest = remaining.filter((x) => !used.has(x._key));
      const more = pickWithCap(rest, randomCount - randomPicked.length, cap);
      randomPicked = randomPicked.concat(more);
      if (randomPicked.length >= randomCount) break;
    }
  }

  const final = [...newPicked, ...randomPicked];
  shuffle(final);
  return final;
}

function targetCount() {
  const w = window.innerWidth;
  if (w <= 600) return 32;
  if (w <= 1024) return 44;
  return 56;
}

// ★ここが肝：今この瞬間にリンクが許可されているかを毎回読む
function isLinksEnabled() {
  return document.body?.dataset?.enableLinks === "true";
}

export function createKolloidSketch(options = {}) {
  // 起動時の値も受け取るが、実際の挙動は isLinksEnabled() を優先する
  const { enableLinks: initialEnableLinks = false } = options;

  return (p) => {
    const particles = [];
    let items = [];
    let hovered = null;

    class Particle {
      constructor(item) {
        this.item = item; // item=null の場合はダミー粒子
        this.reset(true);
      }

      reset(first = false) {
        this.x = p.random(p.width);
        this.y = p.random(p.height);
        const isTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);
        this.r = isTouch ? p.random(16, 46) : p.random(10, 40);
        this.vx = p.random(-0.3, 0.3);
        this.vy = p.random(-0.3, 0.3);
        this.alpha = p.random(60, 120);

        if (first) {
          this.x = p.random(p.width * 0.1, p.width * 0.9);
          this.y = p.random(p.height * 0.15, p.height * 0.9);
        }
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (
          this.x < -50 ||
          this.x > p.width + 50 ||
          this.y < -50 ||
          this.y > p.height + 50
        ) {
          this.reset();
        }
      }

      draw() {
        p.noStroke();
        p.fill(255, 190, 170, this.alpha);
        p.circle(this.x, this.y, this.r * 2);
      }

      hitTest(mx, my) {
        const dx = mx - this.x;
        const dy = my - this.y;

        // タッチ端末は当たり判定を広げる（指サイズ対策）
        const isTouch =
          "ontouchstart" in window || navigator.maxTouchPoints > 0;

        // 最低でも 26px くらいは欲しい（指が乗る面積）
        const extra = isTouch ? 18 : 0;

        const rr = this.r + extra;
        return dx * dx + dy * dy <= rr * rr;
      }
    }

    function resolveOverlaps() {
      const padding = 4;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          let dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = a.r + b.r + padding;
          if (dist === 0) dist = 0.01;
          if (dist < minDist) {
            const overlap = (minDist - dist) / 2;
            const ux = dx / dist;
            const uy = dy / dist;
            a.x -= ux * overlap * 0.5;
            a.y -= uy * overlap * 0.5;
            b.x += ux * overlap * 0.5;
            b.y += uy * overlap * 0.5;
          }
        }
      }
    }

    async function loadItems() {
      const res = await fetch("/data/particles.json", { cache: "no-store" });
      if (!res.ok) throw new Error("particles.json fetch failed");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }

    function buildDummyParticles() {
      particles.length = 0;
      const count = targetCount();
      for (let i = 0; i < count; i++) {
        particles.push(new Particle(null));
      }
    }

    function rebuildDataParticles() {
      particles.length = 0;
      const selected = selectItems(items, {
        totalCount: targetCount(),
        newRatio: 0.3,
        recentDays: 30,
        instagramPerAccountCap: 5,
      });
      for (const it of selected) particles.push(new Particle(it));
    }

    function drawTooltip(it) {
      if (!it) return;

      p.push();
      p.textAlign(p.LEFT, p.TOP);
      p.textSize(12);

      const pad = 10;
      const line1 = it.title ?? "";
      const line2 = it.creator ?? "";

      const w = Math.max(p.textWidth(line1), p.textWidth(line2)) + pad * 2;
      const h = pad * 2 + 30;

      let x = p.mouseX + 14;
      let y = p.mouseY + 14;
      if (x + w > p.width) x = p.width - w - 10;
      if (y + h > p.height) y = p.height - h - 10;

      p.fill(255, 255, 255, 230);
      p.rect(x, y, w, h, 10);

      p.fill(40);
      p.text(line1, x + pad, y + pad);

      p.fill(90);
      p.text(line2, x + pad, y + pad + 16);

      p.pop();
    }

    p.setup = () => {
      const container = document.getElementById("canvas-container");
      const canvas = p.createCanvas(window.innerWidth, window.innerHeight);
      canvas.parent(container);
      p.frameRate(30);

      // 起動時点で enableLinks が true ならデータ粒子、falseならダミー
      // ただし、後から isLinksEnabled() が false になっても挙動は止める
      if (initialEnableLinks) {
        loadItems()
          .then((data) => {
            items = data;
            rebuildDataParticles();
          })
          .catch((e) => {
            console.error(e);
            buildDummyParticles();
          });
      } else {
        buildDummyParticles();
      }
    };

    p.windowResized = () => {
      p.resizeCanvas(window.innerWidth, window.innerHeight);
      // 形だけは維持
      if (initialEnableLinks) rebuildDataParticles();
      else buildDummyParticles();
    };

    p.mouseMoved = () => {
      // ★ここで毎回判定（これで About/Statement では確実に無効化される）
      if (!isLinksEnabled()) {
        hovered = null;
        p.cursor("default");
        return;
      }

      hovered = null;
      for (let i = particles.length - 1; i >= 0; i--) {
        if (particles[i].hitTest(p.mouseX, p.mouseY)) {
          hovered = particles[i];
          break;
        }
      }
      p.cursor(hovered?.item?.link ? "pointer" : "default");
    };

    p.mouseClicked = () => {
      if (!isLinksEnabled()) return;
      const url = hovered?.item?.link;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    };
        
    p.touchStarted = () => {
      // 画面スクロールを邪魔しないため、リンクOFFなら何もしない
      if (!isLinksEnabled()) return true;

      // タップ地点（touches[0]）で判定
      const t = p.touches && p.touches[0];
      const mx = t ? t.x : p.mouseX;
      const my = t ? t.y : p.mouseY;

      let hit = null;
      for (let i = particles.length - 1; i >= 0; i--) {
        if (particles[i].hitTest(mx, my)) {
          hit = particles[i];
          break;
        }
      }

      const url = hit?.item?.link;
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
        return false; // ★タップイベント消費（誤作動防止）
      }

      return true;
    };

    p.draw = () => {
      p.background(247, 245, 242);

      for (const ptl of particles) ptl.update();
      for (let i = 0; i < 3; i++) resolveOverlaps();
      for (const ptl of particles) ptl.draw();

      // ★ツールチップも毎回判定
      if (isLinksEnabled() && hovered?.item) drawTooltip(hovered.item);
    };
  };
}