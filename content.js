(function () {
  var api = typeof chrome !== "undefined" ? chrome : browser;
  var SHARED = typeof QuietWebShared !== "undefined" ? QuietWebShared : null;
  var BASE = typeof QUIET_RULES !== "undefined" ? QUIET_RULES : { hideSelectors: [], cookieTextNeedles: [], modalTextNeedles: [], strongModalNeedles: [] };

  var FALLBACK_DEFAULTS = {
    quietWebEnabled: true,
    quietWebMode: "all",
    quietWebUserSelectors: "",
    quietWebUserNeedles: "",
    quietWebDisabledSites: [],
    quietWebAggression: "max"
  };

  var STORAGE_DEFAULTS = SHARED ? SHARED.STORAGE_DEFAULTS : FALLBACK_DEFAULTS;
  var WATCH_KEYS = SHARED ? SHARED.WATCH_KEYS : ["quietWebEnabled", "quietWebMode", "quietWebUserSelectors", "quietWebUserNeedles", "quietWebDisabledSites", "quietWebAggression"];

  var MARK = "data-quietweb-hidden";
  /** Propriétés inline !important appliquées au masquage (dé-masquage = removeProperty sur chacune). */
  var HIDE_STYLE_PROPS = [
    "display",
    "visibility",
    "opacity",
    "pointer-events",
    "max-height",
    "max-width",
    "overflow",
    "clip-path",
    "transform",
    "z-index",
    "content-visibility",
    "position",
    "inset"
  ];
  var reinforceMap = new Map();
  var reinforceDebounceByEl = new Map();
  var rafTokenByEl = new Map();
  var scheduled = false;
  var domObserver = null;
  var prudentTimer = null;
  var periodicRescanTimer = null;

  var storageEnabled = false;
  var siteExcepted = false;
  var running = false;
  var aggression = "max";

  var effectiveHideSelectors = [];
  var effectiveSoftNeedles = [];
  var effectiveStrongNeedles = [];

  var statsBuffer = { selector: 0, heuristic: 0 };
  var statsFlushTimer = null;
  var statsFlushGen = 0;

  function defaultStats() {
    return SHARED && SHARED.defaultQuietWebStats ? SHARED.defaultQuietWebStats() : { totalBlocked: 0, viaSelector: 0, viaHeuristic: 0, lastUpdated: 0 };
  }

  function flushStatsToStorage() {
    var sel = statsBuffer.selector;
    var heu = statsBuffer.heuristic;
    statsBuffer.selector = 0;
    statsBuffer.heuristic = 0;
    statsFlushTimer = null;
    if (!sel && !heu) return;
    var gen = statsFlushGen;
    api.storage.local.get({ quietWebStats: defaultStats() }, function (r) {
      if (gen !== statsFlushGen) return;
      var s = SHARED ? SHARED.sanitizeStatsObject(r.quietWebStats) : defaultStats();
      s.viaSelector = (s.viaSelector || 0) + sel;
      s.viaHeuristic = (s.viaHeuristic || 0) + heu;
      s.totalBlocked = (s.totalBlocked || 0) + sel + heu;
      s.lastUpdated = Date.now();
      api.storage.local.set({ quietWebStats: s });
    });
  }

  function queueStatsDelta(source) {
    if (source === "heuristic") statsBuffer.heuristic++;
    else statsBuffer.selector++;
    clearTimeout(statsFlushTimer);
    statsFlushTimer = setTimeout(flushStatsToStorage, 450);
  }

  function flushStatsSoon() {
    clearTimeout(statsFlushTimer);
    statsFlushTimer = null;
    flushStatsToStorage();
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flushStatsSoon();
  });
  window.addEventListener("pagehide", flushStatsSoon);

  function hostInExceptions(list, host) {
    if (SHARED && SHARED.hostInExceptions) return SHARED.hostInExceptions(host, list);
    host = (host || "").toLowerCase();
    if (!host || !list || !list.length) return false;
    for (var i = 0; i < list.length; i++) {
      var e = String(list[i] || "")
        .toLowerCase()
        .trim();
      if (!e) continue;
      if (host === e) return true;
      if (host.length > e.length && host.charAt(host.length - e.length - 1) === "." && host.slice(-e.length) === e) return true;
    }
    return false;
  }

  function removeEarlyStyle() {
    var n = document.getElementById("quietweb-early-style");
    if (n && n.parentNode) n.parentNode.removeChild(n);
  }

  function shouldStripEarlyStyle(res) {
    if (res.quietWebEnabled === false) return true;
    if ((res.quietWebMode || "all") === "modals") return true;
    if (hostInExceptions(res.quietWebDisabledSites || [], location.hostname)) return true;
    return false;
  }

  function syncEarlyStyle(res) {
    if (shouldStripEarlyStyle(res)) removeEarlyStyle();
  }

  function isElement(n) {
    return n && n.nodeType === 1;
  }

  function dedupeStrings(arr) {
    var seen = {};
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var k = arr[i];
      if (!k || seen[k]) continue;
      seen[k] = true;
      out.push(k);
    }
    return out;
  }

  function parseLines(text) {
    var lines = (text || "").split("\n");
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var s = lines[i].trim();
      if (!s || s.indexOf("//") === 0) continue;
      out.push(s);
    }
    return out;
  }

  function buildEffective(res) {
    var mode = res.quietWebMode || "all";
    if (mode !== "cookies" && mode !== "modals" && mode !== "all") mode = "all";

    var hide = [];
    var soft = [];
    var strong = [];

    if (mode === "all" || mode === "cookies") {
      hide = hide.concat(BASE.hideSelectors || []);
      soft = soft.concat(BASE.cookieTextNeedles || []);
      strong = strong.concat(BASE.strongCookieNeedles || []);
    }
    if (mode === "all" || mode === "modals") {
      soft = soft.concat(BASE.modalTextNeedles || []);
      strong = strong.concat(BASE.strongModalNeedles || []);
    }

    hide = hide.concat(parseLines(res.quietWebUserSelectors));
    soft = soft.concat(parseLines(res.quietWebUserNeedles));

    effectiveHideSelectors = dedupeStrings(hide);
    effectiveSoftNeedles = dedupeStrings(soft);
    effectiveStrongNeedles = dedupeStrings(strong);
  }

  function pullFromStorage(res) {
    storageEnabled = res.quietWebEnabled !== false;
    siteExcepted = hostInExceptions(res.quietWebDisabledSites || [], location.hostname);
    aggression = res.quietWebAggression === "prudent" ? "prudent" : "max";
    buildEffective(res);
  }

  function computeRunning() {
    return storageEnabled && !siteExcepted;
  }

  function disconnectAllReinforce() {
    reinforceMap.forEach(function (obs) {
      try {
        obs.disconnect();
      } catch (e) {
        /* */
      }
    });
    reinforceMap.clear();
    reinforceDebounceByEl.forEach(function (tid) {
      clearTimeout(tid);
    });
    reinforceDebounceByEl.clear();
    rafTokenByEl.forEach(function (tok) {
      if (tok) tok.cancelled = true;
    });
    rafTokenByEl.clear();
  }

  function scheduleReinforceHideDebounced(el) {
    var prev = reinforceDebounceByEl.get(el);
    if (prev) clearTimeout(prev);
    var tid = setTimeout(function () {
      reinforceDebounceByEl.delete(el);
      if (!el.isConnected || !el.hasAttribute(MARK)) return;
      scheduleReapplyHide(el);
    }, 100);
    reinforceDebounceByEl.set(el, tid);
  }

  function applyAggressiveHide(el) {
    var st = el.style;
    st.setProperty("display", "none", "important");
    st.setProperty("visibility", "hidden", "important");
    st.setProperty("opacity", "0", "important");
    st.setProperty("pointer-events", "none", "important");
    st.setProperty("max-height", "0", "important");
    st.setProperty("max-width", "0", "important");
    st.setProperty("overflow", "hidden", "important");
    st.setProperty("clip-path", "inset(50%)", "important");
    st.setProperty("transform", "scale(0)", "important");
    st.setProperty("z-index", "-2147483647", "important");
    st.setProperty("content-visibility", "hidden", "important");
    /* Contre les overlays position:fixed !important (feuille d’auteur) : l’inline gagne sur l’auteur sauf si le site réécrit après — voir renfort MutationObserver. */
    st.setProperty("position", "static", "important");
    st.setProperty("inset", "auto", "important");
  }

  function scheduleReapplyHide(el) {
    var prev = rafTokenByEl.get(el);
    if (prev) prev.cancelled = true;
    var tok = { cancelled: false };
    rafTokenByEl.set(el, tok);
    requestAnimationFrame(function () {
      if (tok.cancelled) {
        rafTokenByEl.delete(el);
        return;
      }
      requestAnimationFrame(function () {
        rafTokenByEl.delete(el);
        if (tok.cancelled || !el.isConnected || !el.hasAttribute(MARK)) return;
        applyAggressiveHide(el);
      });
    });
  }

  function attachReinforceObserver(el) {
    if (reinforceMap.has(el)) return;
    var obs = new MutationObserver(function () {
      if (!el.hasAttribute(MARK)) {
        var t = reinforceDebounceByEl.get(el);
        if (t) clearTimeout(t);
        reinforceDebounceByEl.delete(el);
        try {
          obs.disconnect();
        } catch (e) {
          /* */
        }
        reinforceMap.delete(el);
        return;
      }
      scheduleReinforceHideDebounced(el);
    });
    try {
      obs.observe(el, {
        attributes: true,
        attributeFilter: ["style", "class"],
        childList: true,
        subtree: true
      });
      reinforceMap.set(el, obs);
    } catch (e) {
      /* */
    }
  }

  function unmarkAll() {
    disconnectAllReinforce();
    document.querySelectorAll("[" + MARK + "]").forEach(function (el) {
      el.removeAttribute(MARK);
      for (var i = 0; i < HIDE_STYLE_PROPS.length; i++) {
        try {
          el.style.removeProperty(HIDE_STYLE_PROPS[i]);
        } catch (e) {
          /* */
        }
      }
    });
  }

  function markHidden(el, source) {
    if (!isElement(el) || el.hasAttribute(MARK)) return false;
    el.setAttribute(MARK, "1");
    applyAggressiveHide(el);
    attachReinforceObserver(el);
    tryRelaxScroll(el);
    queueStatsDelta(source === "heuristic" ? "heuristic" : "selector");
    return true;
  }

  function tryRelaxScroll(el) {
    var r = el.getBoundingClientRect();
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    if (r.width < vw * 0.75 || r.height < vh * 0.55) return;
    var html = document.documentElement;
    var body = document.body;
    if (!body) return;
    ["overflow", "overflowX", "overflowY"].forEach(function (p) {
      if (html.style && html.style[p]) html.style.removeProperty(p);
      if (body.style && body.style[p]) body.style.removeProperty(p);
    });
  }

  function needleMatch(text, needles) {
    if (!text || !needles || !needles.length) return false;
    var t = text.toLowerCase();
    for (var i = 0; i < needles.length; i++) {
      if (t.indexOf(needles[i].toLowerCase()) !== -1) return true;
    }
    return false;
  }

  function quickOverlayLikely(el) {
    var tag = el.tagName;
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "LINK" || tag === "META") return false;
    var cs = getComputedStyle(el);
    var pos = cs.position;
    if (pos === "fixed" || pos === "sticky") {
      var z = parseInt(cs.zIndex, 10);
      if (!isNaN(z) && z >= 35) return true;
    }
    if (el.getAttribute("role") === "dialog") return true;
    if (el.getAttribute("aria-modal") === "true") return true;
    var cls = "";
    if (typeof el.className === "string") cls = el.className.toLowerCase();
    else if (el.className && el.className.baseVal !== undefined) cls = String(el.className.baseVal || "").toLowerCase();
    if (/(modal|overlay|backdrop|consent|cookie|gdpr|popup|newsletter|subscribe|interstitial|lightbox)/.test(cls)) return true;
    var id = (el.id && String(el.id).toLowerCase()) || "";
    if (/(modal|overlay|consent|cookie|gdpr|popup|newsletter|cmp|privacy)/.test(id)) return true;
    return false;
  }

  function isOverlayCandidate(el) {
    var cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    var pos = cs.position;
    if (pos !== "fixed" && pos !== "sticky") return false;
    var z = parseInt(cs.zIndex, 10);
    if (isNaN(z) || z < 65) return false;
    var r = el.getBoundingClientRect();
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var area = r.width * r.height;
    var varea = vw * vh;
    if (area < varea * 0.18) return false;
    return true;
  }

  function scanElement(el) {
    if (!running || aggression !== "max") return;
    if (!isElement(el) || el.closest("[" + MARK + "]")) return;
    if (!quickOverlayLikely(el)) return;
    var text = "";
    try {
      text = (el.innerText || "").slice(0, 6000);
    } catch (e) {
      return;
    }
    if (!text || text.length < 8) return;
    var strong = needleMatch(text, effectiveStrongNeedles);
    var soft = needleMatch(text, effectiveSoftNeedles);
    if (!soft && !strong) return;
    var r = el.getBoundingClientRect();
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    if (strong && r.width >= vw * 0.32 && r.height >= vh * 0.16) {
      markHidden(el, "heuristic");
      return;
    }
    if (soft && isOverlayCandidate(el)) markHidden(el, "heuristic");
  }

  function applySelectors() {
    if (!running) return;
    var list = effectiveHideSelectors;
    for (var i = 0; i < list.length; i++) {
      try {
        var nodes = document.querySelectorAll(list[i]);
        for (var j = 0; j < nodes.length; j++) markHidden(nodes[j], "selector");
      } catch (e) {
        /* sélecteur invalide */
      }
    }
  }

  function scanChunked() {
    if (!running || aggression !== "max" || !document.body) return;
    var all = document.querySelectorAll("body *");
    var i = 0;
    var chunk = 350;
    function step() {
      if (!running || aggression !== "max") return;
      var end = Math.min(i + chunk, all.length);
      for (; i < end; i++) scanElement(all[i]);
      if (i < all.length) {
        if (window.requestIdleCallback) requestIdleCallback(step, { timeout: 1200 });
        else setTimeout(step, 16);
      }
    }
    if (window.requestIdleCallback) requestIdleCallback(step, { timeout: 1200 });
    else step();
  }

  function scanSubtree(root, depth) {
    if (!running || aggression !== "max" || depth <= 0 || !isElement(root)) return;
    scanElement(root);
    var ch = root.children;
    for (var i = 0; i < ch.length; i++) scanSubtree(ch[i], depth - 1);
  }

  function onMutations(muts) {
    if (!running) return;
    if (aggression === "prudent") {
      clearTimeout(prudentTimer);
      prudentTimer = setTimeout(function () {
        if (!running || aggression !== "prudent") return;
        applySelectors();
      }, 160);
      return;
    }
    for (var i = 0; i < muts.length; i++) {
      var m = muts[i];
      for (var j = 0; j < m.addedNodes.length; j++) {
        var n = m.addedNodes[j];
        if (isElement(n)) scanSubtree(n, 17);
      }
    }
  }

  function scheduleRun() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      if (!running) return;
      applySelectors();
      scanChunked();
    });
  }

  function stopPeriodicRescan() {
    if (periodicRescanTimer) {
      clearInterval(periodicRescanTimer);
      periodicRescanTimer = null;
    }
  }

  function startPeriodicRescan() {
    stopPeriodicRescan();
    periodicRescanTimer = setInterval(function () {
      if (!running) return;
      applySelectors();
      if (aggression === "max") scanChunked();
    }, 22000);
  }

  function stopObserver() {
    clearTimeout(statsFlushTimer);
    statsFlushTimer = null;
    flushStatsToStorage();
    clearTimeout(prudentTimer);
    prudentTimer = null;
    if (domObserver) {
      domObserver.disconnect();
      domObserver = null;
    }
  }

  function startObserver() {
    if (!document.documentElement || domObserver) return;
    domObserver = new MutationObserver(onMutations);
    domObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  function applyRunningState(next) {
    running = next;
    if (next) {
      scheduleRun();
      startPeriodicRescan();
      startObserver();
    } else {
      stopPeriodicRescan();
      stopObserver();
      unmarkAll();
    }
  }

  function refreshWhileRunning() {
    if (!running) return;
    stopObserver();
    unmarkAll();
    startObserver();
    scheduleRun();
  }

  function applyStorage(res) {
    pullFromStorage(res);
    syncEarlyStyle(res);
    var next = computeRunning();
    if (!next) {
      applyRunningState(false);
      return;
    }
    if (!running) {
      applyRunningState(true);
    } else {
      refreshWhileRunning();
    }
  }

  function load() {
    function start() {
      api.storage.local.get(STORAGE_DEFAULTS, function (res) {
        pullFromStorage(res);
        syncEarlyStyle(res);
        applyRunningState(computeRunning());
      });
    }
    if (document.body) start();
    else document.addEventListener("DOMContentLoaded", start);
  }

  function storageChangedRelevant(changes) {
    for (var i = 0; i < WATCH_KEYS.length; i++) {
      if (changes[WATCH_KEYS[i]]) return true;
    }
    return false;
  }

  api.storage.onChanged.addListener(function (changes, area) {
    if (area !== "local" || !storageChangedRelevant(changes)) return;
    api.storage.local.get(STORAGE_DEFAULTS, applyStorage);
  });

  api.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (msg && msg.type === "QUIET_WEB_RERUN") {
      if (running) refreshWhileRunning();
      sendResponse({ ok: true });
      return;
    }
    if (msg && msg.type === "QUIET_WEB_CLEAR_STATS_BUFFER") {
      statsFlushGen++;
      clearTimeout(statsFlushTimer);
      statsFlushTimer = null;
      statsBuffer.selector = 0;
      statsBuffer.heuristic = 0;
      sendResponse({ ok: true });
      return;
    }
  });

  load();
})();
