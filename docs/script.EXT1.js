/* ==========================================================================
   孙璞月 Spy · 个人主页  —  EXT1 交互脚本\n   EXT1 变更：在 V3 基线上新增数字分身聊天、SSE、Turnstile、\n               会话内记忆与本地资料速答降级；不保存聊天正文。
   功能：导航滚动态 / 当前区块高亮 / 复制邮箱 / 页脚年份
        + 首屏「漂浮 3D 粒子」背景（V2.1 新增）
        + 首屏以外区域的「交互式网格背景」（V2.2 新增）
   V2.3 变更：顶部导航栏右侧改为深色 / 浅色主题开关。
              开关与全站 data-theme、localStorage 持久化联动；
              首屏粒子也会随主题切换配色。开关外观原生移植 Uiverse
              "Switch" by RiccardoRapelli（MIT License）。
   ========================================================================== */

(function () {
  "use strict";

  /* ---------- 0. 深色 / 浅色主题开关 ---------- */
  var root = document.documentElement;
  var themeSwitch = document.getElementById("themeSwitch");
  var themeColor = document.querySelector('meta[name="theme-color"]');

  function getTheme() {
    return root.getAttribute("data-theme") === "light" ? "light" : "dark";
  }

  function syncTheme(theme, persist) {
    var nextTheme = theme === "light" ? "light" : "dark";
    root.setAttribute("data-theme", nextTheme);

    if (themeSwitch) {
      themeSwitch.checked = nextTheme === "dark";
      themeSwitch.setAttribute("aria-checked", nextTheme === "dark" ? "true" : "false");
    }
    if (themeColor) {
      themeColor.setAttribute("content", nextTheme === "dark" ? "#05070f" : "#eef3fb");
    }
    if (persist) {
      try { localStorage.setItem("spy-theme", nextTheme); } catch (error) {}
    }

    window.dispatchEvent(new CustomEvent("spy-theme-change", {
      detail: { theme: nextTheme }
    }));
  }

  if (themeSwitch) {
    themeSwitch.addEventListener("change", function () {
      syncTheme(themeSwitch.checked ? "dark" : "light", true);
    });
  }
  syncTheme(getTheme(), false);

  /* ---------- 1. 导航栏滚动态 ---------- */
  var nav = document.getElementById("nav");

  function onScroll() {
    if (window.scrollY > 20) {
      nav.classList.add("scrolled");
    } else {
      nav.classList.remove("scrolled");
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- 2. 当前区块导航高亮 ---------- */
  var links = Array.prototype.slice.call(document.querySelectorAll(".nav-link"));
  var sections = links
    .map(function (link) {
      var id = link.getAttribute("href");
      return id && id.charAt(0) === "#" ? document.querySelector(id) : null;
    })
    .filter(Boolean);

  function highlight() {
    var pos = window.scrollY + window.innerHeight * 0.32;
    var current = null;

    sections.forEach(function (sec) {
      if (sec.offsetTop <= pos) current = sec;
    });

    links.forEach(function (link) {
      var id = link.getAttribute("href");
      link.classList.toggle("active", current ? id === "#" + current.id : false);
    });
  }
  window.addEventListener("scroll", highlight, { passive: true });
  window.addEventListener("resize", highlight);
  highlight();

  /* ---------- 3. 复制邮箱 ---------- */
  var copyBtn = document.getElementById("copyEmail");

  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      var email = copyBtn.getAttribute("data-email") || "";
      var original = copyBtn.innerHTML;

      function done() {
        copyBtn.classList.add("done");
        copyBtn.textContent = "已复制 ✓";
        setTimeout(function () {
          copyBtn.classList.remove("done");
          copyBtn.innerHTML = original;
        }, 1800);
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email).then(done, function () {
          fallback(email, done);
        });
      } else {
        fallback(email, done);
      }
    });
  }

  function fallback(text, cb) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      cb();
    } catch (e) {
      window.prompt("请手动复制邮箱 / Please copy the email:", text);
    }
    document.body.removeChild(ta);
  }

  /* ---------- 4. 页脚年份 ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();

/* ==========================================================================
   5. 首屏「漂浮 3D 粒子」背景（V2.1 新增）

   参考实现：Magic UI — Floating 3D Particles
   （registry/magicui/floating-3d-particles.tsx，React 外壳 + Canvas 2D 伪 3D）

   算法链路（与官方一致）：
     极坐标随机布点 → 3D 透视投影（fov / perspectiveDistance / depthRange）
     → 每帧持续旋转 + 匀速上浮 → 越界后从对侧重生
     → 按投影缩放排序，由远及近绘制（画家算法）

   本文件的差异（为适配纯静态个人主页）：
     1. 单色粒子 → 「克莱因蓝亮调 + 两级浅蓝」多色粒子池
     2. 保留 prefers-reduced-motion 静态帧、离屏 / 切后台自动暂停、DPR 上限 2
     3. 组件式 API → 直接绑定 #heroParticles 画布，零依赖
     4. 追加鼠标交互（本文件独有，官方组件未提供）：指针附近的粒子被缓慢推开，
        指针移开后缓慢归位。用「目标偏移 + 指数缓动」实现——逐帧只朝目标
        平滑逼近，不含任何速度/弹簧项，因此不会回弹、不会抖动，
        详见下方 CONFIG.interact 与 tick() 中的缓动段

   坐标系统：全部在画布 CSS 像素空间（与 ctx 的 DPR 变换无关），
            因此指针坐标 = clientX/Y 减去画布 getBoundingClientRect() 左上角
   ========================================================================== */
