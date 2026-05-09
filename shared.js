/**
 * Configuration et utilitaires partagés (popup, options, content).
 */
var QuietWebShared = {
  EXPORT_VERSION: 2,

  STORAGE_DEFAULTS: {
    quietWebEnabled: true,
    quietWebMode: "all",
    quietWebUserSelectors: "",
    quietWebUserNeedles: "",
    quietWebDisabledSites: [],
    quietWebAggression: "max"
  },

  WATCH_KEYS: [
    "quietWebEnabled",
    "quietWebMode",
    "quietWebUserSelectors",
    "quietWebUserNeedles",
    "quietWebDisabledSites",
    "quietWebAggression"
  ],

  defaultQuietWebStats: function () {
    return {
      totalBlocked: 0,
      viaSelector: 0,
      viaHeuristic: 0,
      lastUpdated: 0
    };
  },

  normalizeHost: function (h) {
    return String(h || "")
      .toLowerCase()
      .trim();
  },

  hostInExceptions: function (host, list) {
    host = QuietWebShared.normalizeHost(host);
    if (!host || !list || !list.length) return false;
    for (var i = 0; i < list.length; i++) {
      var e = QuietWebShared.normalizeHost(list[i]);
      if (!e) continue;
      if (host === e) return true;
      if (host.length > e.length && host.charAt(host.length - e.length - 1) === "." && host.slice(-e.length) === e) return true;
    }
    return false;
  },

  dedupeHosts: function (arr) {
    var seen = {};
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var h = QuietWebShared.normalizeHost(arr[i]);
      if (!h || seen[h]) continue;
      seen[h] = true;
      out.push(h);
    }
    return out;
  },

  parseHostLines: function (text) {
    var lines = (text || "").split("\n");
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var s = lines[i].trim();
      if (!s || s.indexOf("//") === 0) continue;
      s = QuietWebShared.normalizeHost(s.replace(/^\*\.?/, ""));
      if (s) out.push(s);
    }
    return QuietWebShared.dedupeHosts(out);
  },

  sanitizeStatsObject: function (raw) {
    var d = QuietWebShared.defaultQuietWebStats();
    if (!raw || typeof raw !== "object") return d;
    function cap(v) {
      var n = Math.floor(Number(v));
      if (!Number.isFinite(n) || n < 0) return 0;
      return Math.min(n, 1e12);
    }
    d.viaSelector = cap(raw.viaSelector);
    d.viaHeuristic = cap(raw.viaHeuristic);
    d.totalBlocked = cap(raw.totalBlocked);
    var sum = d.viaSelector + d.viaHeuristic;
    if (d.totalBlocked < sum) d.totalBlocked = sum;
    var lu = Number(raw.lastUpdated);
    d.lastUpdated = Number.isFinite(lu) && lu > 0 ? lu : Date.now();
    return d;
  },

  addStats: function (a, b) {
    var x = QuietWebShared.sanitizeStatsObject(a);
    var y = QuietWebShared.sanitizeStatsObject(b);
    return {
      totalBlocked: x.totalBlocked + y.totalBlocked,
      viaSelector: x.viaSelector + y.viaSelector,
      viaHeuristic: x.viaHeuristic + y.viaHeuristic,
      lastUpdated: Date.now()
    };
  },

  /**
   * Extrait une config importable (évite les clés arbitraires / pollution de prototype).
   */
  sanitizeImportedConfig: function (raw) {
    var out = {};
    if (!raw || typeof raw !== "object") return out;

    if (typeof raw.quietWebEnabled === "boolean") out.quietWebEnabled = raw.quietWebEnabled;

    var mode = raw.quietWebMode;
    if (mode === "all" || mode === "cookies" || mode === "modals") out.quietWebMode = mode;

    if (typeof raw.quietWebUserSelectors === "string") out.quietWebUserSelectors = raw.quietWebUserSelectors;
    if (typeof raw.quietWebUserNeedles === "string") out.quietWebUserNeedles = raw.quietWebUserNeedles;

    var agg = raw.quietWebAggression;
    if (agg === "prudent" || agg === "max") out.quietWebAggression = agg;

    var sites = raw.quietWebDisabledSites;
    if (Array.isArray(sites)) {
      var clean = [];
      for (var i = 0; i < sites.length; i++) {
        if (typeof sites[i] === "string") {
          var h = QuietWebShared.normalizeHost(sites[i]);
          if (h) clean.push(h);
        }
      }
      out.quietWebDisabledSites = QuietWebShared.dedupeHosts(clean);
    }

    if (raw.quietWebStats && typeof raw.quietWebStats === "object") {
      out.quietWebStats = QuietWebShared.sanitizeStatsObject(raw.quietWebStats);
    }

    return out;
  },

  mergeImported: function (current, imported) {
    var next = {};
    var k;
    for (k in QuietWebShared.STORAGE_DEFAULTS) {
      if (Object.prototype.hasOwnProperty.call(QuietWebShared.STORAGE_DEFAULTS, k)) {
        next[k] = current[k] !== undefined ? current[k] : QuietWebShared.STORAGE_DEFAULTS[k];
      }
    }
    for (k in imported) {
      if (Object.prototype.hasOwnProperty.call(imported, k)) {
        if (k === "quietWebStats") continue;
        if (k === "quietWebDisabledSites" && Array.isArray(imported[k]) && Array.isArray(next[k])) {
          next[k] = QuietWebShared.dedupeHosts(next[k].concat(imported[k]));
        } else {
          next[k] = imported[k];
        }
      }
    }
    return next;
  }
};
