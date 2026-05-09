(function () {
  var api = typeof chrome !== "undefined" ? chrome : browser;
  var S = QuietWebShared;

  var optEnabled = document.getElementById("optEnabled");
  var optMode = document.getElementById("optMode");
  var optAggression = document.getElementById("optAggression");
  var optSites = document.getElementById("optSites");
  var optSelectors = document.getElementById("optSelectors");
  var optNeedles = document.getElementById("optNeedles");
  var btnSave = document.getElementById("btnSave");
  var btnExport = document.getElementById("btnExport");
  var btnImportMerge = document.getElementById("btnImportMerge");
  var btnImportReplace = document.getElementById("btnImportReplace");
  var btnReset = document.getElementById("btnReset");
  var btnResetStats = document.getElementById("btnResetStats");
  var importFile = document.getElementById("importFile");
  var toast = document.getElementById("toast");
  var stTotal = document.getElementById("stTotal");
  var stSel = document.getElementById("stSel");
  var stHeu = document.getElementById("stHeu");
  var stDate = document.getElementById("stDate");

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      toast.classList.remove("show");
    }, 2600);
  }

  function fmt(n) {
    try {
      return new Intl.NumberFormat("fr-FR").format(Number(n) || 0);
    } catch (e) {
      return String(n);
    }
  }

  function broadcastClearStatsBuffers() {
    api.runtime.sendMessage({ type: "QUIET_WEB_BROADCAST_CLEAR_STATS_BUFFERS" }, function () {
      void api.runtime.lastError;
    });
  }

  function refreshStatsPanel() {
    api.storage.local.get({ quietWebStats: S.defaultQuietWebStats() }, function (r) {
      var st = S.sanitizeStatsObject(r.quietWebStats);
      stTotal.textContent = fmt(st.totalBlocked);
      stSel.textContent = fmt(st.viaSelector);
      stHeu.textContent = fmt(st.viaHeuristic);
      if (st.lastUpdated) {
        try {
          stDate.textContent = new Date(st.lastUpdated).toLocaleString("fr-FR");
        } catch (e) {
          stDate.textContent = "—";
        }
      } else stDate.textContent = "—";
    });
  }

  function hostsToText(arr) {
    if (!Array.isArray(arr) || !arr.length) return "";
    return arr.join("\n");
  }

  function readFormIntoPayload() {
    return {
      quietWebEnabled: optEnabled.checked,
      quietWebMode: optMode.value,
      quietWebAggression: optAggression.value,
      quietWebDisabledSites: S.parseHostLines(optSites.value),
      quietWebUserSelectors: optSelectors.value,
      quietWebUserNeedles: optNeedles.value
    };
  }

  function applyPayloadToForm(payload) {
    optEnabled.checked = payload.quietWebEnabled !== false;
    optMode.value = payload.quietWebMode === "cookies" || payload.quietWebMode === "modals" ? payload.quietWebMode : "all";
    optAggression.value = payload.quietWebAggression === "prudent" ? "prudent" : "max";
    optSites.value = hostsToText(payload.quietWebDisabledSites || []);
    optSelectors.value = payload.quietWebUserSelectors || "";
    optNeedles.value = payload.quietWebUserNeedles || "";
  }

  function loadFromStorage() {
    api.storage.local.get(S.STORAGE_DEFAULTS, function (res) {
      applyPayloadToForm(res);
      refreshStatsPanel();
    });
  }

  btnSave.addEventListener("click", function () {
    var p = readFormIntoPayload();
    api.storage.local.set(p, function () {
      if (api.runtime && api.runtime.lastError) {
        showToast("Échec de l’enregistrement.");
        return;
      }
      showToast("Réglages enregistrés.");
    });
  });

  btnResetStats.addEventListener("click", function () {
    if (!confirm("Remettre à zéro tous les compteurs de statistiques ?")) return;
    broadcastClearStatsBuffers();
    api.storage.local.set({ quietWebStats: S.defaultQuietWebStats() }, function () {
      refreshStatsPanel();
      showToast("Statistiques effacées (onglets notifiés).");
    });
  });

  btnExport.addEventListener("click", function () {
    var keys = Object.assign({}, S.STORAGE_DEFAULTS, { quietWebStats: S.defaultQuietWebStats() });
    api.storage.local.get(keys, function (res) {
      var payload = {
        quietWebExportVersion: S.EXPORT_VERSION,
        quietWebEnabled: res.quietWebEnabled !== false,
        quietWebMode: res.quietWebMode || "all",
        quietWebAggression: res.quietWebAggression === "prudent" ? "prudent" : "max",
        quietWebDisabledSites: Array.isArray(res.quietWebDisabledSites) ? res.quietWebDisabledSites : [],
        quietWebUserSelectors: res.quietWebUserSelectors || "",
        quietWebUserNeedles: res.quietWebUserNeedles || "",
        quietWebStats: S.sanitizeStatsObject(res.quietWebStats)
      };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "quiet-web-config.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast("Export téléchargé.");
    });
  });

  function parseImportFile(cb) {
    var f = importFile.files && importFile.files[0];
    if (!f) {
      showToast("Choisissez un fichier JSON.");
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var raw = JSON.parse(String(reader.result || "{}"));
        var imp = S.sanitizeImportedConfig(raw);
        if (!Object.keys(imp).length) {
          showToast("Fichier invalide ou vide.");
          return;
        }
        cb(imp);
      } catch (e) {
        showToast("JSON illisible.");
      }
    };
    reader.readAsText(f, "utf-8");
  }

  btnImportMerge.addEventListener("click", function () {
    parseImportFile(function (imp) {
      api.storage.local.get(S.STORAGE_DEFAULTS, function (cur) {
        var merged = S.mergeImported(cur, imp);
        applyPayloadToForm(merged);
        if (imp.quietWebStats) {
          api.storage.local.get({ quietWebStats: S.defaultQuietWebStats() }, function (r) {
            var sum = S.addStats(r.quietWebStats, imp.quietWebStats);
            broadcastClearStatsBuffers();
            api.storage.local.set({ quietWebStats: sum }, function () {
              refreshStatsPanel();
            });
          });
        }
        showToast("Fusion chargée — Enregistrer pour appliquer les réglages.");
      });
    });
  });

  btnImportReplace.addEventListener("click", function () {
    parseImportFile(function (imp) {
      api.storage.local.get(S.STORAGE_DEFAULTS, function (cur) {
        var next = {};
        var k;
        for (k in S.STORAGE_DEFAULTS) {
          if (Object.prototype.hasOwnProperty.call(S.STORAGE_DEFAULTS, k)) {
            next[k] = imp[k] !== undefined ? imp[k] : cur[k];
          }
        }
        applyPayloadToForm(next);
        if (imp.quietWebStats) {
          broadcastClearStatsBuffers();
          api.storage.local.set({ quietWebStats: S.sanitizeStatsObject(imp.quietWebStats) }, function () {
            refreshStatsPanel();
          });
        }
        showToast("Remplacement chargé — Enregistrer pour appliquer les réglages.");
      });
    });
  });

  btnReset.addEventListener("click", function () {
    if (!confirm("Réinitialiser toutes les options de Quiet Web ? Les statistiques ne sont pas effacées (bouton dédié).")) return;
    applyPayloadToForm(S.STORAGE_DEFAULTS);
    api.storage.local.set(S.STORAGE_DEFAULTS, function () {
      showToast("Réinitialisé.");
    });
  });

  api.storage.onChanged.addListener(function (changes, area) {
    if (area !== "local" || !changes.quietWebStats) return;
    refreshStatsPanel();
  });

  loadFromStorage();
})();