(function () {
  "use strict";

  var canvas = document.getElementById("heroParticles");
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  /* ---------- 可调参数 ---------- */
  var CONFIG = {
    quantity: 520,   // 桌面端粒子数（< 768px 的屏幕自动降至 20%）
    size: 4.6,       // 平均半径 px，每个粒子在 ±40% 内随机浮动
    opacity: 0.42,   // 平均不透明度，每个粒子在 ±0.2 内随机浮动（限幅 0–1）
    drift: 0.75,     // 上浮速度 px/帧，正值向上
    depth: 0.62,     // 3D 纵深强度 0–1，越大近大远小越明显

    /* 鼠标交互：指针附近的粒子被自然、缓慢地推开，指针移开后缓慢归位。
       用「指数缓动」逼近目标偏移，而不是弹簧-阻尼积分：
       只做 off += (target - off) * ease，没有速度项，所以既不会越过目标、
       也不会来回震荡，视觉上是平滑散开 / 平滑合拢 */
    interact: {
      enabled: true,
      radius: 190,    // 影响半径 px：指针进入这个范围才推开粒子
      displace: 46,   // 指针正中心处的最大推开距离 px，改它就能调"散开多少"
      ease: 0.035     // 缓动系数 0–1：越小越慢越柔（时间常数 ≈ 1/(ease*60) 秒 ≈ 0.48s）
    }
  };

  /* 粒子配色池：深色主题使用克莱因蓝亮调 + 两级浅蓝；
     浅色主题改用更深的蓝色，保证在浅色背景上仍有层次。 */
  var PARTICLE_PALETTES = {
    dark: [
      { hex: "#2f6bff", weight: 0.62 },
      { hex: "#8ab4ff", weight: 0.24 },
      { hex: "#7ea6ff", weight: 0.14 }
    ],
    light: [
      { hex: "#0b3a98", weight: 0.60 },
      { hex: "#1d5fd6", weight: 0.25 },
      { hex: "#3b74e8", weight: 0.15 }
    ]
  };
  var initialTheme = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  var COLORS = PARTICLE_PALETTES[initialTheme].slice();
  canvas.style.opacity = initialTheme === "light" ? "0.58" : "1";

  var MOBILE_BREAKPOINT = 768;
  var SPREAD_FACTOR = 1.2;
  var MAX_DPR = 2;

  /* ---------- 工具函数 ---------- */
  function hexToRgba(hex, alpha) {
    var clean = String(hex).replace("#", "").trim();

    if (clean.length === 3) {
      clean = clean.split("").map(function (c) { return c + c; }).join("");
    }
    if (!/^[0-9a-f]{6}$/i.test(clean)) return "rgba(47,107,255," + alpha + ")";

    var n = parseInt(clean, 16);
    return "rgba(" + ((n >> 16) & 0xff) + "," + ((n >> 8) & 0xff) + "," + (n & 0xff) + "," + alpha + ")";
  }

  function pickColor() {
    var r = Math.random();
    var acc = 0;
    for (var i = 0; i < COLORS.length; i++) {
      acc += COLORS[i].weight;
      if (r <= acc) return COLORS[i].hex;
    }
    return COLORS[0].hex;
  }

  function setParticleTheme(theme) {
    var palette = PARTICLE_PALETTES[theme] || PARTICLE_PALETTES.dark;
    COLORS.length = 0;
    palette.forEach(function (color) { COLORS.push(color); });

    particles.forEach(function (particle) {
      particle.color = pickColor();
    });
    canvas.style.opacity = theme === "light" ? "0.58" : "1";
  }

  window.addEventListener("spy-theme-change", function (event) {
    setParticleTheme(event.detail && event.detail.theme);
  });

  // 由 depth 推导透视参数：depth 越大，视场越窄、相机越近、纵深摆动越强
  function deriveProjection(depth) {
    var t = Math.max(0, Math.min(1, depth));
    var fov = 800 - t * 600;                       // [800, 200]
    var perspectiveDistance = 100 + t * 700;       // [100, 800]
    var depthRange = t * Math.min(400, fov + perspectiveDistance - 1);
    return { fov: fov, pd: perspectiveDistance, range: depthRange };
  }

  function spawnParticle(width, height) {
    var sizeVariance = CONFIG.size * 0.4;
    var opacityVariance = 0.2;

    return {
      angle: Math.random() * Math.PI * 2,
      radius: Math.random() * Math.max(width, height) * SPREAD_FACTOR,
      y: (Math.random() - 0.5) * height * 2,
      size: Math.max(0.5, CONFIG.size - sizeVariance + Math.random() * sizeVariance * 2),
      angularSpeed: 0.0015 + Math.random() * 0.001,
      opacity: Math.min(1, Math.max(0, CONFIG.opacity - opacityVariance + Math.random() * opacityVariance * 2)),
      color: pickColor(),
      screenX: 0,
      screenY: 0,
      projectedScale: 1,
      /* 鼠标推开带来的额外偏移（屏幕像素空间），未交互时恒为 0。
         只存偏移量本身：推离与归位都靠指数缓动，不需要速度项 */
      offX: 0,
      offY: 0
    };
  }

  /* ---------- 运行时状态 ---------- */
  var projection = deriveProjection(CONFIG.depth);
  var particles = [];
  var width = 0;
  var height = 0;
  var mounted = true;
  var paused = false;
  var reducedMotion = false;
  var staticDirty = true;
  var rafId = null;

  function draw(p) {
    var r = Math.max(0, p.size * p.projectedScale);
    if (r <= 0) return;

    ctx.beginPath();
    ctx.fillStyle = hexToRgba(p.color, p.opacity);
    ctx.arc(p.screenX, p.screenY, r, 0, Math.PI * 2);
    ctx.fill();
  }

  /* 计算粒子此刻应处的「目标偏移」：
       指针在影响半径内 → 沿「指针 → 粒子」方向推开，越远推得越少（平方衰减）；
       指针在半径外 → 目标为 0，粒子会缓动回原位。

     两点关键：
     1. 距离用粒子的「基准位置」(baseX/baseY) 计算，不含它自己已有的偏移。
        否则"被推开 → 距离变大 → 目标变小 → 又靠近"会自激，粒子原地抖动。
     2. 复用同一个返回对象，避免每帧为 500+ 粒子分配临时对象（GC 压力）。 */
  var targetOffset = { x: 0, y: 0 };

  function computeTargetOffset(p, baseX, baseY, radiusSq) {
    targetOffset.x = 0;
    targetOffset.y = 0;

    var dx = baseX - pointer.x;
    var dy = baseY - pointer.y;
    var distSq = dx * dx + dy * dy;
    if (distSq >= radiusSq) return targetOffset;

    var dist = Math.sqrt(distSq);

    // 粒子恰好落在指针正中心：方向未定义，用粒子自身角度给一个稳定方向。
    // 这里刻意不用随机方向——每帧换向会让粒子原地乱抖。
    if (dist < 0.001) {
      targetOffset.x = Math.cos(p.angle) * CONFIG.interact.displace;
      targetOffset.y = Math.sin(p.angle) * CONFIG.interact.displace;
      return targetOffset;
    }

    var falloff = 1 - dist / CONFIG.interact.radius;
    falloff *= falloff;   // 平方衰减：半径边缘几乎不推，过渡更柔和
    var amount = CONFIG.interact.displace * falloff;

    targetOffset.x = (dx / dist) * amount;
    targetOffset.y = (dy / dist) * amount;
    return targetOffset;
  }

  // 静态帧：用于 prefers-reduced-motion，不参与逐帧旋转
  function staticFrame() {
    ctx.clearRect(0, 0, width, height);

    var cx = width / 2;
    var cy = height / 2;
    var scale = projection.fov / Math.max(1, projection.fov + projection.pd);

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.screenX = cx + Math.cos(p.angle) * p.radius * scale;
      p.screenY = cy + p.y * scale;
      p.projectedScale = scale;
      draw(p);
    }
  }

  function tick() {
    if (!mounted) return;

    if (paused) {
      rafId = requestAnimationFrame(tick);
      return;
    }

    if (reducedMotion) {
      if (staticDirty) {
        staticDirty = false;
        staticFrame();
      }
      rafId = requestAnimationFrame(tick);
      return;
    }

    staticDirty = true;
    ctx.clearRect(0, 0, width, height);

    var cx = width / 2;
    var cy = height / 2;

    // 每帧取一次交互配置，reduced-motion 下不启用指针斥力（静态帧不逐帧重算）
    var interact = CONFIG.interact;
    var pointerActive = interact.enabled && pointer.active && !reducedMotion;
    var radiusSq = interact.radius * interact.radius;

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];

      // 持续绕中心轴旋转 + 匀速上浮
      p.angle += p.angularSpeed;
      p.y -= CONFIG.drift;

      // 越界后从对侧边缘重生（负向 drift 时向下走同样成立），并清掉残留偏移
      if (p.y < -height) {
        p.y = height;
        p.radius = Math.random() * Math.max(width, height) * SPREAD_FACTOR;
        p.offX = p.offY = 0;
      } else if (p.y > height) {
        p.y = -height;
        p.radius = Math.random() * Math.max(width, height) * SPREAD_FACTOR;
        p.offX = p.offY = 0;
      }

      // 3D 透视投影（不含鼠标偏移的"基准位置"）
      var scale = projection.fov / Math.max(1, projection.fov + projection.pd + Math.sin(p.angle) * projection.range);
      var baseX = cx + Math.cos(p.angle) * p.radius * scale;
      var baseY = cy + p.y * scale;
      p.projectedScale = scale;

      // 鼠标交互：先算出目标偏移，再用指数缓动缓慢逼近
      var tx = 0;
      var ty = 0;
      if (pointerActive) {
        var target = computeTargetOffset(p, baseX, baseY, radiusSq);
        tx = target.x;
        ty = target.y;
      }

      // 缓动公式只有「当前 → 目标」这一项，没有速度 / 弹簧项，
      // 所以既不会越过目标、也不会来回震荡，视觉上是平滑散开与平滑合拢
      p.offX += (tx - p.offX) * interact.ease;
      p.offY += (ty - p.offY) * interact.ease;

      // 目标已归位、偏移也已进入亚像素级别时直接清零，不留肉眼看不见的残差
      if (tx === 0 && Math.abs(p.offX) < 0.1) p.offX = 0;
      if (ty === 0 && Math.abs(p.offY) < 0.1) p.offY = 0;

      p.screenX = baseX + p.offX;
      p.screenY = baseY + p.offY;
    }

    // 画家算法：先画远的，再画近的
    particles.sort(function (a, b) { return a.projectedScale - b.projectedScale; });
    for (var j = 0; j < particles.length; j++) draw(particles[j]);

    rafId = requestAnimationFrame(tick);
  }

  function resize() {
    var rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));

    var dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, MAX_DPR));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var isMobile = window.innerWidth < MOBILE_BREAKPOINT;
    var count = Math.max(0, Math.round(isMobile ? CONFIG.quantity * 0.2 : CONFIG.quantity));

    particles = [];
    for (var i = 0; i < count; i++) particles.push(spawnParticle(width, height));

    staticDirty = true;
  }

  /* ---------- 指针交互：指针附近的粒子被推开 ---------- */
  var pointer = { x: 0, y: 0, active: false };
  var lastClient = { x: 0, y: 0 };

  // 事件绑在 .hero 上：粒子层自身是 pointer-events:none，鼠标事件会穿透到 hero，
  // 因此鼠标移到标题 / 按钮上时同样能生效
  var heroEl = (canvas.closest && canvas.closest(".hero")) || canvas.parentElement || canvas;

  // clientX/Y → 画布 CSS 像素坐标；同时缓存最后一次指针位置，供滚动时重算
  function syncPointer(active, clientX, clientY) {
    if (typeof clientX === "number") {
      lastClient.x = clientX;
      lastClient.y = clientY;
    }

    var rect = canvas.getBoundingClientRect();
    pointer.x = lastClient.x - rect.left;
    pointer.y = lastClient.y - rect.top;
    pointer.active = !!active &&
      pointer.x >= 0 && pointer.y >= 0 &&
      pointer.x <= rect.width && pointer.y <= rect.height;
  }

  function onPointerMove(e) {
    if (!CONFIG.interact.enabled || reducedMotion) return;
    syncPointer(true, e.clientX, e.clientY);
  }

  function onPointerLeave() {
    pointer.active = false;
  }

  // 滚动会让画布相对视口移动，用缓存的指针位置重算，避免斥力作用点漂移
  function onScrollSync() {
    if (pointer.active) syncPointer(true);
  }

  heroEl.addEventListener("pointermove", onPointerMove, { passive: true });
  heroEl.addEventListener("pointerleave", onPointerLeave);
  heroEl.addEventListener("pointercancel", onPointerLeave);
  window.addEventListener("scroll", onScrollSync, { passive: true });

  /* ---------- 无障碍与性能：减弱动效 / 切后台 / 离屏暂停 ---------- */
  var mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

  function syncReducedMotion() {
    reducedMotion = !!(mq && mq.matches);
    staticDirty = true;

    // 进入减弱动效时清掉鼠标交互残留，避免粒子停在半推开的偏移上
    if (reducedMotion) {
      pointer.active = false;
      for (var k = 0; k < particles.length; k++) {
        var pk = particles[k];
        pk.offX = pk.offY = 0;
      }
    }
  }

  function onVisibilityChange() {
    paused = document.hidden;
  }

  if (mq) {
    syncReducedMotion();
    if (mq.addEventListener) mq.addEventListener("change", syncReducedMotion);
    else if (mq.addListener) mq.addListener(syncReducedMotion);
  }

  var ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(canvas);
  else window.addEventListener("resize", resize);

  var io = null;
  if (typeof IntersectionObserver !== "undefined") {
    io = new IntersectionObserver(function (entries) {
      var entry = entries[0];
      if (entry) paused = document.hidden || !entry.isIntersecting;
    }, { threshold: 0 });
    io.observe(canvas);
  }

  document.addEventListener("visibilitychange", onVisibilityChange);

  resize();
  rafId = requestAnimationFrame(tick);

  /* ---------- 调试出口：供本地校验脚本读取运行状态（只读，不影响页面表现） ---------- */
  window.__heroParticles = {
    config: CONFIG,
    colors: COLORS,
    setTheme: setParticleTheme,
    count: function () { return particles.length; },
    pointer: function () { return { x: pointer.x, y: pointer.y, active: pointer.active }; },
    // 统计被推开的粒子数与偏移量，用于确认鼠标交互真实生效、移开后已复位
    displacement: function () {
      var moved = 0, total = 0, max = 0;
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        var d = Math.sqrt(p.offX * p.offX + p.offY * p.offY);
        if (d > 1) moved++;
        total += d;
        if (d > max) max = d;
      }
      return { moved: moved, total: Math.round(total), max: Math.round(max * 10) / 10 };
    }
  };

  window.addEventListener("pagehide", function () {
    mounted = false;
    if (rafId !== null) cancelAnimationFrame(rafId);
    if (ro) ro.disconnect();
    if (io) io.disconnect();
  });
})();

