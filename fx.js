// =====================================================
// FX.JS — Background galaksi + animasi tampilan
// Terpisah dari app.js: hanya efek visual, tidak mengubah data.
// =====================================================
(function() {
  "use strict";

  const reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* =========================================
     1. GALAXY CANVAS
  ========================================= */
  function startGalaxy() {
    const canvas = document.getElementById("galaxyCanvas");
    if (!canvas || !canvas.getContext) return;

    const ctx = canvas.getContext("2d");
    const DPR = Math.min(window.devicePixelRatio || 1, 1.75);

    let W = 0;
    let H = 0;
    let stars = [];
    let galaxySprite = null;
    let shooting = [];
    let nextShootAt = 0;
    let running = true;
    let pointerX = 0;
    let pointerY = 0;
    let parallaxX = 0;
    let parallaxY = 0;

    const STAR_COLORS = ["255,255,255", "214,226,255", "255,240,214", "200,214,255", "255,222,240"];

    function rand(min, max) {
      return min + Math.random() * (max - min);
    }

    function buildStars() {
      const count = Math.min(900, Math.round((W * H) / 1700));
      stars = [];

      for (let i = 0; i < count; i++) {
        const depth = Math.random();
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: depth < 0.85 ? rand(0.25, 0.9) : rand(0.9, 1.7),
          depth: depth,
          phase: Math.random() * Math.PI * 2,
          speed: rand(0.4, 1.8),
          base: rand(0.35, 0.95),
          color: STAR_COLORS[(Math.random() * STAR_COLORS.length) | 0],
          drift: rand(0.004, 0.02)
        });
      }
    }

    // Spiral galaxy digambar sekali ke canvas terpisah, lalu diputar tiap frame (ringan)
    function buildGalaxySprite() {
      const size = Math.round(Math.min(Math.max(W, H) * 0.95, 1100) * DPR);
      const sprite = document.createElement("canvas");
      sprite.width = size;
      sprite.height = size;

      const g = sprite.getContext("2d");
      const c = size / 2;
      const maxR = size * 0.48;

      // cahaya inti
      const core = g.createRadialGradient(c, c, 0, c, c, maxR * 0.42);
      core.addColorStop(0, "rgba(255, 244, 214, 0.95)");
      core.addColorStop(0.08, "rgba(255, 220, 160, 0.55)");
      core.addColorStop(0.3, "rgba(167, 139, 250, 0.16)");
      core.addColorStop(1, "rgba(0, 0, 0, 0)");
      g.fillStyle = core;
      g.fillRect(0, 0, size, size);

      g.globalCompositeOperation = "lighter";

      const arms = 3;
      const particles = W < 700 ? 2600 : 5200;
      const twist = 3.4;

      for (let i = 0; i < particles; i++) {
        const t = Math.pow(Math.random(), 0.72);
        const r = t * maxR;
        const arm = (i % arms) * (Math.PI * 2 / arms);
        const spread = (1 - t * 0.55) * 0.55;
        const angle = arm + t * twist * Math.PI + rand(-spread, spread) * (1.2 - t);
        const scatter = rand(-1, 1) * maxR * 0.035 * (1 + t);

        const x = c + Math.cos(angle) * r + scatter;
        const y = c + Math.sin(angle) * r + rand(-1, 1) * maxR * 0.035 * (1 + t);

        let color;
        if (t < 0.18) color = "255, 232, 190";
        else if (Math.random() < 0.55) color = "150, 180, 255";
        else if (Math.random() < 0.5) color = "196, 160, 255";
        else color = "240, 170, 230";

        const alpha = (1 - t) * 0.55 + 0.08;
        const pr = (Math.random() < 0.04 ? rand(1.4, 2.4) : rand(0.4, 1.1)) * DPR;

        g.fillStyle = "rgba(" + color + "," + alpha.toFixed(3) + ")";
        g.beginPath();
        g.arc(x, y, pr, 0, Math.PI * 2);
        g.fill();
      }

      // kabut lengan galaksi
      for (let k = 0; k < 90; k++) {
        const t = Math.random();
        const arm = (k % arms) * (Math.PI * 2 / arms);
        const angle = arm + t * twist * Math.PI;
        const r = t * maxR;
        const x = c + Math.cos(angle) * r;
        const y = c + Math.sin(angle) * r;
        const fr = maxR * rand(0.05, 0.12);
        const fog = g.createRadialGradient(x, y, 0, x, y, fr);
        const tone = Math.random() < 0.5 ? "124, 92, 246" : "56, 150, 248";
        fog.addColorStop(0, "rgba(" + tone + ", 0.07)");
        fog.addColorStop(1, "rgba(" + tone + ", 0)");
        g.fillStyle = fog;
        g.fillRect(x - fr, y - fr, fr * 2, fr * 2);
      }

      galaxySprite = sprite;
    }

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
      buildStars();
      buildGalaxySprite();
      if (reduceMotion) draw(performance.now());
    }

    function spawnShootingStar(now) {
      const fromLeft = Math.random() < 0.5;
      const speed = rand(0.9, 1.5);
      const angle = fromLeft ? rand(0.25, 0.55) : Math.PI - rand(0.25, 0.55);

      shooting.push({
        x: fromLeft ? rand(-0.1 * W, 0.5 * W) : rand(0.5 * W, 1.1 * W),
        y: rand(-0.05 * H, 0.4 * H),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        len: rand(120, 240),
        born: now,
        life: rand(900, 1500)
      });

      nextShootAt = now + rand(2600, 6500);
    }

    function draw(now) {
      const t = now / 1000;

      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // parallax halus mengikuti kursor & scroll
      const scrollShift = (window.scrollY || 0) * 0.04;
      parallaxX += (pointerX - parallaxX) * 0.04;
      parallaxY += (pointerY - parallaxY) * 0.04;

      // galaksi spiral
      if (galaxySprite) {
        const mobile = W < 700;
        const gx = (mobile ? W * 0.5 : W * 0.7) + parallaxX * 18;
        const gy = (mobile ? H * 0.32 : H * 0.34) + parallaxY * 12 - scrollShift * 0.6;
        const scale = (mobile ? 1.05 : 0.8) / DPR;

        ctx.save();
        ctx.globalAlpha = mobile ? 0.7 : 0.85;
        ctx.globalCompositeOperation = "lighter";
        ctx.translate(gx, gy);
        ctx.rotate(-0.42);
        ctx.scale(1, 0.46);
        ctx.rotate(reduceMotion ? 0 : t * 0.018);
        ctx.drawImage(
          galaxySprite,
          -galaxySprite.width * scale / 2,
          -galaxySprite.height * scale / 2,
          galaxySprite.width * scale,
          galaxySprite.height * scale
        );
        ctx.restore();
      }

      // bintang berkelip
      ctx.globalCompositeOperation = "lighter";

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const twinkle = reduceMotion ? 1 : 0.55 + 0.45 * Math.sin(t * s.speed + s.phase);
        const alpha = s.base * twinkle;

        let x = s.x + parallaxX * (s.depth * 14);
        let y = s.y + parallaxY * (s.depth * 10) - scrollShift * s.depth;

        if (!reduceMotion) x -= (t * s.drift * 60 * s.depth) % W;

        x = ((x % W) + W) % W;
        y = ((y % H) + H) % H;

        ctx.fillStyle = "rgba(" + s.color + "," + alpha.toFixed(3) + ")";

        if (s.r > 1.1) {
          ctx.beginPath();
          ctx.arc(x, y, s.r, 0, Math.PI * 2);
          ctx.fill();

          // kilau silang untuk bintang terang
          if (alpha > 0.7) {
            ctx.fillStyle = "rgba(" + s.color + "," + (alpha * 0.35).toFixed(3) + ")";
            ctx.fillRect(x - s.r * 3.5, y - 0.35, s.r * 7, 0.7);
            ctx.fillRect(x - 0.35, y - s.r * 3.5, 0.7, s.r * 7);
          }
        } else {
          ctx.fillRect(x, y, s.r * 1.6, s.r * 1.6);
        }
      }

      // bintang jatuh
      if (!reduceMotion) {
        if (now > nextShootAt) spawnShootingStar(now);

        shooting = shooting.filter(function(s) {
          const age = now - s.born;
          if (age > s.life) return false;

          const p = age / s.life;
          const hx = s.x + s.vx * age * 0.6;
          const hy = s.y + s.vy * age * 0.6;
          const tx = hx - s.vx * s.len;
          const ty = hy - s.vy * s.len;
          const fade = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85;

          const grad = ctx.createLinearGradient(hx, hy, tx, ty);
          grad.addColorStop(0, "rgba(255, 248, 225," + (0.95 * fade).toFixed(3) + ")");
          grad.addColorStop(0.3, "rgba(180, 200, 255," + (0.4 * fade).toFixed(3) + ")");
          grad.addColorStop(1, "rgba(160, 140, 255, 0)");

          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.6;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(hx, hy);
          ctx.lineTo(tx, ty);
          ctx.stroke();

          ctx.fillStyle = "rgba(255, 250, 235," + fade.toFixed(3) + ")";
          ctx.beginPath();
          ctx.arc(hx, hy, 1.6, 0, Math.PI * 2);
          ctx.fill();
          return true;
        });
      }

      ctx.globalCompositeOperation = "source-over";
    }

    function loop(now) {
      if (!running) return;
      draw(now);
      requestAnimationFrame(loop);
    }

    let resizeTimer = null;
    window.addEventListener("resize", function() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 180);
    });

    window.addEventListener("pointermove", function(event) {
      pointerX = (event.clientX / Math.max(W, 1) - 0.5) * 2;
      pointerY = (event.clientY / Math.max(H, 1) - 0.5) * 2;
    }, { passive: true });

    document.addEventListener("visibilitychange", function() {
      if (reduceMotion) return;
      if (document.hidden) {
        running = false;
      } else if (!running) {
        running = true;
        requestAnimationFrame(loop);
      }
    });

    resize();
    nextShootAt = performance.now() + 1500;

    if (!reduceMotion) requestAnimationFrame(loop);
  }

  /* =========================================
     2. ANGKA BERJALAN (COUNT-UP)
  ========================================= */
  function parseRp(text) {
    const match = /^Rp\s?(-?)([\d.]+)$/.exec(String(text || "").trim());
    if (!match) return null;
    const value = Number(match[2].replace(/\./g, ""));
    if (!Number.isFinite(value)) return null;
    return match[1] ? -value : value;
  }

  function formatRpFx(value) {
    return "Rp " + Math.round(value).toLocaleString("id-ID");
  }

  function setupCountUp() {
    const targets = document.querySelectorAll(".total-value, .detail-summary-item strong");

    targets.forEach(function(el) {
      el.__fxValue = parseRp(el.textContent) || 0;
      el.__fxLast = el.textContent;

      const observer = new MutationObserver(function() {
        const text = el.textContent;
        if (text === el.__fxLast) return;

        const target = parseRp(text);
        if (target === null) {
          el.__fxLast = text;
          return;
        }

        const from = el.__fxValue || 0;
        el.__fxValue = target;

        if (from === target || reduceMotion) {
          el.__fxLast = text;
          return;
        }

        const start = performance.now();
        const duration = 1100;
        const token = {};
        el.__fxToken = token;

        el.classList.remove("fx-flash");
        void el.offsetWidth;
        el.classList.add("fx-flash");

        function step(now) {
          if (el.__fxToken !== token) return;
          const p = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - p, 4);
          const current = p >= 1 ? target : from + (target - from) * eased;
          const out = p >= 1 ? text : formatRpFx(current);

          el.__fxLast = out;
          el.textContent = out;

          if (p < 1) requestAnimationFrame(step);
        }

        el.__fxLast = formatRpFx(from);
        el.textContent = el.__fxLast;
        requestAnimationFrame(step);
      });

      observer.observe(el, { childList: true, characterData: true, subtree: true });
    });
  }

  /* =========================================
     3. MUNCUL SAAT SCROLL (REVEAL)
  ========================================= */
  function setupReveal() {
    if (reduceMotion || !("IntersectionObserver" in window)) return;

    const groups = [
      ".main-content > section",
      ".totals-section > .total-card",
      ".kas-grid > .total-card",
      ".expense-summary-grid > .total-card",
      ".monthly-grid > .total-card",
      ".history-grid > .history-card",
      ".kas-section > .history-card",
      ".expense-section > .history-card",
      ".monthly-section > .history-card"
    ];

    const io = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -6% 0px" });

    groups.forEach(function(selector) {
      document.querySelectorAll(selector).forEach(function(el, index) {
        if (el.classList.contains("fx-reveal")) return;
        el.classList.add("fx-reveal");

        const inGrid = selector.indexOf("> .total-card") !== -1 || selector.indexOf("history-grid") !== -1;
        el.style.setProperty("--reveal-delay", inGrid ? (index * 0.09) + "s" : "0s");
        io.observe(el);
      });
    });
  }

  /* =========================================
     4. SPOTLIGHT KARTU & RIPPLE TOMBOL
  ========================================= */
  function setupPointerEffects() {
    document.addEventListener("pointermove", function(event) {
      const card = event.target.closest && event.target.closest(".total-card");
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mx", (event.clientX - rect.left) + "px");
      card.style.setProperty("--my", (event.clientY - rect.top) + "px");
    }, { passive: true });

    if (reduceMotion) return;

    document.addEventListener("pointerdown", function(event) {
      const button = event.target.closest &&
        event.target.closest(".btn-primary, .btn-secondary, .btn-danger, .btn-mini, .btn-monthly-detail");
      if (!button || button.disabled) return;

      const rect = button.getBoundingClientRect();
      const ripple = document.createElement("span");
      ripple.className = "fx-ripple";
      ripple.style.left = (event.clientX - rect.left) + "px";
      ripple.style.top = (event.clientY - rect.top) + "px";
      button.appendChild(ripple);

      setTimeout(function() {
        ripple.remove();
      }, 750);
    });
  }

  /* =========================================
     START
  ========================================= */
  function init() {
    startGalaxy();
    setupCountUp();
    setupReveal();
    setupPointerEffects();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
