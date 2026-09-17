/* ==========================================================================
   孙璞月 Spy · 个人主页  —  V1 交互脚本
   功能：导航滚动态 / 当前区块高亮 / 复制邮箱 / 页脚年份
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