/* ==========================================================================
   6. 首屏以外区域的「交互式网格背景」（V2.2 新增）

   参考实现：Magic UI — Interactive Grid Pattern
   （registry/magicui/interactive-grid-pattern.tsx，React + SVG）

   官方行为：把区域切成 width × height 的方格，指针所在的**那一格**被填充高亮，
             指针移开时缓慢淡出（官方 Tailwind 类
             `transition-all duration-100 ease-in-out not-[&:hover]:duration-1000`
             —— 进入 100ms 快速填充、离开 1000ms 慢速淡出）。

   本文件的落地方式（适配纯静态页面，零依赖）：
     1. 官方用 React state 记录 hoveredSquare → 改为「指针坐标反推格子索引 + 切换 class」
     2. 官方默认 40×40、24×24 格 → 改为按容器尺寸动态计算行列数，铺满整个区域
     3. 方格边长取 56px，与首屏静态网格 background-size 一致，整页网格观感统一
     4. 高亮填充改为克莱因蓝，贴合本页主色调（官方为 gray-300/30）
     5. 追加 prefers-reduced-motion 处理：取消过渡，高亮瞬时切换

   作用范围：网格层自首屏下沿开始（top = --hero-h），因此指针在首屏内时
             换算出的坐标为负，不会被高亮 —— 即「只在首屏以外的部分生效」。
   ========================================================================== */
