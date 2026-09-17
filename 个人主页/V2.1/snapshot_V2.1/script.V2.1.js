/* ==========================================================================
   孙璞月 Spy · 个人主页  —  V2.1 交互脚本
   功能：导航滚动态 / 当前区块高亮 / 复制邮箱 / 页脚年份
        + 首屏「漂浮 3D 粒子」背景（V2.1 新增）
   ========================================================================== */

(function () {
  "use strict";

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

  /* 粒子配色池：克莱因蓝亮调为主，混入两级浅蓝增强纵深层次
     （原有青色 #35d6ff 已按需求替换为浅蓝 #8ab4ff） */
  var COLORS = [
    { hex: "#2f6bff", weight: 0.62 },
    { hex: "#8ab4ff", weight: 0.24 },
    { hex: "#7ea6ff", weight: 0.14 }
  ];

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
