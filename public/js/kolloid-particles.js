// kolloid-particles.js

export function createKolloidSketch() {
  return (p) => {
    const particles = [];
    const NUM = 90;

    class Particle {
      constructor() {
        this.reset();
      }

      reset() {
        this.x = p.random(p.width);
        this.y = p.random(p.height);
        this.r = p.random(10, 40); // 粒子の半径
        this.vx = p.random(-0.3, 0.3);
        this.vy = p.random(-0.3, 0.3);
        this.alpha = p.random(60, 120);
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;

        // 画面外に出すぎたらリセット
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
        // 人肌っぽい淡い暖色
        p.fill(255, 190, 170, this.alpha);
        p.circle(this.x, this.y, this.r * 2);
      }
    }

    /** 粒子同士が近すぎる場合に、少しだけ押し広げる */
    function resolveOverlaps() {
      const padding = 4; // 粒子同士の最小すき間

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];

          const dx = b.x - a.x;
          const dy = b.y - a.y;
          let dist = Math.sqrt(dx * dx + dy * dy);

          const minDist = a.r + b.r + padding;

          if (dist === 0) {
            // 全く同じ座標のときは適当にずらす
            dist = 0.01;
          }

          if (dist < minDist) {
            // 重なり量（どのくらい近すぎるか）
            const overlap = (minDist - dist) / 2;
            const strength = 0.5; // 0〜1で調整してみる

            // 正規化ベクトル（a→b の方向）
            const ux = dx / dist;
            const uy = dy / dist;

            // aを少し手前に、bを少し奥にずらす（対称に）
            a.x -= ux * overlap * strength;
            a.y -= uy * overlap * strength;
            b.x += ux * overlap * strength;
            b.y += uy * overlap * strength;
          }
        }
      }
    }

    p.setup = () => {
      const container = document.getElementById("canvas-container");
      const canvas = p.createCanvas(window.innerWidth, window.innerHeight);
      canvas.parent(container);

      for (let i = 0; i < NUM; i++) {
        particles.push(new Particle());
      }

      p.frameRate(30);
    };

    p.windowResized = () => {
      p.resizeCanvas(window.innerWidth, window.innerHeight);
    };

    p.draw = () => {
      // 乳白色の背景
      p.background(247, 245, 242);

      // まずは通常の移動
      for (const part of particles) {
        part.update();
      }

      // 近すぎる粒子同士を押し広げる
      for (let k = 0; k < 3; k++) {
        resolveOverlaps();
      }
      // 描画
      for (const part of particles) {
        part.draw();
      }
    };
  };
}