(function () {
  "use strict";

  var svg = document.getElementById("interactiveGrid");
  if (!svg) return;

  var layer = svg.parentElement;                    // .igrid-layer：网格覆盖范围
  var heroEl = document.querySelector(".hero");     // 首屏（用于取高度、排除首屏区域）

  /* ---------- 可调参数 ---------- */
  var CONFIG = {
    cell: 56,        // 方格边长 px（与首屏静态网格的 56px 保持一致）
    enabled: true    // 交互总开关：false 时网格照常显示，但不再跟随指针高亮
  };

  /* ---------- 首屏高度 → CSS 变量 --hero-h ----------
     .bg-grid（首屏静态网格）与 .igrid-layer（交互网格）都靠它定位 */
  function heroHeight() {
    return heroEl ? Math.round(heroEl.getBoundingClientRect().height) : 0;
  }

  function syncHeroHeight() {
    var h = heroHeight();
    if (h > 0) document.documentElement.style.setProperty("--hero-h", h + "px");
  }

  var rects = [];      // 全部方格，index = row * cols + col
  var cols = 0;
  var rows = 0;
  var offsetY = 0;     // 纵向对齐偏移：让本层网格与首屏网格线在交界处接得上
  var hovered = -1;
  var box = null;      // 缓存的层位置（避免每次指针移动都读取布局、强制重排）

  /* ---------- 生成方格 ---------- */
  function build() {
    var w = Math.max(0, Math.round(layer.clientWidth));
    var h = Math.max(0, Math.round(layer.clientHeight));
    if (!w || !h) return;

    offsetY = heroHeight() % CONFIG.cell;           // 首屏网格从页面顶部起按 56px 排布
    cols = Math.ceil(w / CONFIG.cell);
    rows = Math.ceil((h + offsetY) / CONFIG.cell);

    // SVG 不设 viewBox：1 用户单位 = 1 CSS px，方格不会被拉伸变形
    svg.setAttribute("width", String(cols * CONFIG.cell));
    svg.setAttribute("height", String(rows * CONFIG.cell));

    var NS = "http://www.w3.org/2000/svg";
    var frag = document.createDocumentFragment();

    for (var i = 0; i < cols * rows; i++) {
      var rect = document.createElementNS(NS, "rect");
      rect.setAttribute("x", String((i % cols) * CONFIG.cell));
      rect.setAttribute("y", String(Math.floor(i / cols) * CONFIG.cell - offsetY));
      rect.setAttribute("width", String(CONFIG.cell));
      rect.setAttribute("height", String(CONFIG.cell));
      frag.appendChild(rect);
    }

    svg.textContent = "";                           // 清空旧方格后整体换入
    svg.appendChild(frag);

    rects = Array.prototype.slice.call(svg.querySelectorAll("rect"));
    hovered = -1;
    refreshBox();                    // 尺寸/位置已变，缓存失效后重新测量
  }

  /* ---------- 指针追踪：指针坐标 → 格子索引 ----------
     与官方实现"哪一格被 hover 就填充哪一格"完全一致；
     区别只在于官方用 React state + CSS :hover，这里用类名切换。
     处理是同步的（不排队到 requestAnimationFrame）：pointermove 本身
     已由浏览器按帧合并，且位置测量值被缓存，不会触发强制重排。 */
  function refreshBox() {
    box = layer.getBoundingClientRect();
  }

  function setHover(index) {
    if (index === hovered) return;
    if (hovered >= 0 && rects[hovered]) rects[hovered].classList.remove("is-hover");
    hovered = index;
    if (hovered >= 0 && rects[hovered]) rects[hovered].classList.add("is-hover");
  }

  /* 按窗口坐标定位并切换高亮；落在覆盖范围外（含首屏内）即取消高亮 */
  function locate(clientX, clientY) {
    if (!box) refreshBox();

    var x = clientX - box.left;
    var y = clientY - box.top;

    if (x < 0 || y < 0 || x >= cols * CONFIG.cell || y >= rows * CONFIG.cell) {
      setHover(-1);
      return;
    }

    var col = Math.floor(x / CONFIG.cell);
    var row = Math.floor((y + offsetY) / CONFIG.cell);
    setHover(row * cols + col);
  }

  var last = null;   // 最近一次指针位置（滚动后据此重新定位，避免高亮停留在旧格子上）

  function onPointerMove(e) {
    if (!CONFIG.enabled) return;
    last = { x: e.clientX, y: e.clientY };
    locate(last.x, last.y);
  }

  function clearHover() {
    last = null;
    setHover(-1);
    refreshBox();
  }

  function onScroll() {
    refreshBox();
    if (last) locate(last.x, last.y);
    else setHover(-1);
  }

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("blur", clearHover);
  document.documentElement.addEventListener("pointerleave", clearHover);

  /* ---------- 无障碍：偏好减弱动效时取消过渡（高亮保留，但瞬时切换） ---------- */
  var mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

  function syncReducedMotion() {
    document.documentElement.classList.toggle("igrid-no-motion", !!(mq && mq.matches));
  }

  if (mq) {
    syncReducedMotion();
    if (mq.addEventListener) mq.addEventListener("change", syncReducedMotion);
    else if (mq.addListener) mq.addListener(syncReducedMotion);
  }

  /* ---------- 尺寸变化 → 同步首屏高度并重建网格 ---------- */
  var ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(build) : null;
  if (ro) ro.observe(layer);
  else window.addEventListener("resize", build);

  var heroRo = null;
  if (heroEl && typeof ResizeObserver !== "undefined") {
    heroRo = new ResizeObserver(function () {
      syncHeroHeight();
      build();                 // --hero-h 改变会移动本层，需要立刻按新尺寸重建
    });
    heroRo.observe(heroEl);
  } else {
    window.addEventListener("resize", function () { syncHeroHeight(); build(); });
  }

  syncHeroHeight();
  build();

  /* ---------- 调试出口：供本地校验脚本读取运行状态（只读，不影响页面表现） ---------- */
  window.__interactiveGrid = {
    config: CONFIG,
    cell: function () { return CONFIG.cell; },
    cols: function () { return cols; },
    rows: function () { return rows; },
    count: function () { return rects.length; },
    hovered: function () { return hovered; },
    offsetY: function () { return offsetY; },
    isHovered: function (index) {
      return !!(rects[index] && rects[index].classList.contains("is-hover"));
    },
    hoveredFill: function (index) {
      return rects[index] ? getComputedStyle(rects[index]).fill : null;
    },
    layerRect: function () {
      var r = layer.getBoundingClientRect();
      return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
    }
  };

  window.addEventListener("pagehide", function () {
    if (ro) ro.disconnect();
    if (heroRo) heroRo.disconnect();
  });
})();


/* ==========================================================================
   V3 反馈弹窗 + Supabase 提交
   - 表单只提交 message
   - 前端只使用 anon key，不接触 service_role
   - 配置见 config.V3.js
   ========================================================================== */
(function () {
  "use strict";

  var fab = document.getElementById("feedbackFab");
  var dialog = document.getElementById("feedbackDialog");
  var closeBtn = document.getElementById("feedbackClose");
  var form = document.getElementById("feedbackForm");
  var messageInput = document.getElementById("feedbackMessage");
  var countEl = document.getElementById("feedbackCount");
  var statusEl = document.getElementById("feedbackStatus");
  var submitBtn = document.getElementById("feedbackSubmit");
  var closeTimer = null;

  if (!fab || !dialog || !form || !messageInput || !submitBtn) return;

  function setStatus(message, type) {
    if (!statusEl) return;
    statusEl.textContent = message || "";
    statusEl.classList.toggle("is-error", type === "error");
    statusEl.classList.toggle("is-success", type === "success");
  }

  function updateCount() {
    if (countEl) countEl.textContent = messageInput.value.length + " / 1000";
  }

  function openDialog() {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
    setStatus("", "");
    updateCount();
    dialog.showModal();
    window.setTimeout(function () { messageInput.focus(); }, 50);
  }

  function closeDialog() {
    if (dialog.open) dialog.close();
  }

  fab.addEventListener("click", openDialog);
  closeBtn.addEventListener("click", closeDialog);
  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) closeDialog();
  });
  dialog.addEventListener("close", function () {
    setStatus("", "");
    fab.focus();
  });
  messageInput.addEventListener("input", updateCount);
  updateCount();

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var message = messageInput.value.trim();
    if (!message) {
      setStatus("请先填写反馈内容。 / Please enter your feedback.", "error");
      messageInput.focus();
      return;
    }
    if (message.length > 1000) {
      setStatus("反馈内容不能超过 1000 字。 / Feedback must be 1000 characters or fewer.", "error");
      messageInput.focus();
      return;
    }

    var config = window.SPY_SUPABASE_CONFIG || {};
    if (!config.url || !config.anonKey || !config.table) {
      setStatus("反馈服务尚未配置，暂时无法提交。 / Feedback service is not configured.", "error");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.classList.add("is-loading");
    setStatus("正在提交… / Submitting…", "");

    fetch(config.url.replace(/\/+$/, "") + "/rest/v1/" + encodeURIComponent(config.table), {
      method: "POST",
      headers: {
        "apikey": config.anonKey,
        "Authorization": "Bearer " + config.anonKey,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({ message: message })
    }).then(function (response) {
      if (!response.ok) {
        return response.text().then(function (text) {
          throw new Error("HTTP " + response.status + (text ? " - " + text.slice(0, 180) : ""));
        });
      }

      messageInput.value = "";
      updateCount();
      setStatus("反馈已提交，谢谢你的意见！ / Thank you for your feedback!", "success");
      closeTimer = window.setTimeout(closeDialog, 2000);
    }).catch(function (error) {
      setStatus("提交失败，请稍后重试。 / Submission failed. Please try again.", "error");
      if (window.console && console.warn) console.warn("[feedback]", error);
    }).finally(function () {
      submitBtn.disabled = false;
      submitBtn.classList.remove("is-loading");
    });
  });
})();

/* ==========================================================================
   EXT1 数字分身“小月”
   - 会话内记忆：只保存在当前页面内存，刷新即清空
   - 有 endpoint：调用 Supabase Edge Function，使用 SSE 流式回答
   - 无 endpoint / 服务异常：自动切换本地 FAQ 降级模式
   - 不写 localStorage，不保存聊天正文
   ========================================================================== */
(function () {
  "use strict";

  var config = window.SPY_TWIN_CONFIG || {};
  var fab = document.getElementById("twinFab");
  var dialog = document.getElementById("twinDialog");
  var closeBtn = document.getElementById("twinClose");
  var avatar = document.getElementById("twinAvatar");
  var avatarStatus = document.getElementById("twinAvatarStatus");
  var messagesEl = document.getElementById("twinMessages");
  var suggestionsEl = document.getElementById("twinSuggestions");
  var form = document.getElementById("twinForm");
  var input = document.getElementById("twinInput");
  var sendBtn = document.getElementById("twinSend");
  var countEl = document.getElementById("twinCount");
  var statusEl = document.getElementById("twinStatus");

  if (!fab || !dialog || !closeBtn || !avatar || !messagesEl || !suggestionsEl || !form || !input || !sendBtn) return;

  var ENDPOINT = String(config.endpoint || "").trim();
  var KNOWLEDGE_URL = config.knowledgeUrl || "knowledge.EXT1.json";
  var MAX_INPUT = Number(config.maxInputLength) || 500;
  var MAX_HISTORY = Number(config.maxHistoryMessages) || 8;
  var REQUEST_TIMEOUT = Number(config.requestTimeoutMs) || 25000;
  var FALLBACK_KNOWLEDGE = {
    identity: { nameZh: "孙璞月", nameEn: "Spy", majorZh: "智能医学工程", majorEn: "Intelligent Medical Engineering" },
    facts: [],
    faq: [],
    unavailable: [],
    suggestedPrompts: ["你是谁？ / Who are you?", "你在学习什么？ / What are you studying?", "你会哪些技能？ / What skills do you have?"]
  };

  var state = {
    knowledge: FALLBACK_KNOWLEDGE,
    messages: [],
    busy: false,
    forceFallback: !ENDPOINT,
    liveUnavailableUntil: 0,
    turnstileToken: null,
    turnstileWidgetId: null,
    turnstileVerified: false,
    sessionId: getSessionId()
  };

  function getSessionId() {
    try {
      var key = "spy-twin-session";
      var id = window.sessionStorage.getItem(key);
      if (!id) {
        id = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : "twin-" + Date.now() + "-" + Math.random().toString(16).slice(2);
        window.sessionStorage.setItem(key, id);
      }
      return id;
    } catch (error) {
      return "twin-" + Date.now() + "-" + Math.random().toString(16).slice(2);
    }
  }

  function isChinese(text) {
    return /[\u3400-\u9fff]/.test(String(text || ""));
  }

  function normalize(text) {
    return String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function setStatus(message, type) {
    if (!statusEl) return;
    statusEl.textContent = message || "";
    statusEl.classList.toggle("is-error", type === "error");
    statusEl.classList.toggle("is-success", type === "success");
  }

  function setAvatarState(nextState) {
    var allowed = { idle: 1, thinking: 1, talking: 1, offline: 1 };
    avatar.setAttribute("data-state", allowed[nextState] ? nextState : "idle");
    if (avatarStatus) {
      if (nextState === "thinking") avatarStatus.textContent = isChinese(input.value) ? "思考中…" : "Thinking…";
      else if (nextState === "talking") avatarStatus.textContent = isChinese(input.value) ? "正在回答…" : "Responding…";
      else if (nextState === "offline") avatarStatus.textContent = "在线 · 资料速答模式";
      else avatarStatus.textContent = ENDPOINT && !state.forceFallback ? "在线 · DeepSeek 驱动" : "在线 · 资料速答模式";
    }
  }

  function updateCount() {
    if (countEl) countEl.textContent = input.value.length + " / " + MAX_INPUT;
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addMessage(role, text, options) {
    options = options || {};
    var row = document.createElement("div");
    row.className = "twin-message twin-message--" + (role === "user" ? "user" : "bot");
    var bubble = document.createElement("div");
    bubble.className = "twin-bubble" + (options.system ? " twin-bubble--system" : "");
    bubble.textContent = text;
    row.appendChild(bubble);
    messagesEl.appendChild(row);
    scrollToBottom();
    return bubble;
  }

  function addTyping() {
    var row = document.createElement("div");
    row.className = "twin-message twin-message--bot";
    row.setAttribute("data-typing", "true");
    var bubble = document.createElement("div");
    bubble.className = "twin-bubble";
    var typing = document.createElement("span");
    typing.className = "twin-typing";
    typing.setAttribute("aria-label", "小月正在输入");
    typing.innerHTML = "<i></i><i></i><i></i>";
    bubble.appendChild(typing);
    row.appendChild(bubble);
    messagesEl.appendChild(row);
    scrollToBottom();
    return bubble;
  }

  function removeTyping() {
    var node = messagesEl.querySelector('[data-typing="true"]');
    if (node && node.parentNode) node.parentNode.removeChild(node);
  }

  function renderSuggestions(prompts) {
    suggestionsEl.innerHTML = "";
    var list = Array.isArray(prompts) && prompts.length ? prompts.slice(0, 4) : FALLBACK_KNOWLEDGE.suggestedPrompts;
    list.forEach(function (prompt) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "twin-suggestion";
      button.textContent = prompt;
      button.addEventListener("click", function () {
        input.value = prompt.split("/")[isChinese(prompt) ? 0 : 1].trim();
        updateCount();
        input.focus();
      });
      suggestionsEl.appendChild(button);
    });
  }

  function scoreItem(query, item) {
    var words = item.keywords || [];
    var score = 0;
    words.forEach(function (word) {
      var token = normalize(word);
      if (token && query.indexOf(token) !== -1) score += token.length + 2;
    });
    var questionText = normalize((item.questionZh || "") + " " + (item.questionEn || ""));
    if (questionText && (questionText.indexOf(query) !== -1 || query.indexOf(questionText) !== -1)) score += 8;
    return score;
  }

  function findBest(query) {
    var groups = [
      { type: "faq", items: state.knowledge.faq || [] },
      { type: "fact", items: state.knowledge.facts || [] },
      { type: "unavailable", items: state.knowledge.unavailable || [] }
    ];
    var best = null;
    groups.forEach(function (group) {
      group.items.forEach(function (item) {
        var score = scoreItem(query, item);
        if (!best || score > best.score) best = { score: score, item: item, type: group.type };
      });
    });
    return best && best.score > 0 ? best : null;
  }

  function localAnswer(text) {
    var query = normalize(text);
    var zh = isChinese(text);
    var identity = state.knowledge.identity || FALLBACK_KNOWLEDGE.identity;

    if (/^(你好|嗨|hello|hi|hey|早上好|晚上好|很高兴认识你)[!！。.，,\s]*$/i.test(query)) {
      return zh
        ? "嗨 我是小月 孙璞月的AI数字分身 你可以问我她的专业 技能 兴趣 学习方向或者联系方式"
        : "Hi, I am Xiaoyue, Spy's AI digital twin. Ask me about her major, skills, interests, learning direction, or contact details.";
    }

    var match = findBest(query);
    if (match) {
      if (match.type === "unavailable") {
        return zh ? match.item.zh : match.item.en;
      }
      if (match.type === "faq") {
        return zh ? match.item.zh : match.item.en;
      }
      return zh ? match.item.zh : match.item.en;
    }

    if (/^(你是谁|介绍一下|who are you|introduce|tell me about)/i.test(query)) {
      return zh
        ? "我是小月，孙璞月的 AI 数字分身。她目前是" + identity.majorZh + "专业的大一学生，也是" + (state.knowledge.identity.taglineZh || "一个热爱探索的人") + "。"
        : "I am Xiaoyue, Spy's AI digital twin. She is a first-year " + identity.majorEn + " student and " + (state.knowledge.identity.taglineEn || "an explorer at heart") + ".";
    }

    if (/(javascript|python|html|代码|编程|ai|人工智能|脑机|摄影|音乐|社交|大学|课程|学习|school|major|study|skill|project)/i.test(query)) {
      return zh
        ? "这个话题和我的公开资料有关，但我在资料速答模式下只能给出较简短的回答。你可以直接问“你会哪些技能”“你在学习什么”或“有哪些项目”。"
        : "This topic relates to my public profile, but the quick-answer mode can only give a short response. Try asking about her skills, studies, or projects.";
    }

    var uncertainZh = (state.knowledge.style && state.knowledge.style.uncertainZh) || "内个...不好说哈....";
    return zh
      ? uncertainZh + "我主要按孙璞月的公开资料聊 你可以问她的事 学习 技能 兴趣 经历 游戏 或者联系方式"
      : "Hmm... hard to say.... I mainly use Spy's public information. You can ask about her studies, skills, interests, experiences, games, or contact details.";
  }

  function loadKnowledge() {
    return fetch(KNOWLEDGE_URL, { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("knowledge HTTP " + response.status);
        return response.json();
      })
      .then(function (data) {
        state.knowledge = data && typeof data === "object" ? data : FALLBACK_KNOWLEDGE;
        renderSuggestions(state.knowledge.suggestedPrompts);
      })
      .catch(function (error) {
        state.knowledge = FALLBACK_KNOWLEDGE;
        renderSuggestions(FALLBACK_KNOWLEDGE.suggestedPrompts);
        if (window.console && console.warn) console.warn("[twin] knowledge fallback", error);
      });
  }

  function ensureTurnstile() {
    if (!config.turnstileSiteKey) return Promise.resolve(null);
    if (state.turnstileVerified) return Promise.resolve(null);
    if (state.turnstileToken) return Promise.resolve(state.turnstileToken);

    return new Promise(function (resolve, reject) {
      var container = document.getElementById("twinTurnstile");
      if (!container) {
        container = document.createElement("div");
        container.id = "twinTurnstile";
        container.className = "twin-turnstile";
        form.appendChild(container);
      }

      function render() {
        try {
          if (state.turnstileWidgetId !== null && window.turnstile) {
            window.turnstile.reset(state.turnstileWidgetId);
            return;
          }
          state.turnstileWidgetId = window.turnstile.render(container, {
            sitekey: config.turnstileSiteKey,
            theme: document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark",
            size: "invisible",
            callback: function (token) {
              state.turnstileToken = token;
              state.turnstileVerified = true;
              resolve(token);
            },
            "error-callback": function () { reject(new Error("Turnstile failed")); }
          });
        } catch (error) {
          reject(error);
        }
      }

      if (window.turnstile) {
        render();
        return;
      }

      var script = document.getElementById("twinTurnstileScript");
      if (!script) {
        script = document.createElement("script");
        script.id = "twinTurnstileScript";
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", render, { once: true });
      script.addEventListener("error", function () { reject(new Error("Turnstile script failed")); }, { once: true });
      window.setTimeout(function () { reject(new Error("Turnstile timeout")); }, 12000);
    });
  }

  function clearUsedTurnstile() {
    state.turnstileToken = null;
    if (state.turnstileWidgetId !== null && window.turnstile) {
      try { window.turnstile.reset(state.turnstileWidgetId); } catch (error) { /* no-op */ }
    }
  }

  function parseSseEvents(chunk) {
    var events = [];
    chunk.split(/\n\n/).forEach(function (block) {
      if (!block.trim()) return;
      var eventName = "message";
      var data = "";
      block.split(/\r?\n/).forEach(function (line) {
        if (line.indexOf("event:") === 0) eventName = line.slice(6).trim();
        if (line.indexOf("data:") === 0) data += line.slice(5).trim();
      });
      if (!data) return;
      try { events.push({ event: eventName, data: JSON.parse(data) }); }
      catch (error) { events.push({ event: eventName, data: { text: data } }); }
    });
    return events;
  }

  function requestLiveAnswer(text, history, token) {
    var controller = new AbortController();
    var timeoutId = window.setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT);
    return fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "text/event-stream"
      },
      body: JSON.stringify({
        sessionId: state.sessionId,
        message: text,
        history: history,
        turnstileToken: token || undefined
      }),
      signal: controller.signal
    }).then(function (response) {
      if (!response.ok) {
        return response.text().then(function (body) {
          throw new Error("twin HTTP " + response.status + (body ? " - " + body.slice(0, 160) : ""));
        });
      }
      if (!response.body || !response.body.getReader) throw new Error("Streaming unsupported");
      return {
        response: response,
        controller: controller,
        timeoutId: timeoutId
      };
    });
  }

  function consumeLiveStream(streamInfo, bubble) {
    var reader = streamInfo.response.body.getReader();
    var decoder = new TextDecoder();
    var buffer = "";
    var finalText = "";
    var streamError = null;

    function process(block) {
      parseSseEvents(block).forEach(function (entry) {
        var payload = entry.data || {};
        if (entry.event === "delta" && typeof payload.text === "string") {
          finalText += payload.text;
          bubble.textContent = finalText;
          scrollToBottom();
        } else if (entry.event === "quota" || entry.event === "fallback") {
          streamError = new Error(payload.message || "AI quota fallback");
        } else if (entry.event === "error") {
          streamError = new Error(payload.message || "AI service error");
        }
      });
    }

    function pump() {
      return reader.read().then(function (result) {
        if (result.done) {
          if (buffer.trim()) process(buffer);
          return finalText;
        }
        buffer += decoder.decode(result.value, { stream: true });
        var parts = buffer.split(/\n\n/);
        buffer = parts.pop();
        parts.forEach(process);
        return pump();
      });
    }

    return pump().then(function (text) {
      if (streamError) throw streamError;
      if (!text.trim()) throw new Error("Empty AI response");
      return text;
    }).finally(function () {
      window.clearTimeout(streamInfo.timeoutId);
    });
  }

  function streamLocalAnswer(answer, bubble) {
    return new Promise(function (resolve) {
      var index = 0;
      var step = Math.max(2, Math.ceil(answer.length / 44));
      function tick() {
        index = Math.min(answer.length, index + step);
        bubble.textContent = answer.slice(0, index);
        scrollToBottom();
        if (index < answer.length) {
          window.setTimeout(tick, 24);
        } else {
          resolve(answer);
        }
      }
      tick();
    });
  }

  function sendMessage(text) {
    if (state.busy) return;
    text = String(text || "").trim();
    if (!text) {
      setStatus("请输入一个问题。 / Please enter a question.", "error");
      input.focus();
      return;
    }
    if (text.length > MAX_INPUT) {
      setStatus("问题不能超过 " + MAX_INPUT + " 字。 / Question is too long.", "error");
      input.focus();
      return;
    }

    var history = state.messages.slice(-MAX_HISTORY);
    state.messages.push({ role: "user", content: text });
    addMessage("user", text);
    input.value = "";
    updateCount();
    setStatus("", "");
    state.busy = true;
    sendBtn.disabled = true;
    setAvatarState("thinking");
    var typingBubble = addTyping();
    var shouldUseLive = ENDPOINT && !state.forceFallback && Date.now() >= state.liveUnavailableUntil;

    var request = shouldUseLive
      ? ensureTurnstile().then(function (token) { return requestLiveAnswer(text, history, token); })
      : Promise.resolve(null);

    request.then(function (streamInfo) {
      if (!streamInfo) {
        return new Promise(function (resolve) { window.setTimeout(resolve, 240); })
          .then(function () {
            removeTyping();
            setAvatarState("talking");
            var localBubble = addMessage("bot", "");
            return streamLocalAnswer(localAnswer(text), localBubble);
          });
      }
      removeTyping();
      setAvatarState("talking");
      var bubble = addMessage("bot", "");
      return consumeLiveStream(streamInfo, bubble).then(function (answer) {
        clearUsedTurnstile();
        return answer;
      });
    }).then(function (answer) {
      removeTyping();
      if (!state.messages.length || state.messages[state.messages.length - 1].role !== "assistant" || state.messages[state.messages.length - 1].content !== answer) {
        if (!messagesEl.querySelector(".twin-message:last-child .twin-bubble") || messagesEl.querySelector(".twin-message:last-child .twin-bubble").textContent !== answer) {
          addMessage("bot", answer);
        }
      }
      state.messages.push({ role: "assistant", content: answer });
      setAvatarState("idle");
      setStatus("", "");
    }).catch(function (error) {
      removeTyping();
      state.forceFallback = true;
      state.liveUnavailableUntil = Date.now() + 60000;
      var fallback = localAnswer(text);
      var botBubbles = messagesEl.querySelectorAll(".twin-message--bot .twin-bubble");
      var lastBubble = botBubbles.length ? botBubbles[botBubbles.length - 1] : null;
      if (lastBubble && !String(lastBubble.textContent || "").trim()) {
        lastBubble.textContent = fallback;
      } else {
        addMessage("bot", fallback);
      }
      state.messages.push({ role: "assistant", content: fallback });
      setAvatarState("offline");
      setStatus("AI 服务暂时不可用，已切换为资料速答。 / AI unavailable; using quick answers.", "error");
      if (window.console && console.warn) console.warn("[twin]", error);
    }).finally(function () {
      state.busy = false;
      sendBtn.disabled = false;
      input.focus();
      scrollToBottom();
    });
  }

  function openDialog() {
    if (!dialog.open) dialog.showModal();
    window.setTimeout(function () { input.focus(); }, 60);
  }

  function closeDialog() {
    if (dialog.open) dialog.close();
  }

  fab.addEventListener("click", openDialog);
  closeBtn.addEventListener("click", closeDialog);
  dialog.addEventListener("click", function (event) { if (event.target === dialog) closeDialog(); });
  dialog.addEventListener("close", function () { fab.focus(); });
  input.addEventListener("input", updateCount);
  input.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    sendMessage(input.value);
  });

  renderSuggestions(FALLBACK_KNOWLEDGE.suggestedPrompts);
  updateCount();
  setAvatarState("idle");
  addMessage("bot", "嗨 我是小月 孙璞月的AI数字分身 先说明哈 我不是本人实时回复 你可以问我她的事 学习 技能 兴趣 经历 游戏或者联系方式\nHi, I am Xiaoyue, Spy's AI digital twin. I am not Spy replying live. Ask me about her studies, skills, interests, experiences, games, or contact details.", { system: true });
  loadKnowledge();

  window.__twin = {
    config: config,
    state: state,
    localAnswer: localAnswer,
    open: openDialog,
    close: closeDialog,
    send: sendMessage,
    mode: function () { return ENDPOINT && !state.forceFallback ? "live" : "fallback"; },
    messages: function () { return state.messages.slice(); }
  };
})();