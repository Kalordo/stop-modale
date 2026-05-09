(function () {
  var api = typeof chrome !== "undefined" ? chrome : browser;
  var S = typeof QuietWebShared !== "undefined" ? QuietWebShared : null;
  var defaults = S
    ? S.STORAGE_DEFAULTS
    : {
        quietWebEnabled: true,
        quietWebMode: "all",
        quietWebUserSelectors: "",
        quietWebUserNeedles: "",
        quietWebDisabledSites: [],
        quietWebAggression: "max"
      };

  var toggle = document.getElementById("toggle");
  var mode = document.getElementById("mode");
  var aggression = document.getElementById("aggression");
  var userSelectors = document.getElementById("userSelectors");
  var userNeedles = document.getElementById("userNeedles");
  var statusEl = document.getElementById("status");
  var siteHostEl = document.getElementById("siteHost");
  var siteToggleBtn = document.getElementById("siteToggleBtn");
  var rerunBtn = document.getElementById("rerunBtn");
  var openOptions = document.getElementById("openOptions");
  var statTotal = document.getElementById("statTotal");
  var statSel = document.getElementById("statSel");
  var statHeu = document.getElementById("statHeu");

  var saveTimer = null;
  var tabHostname = "";
  var tabId = null;
  var tabOk = false;
  var disabledSites = [];

  function normalizeHost(h) {
    return String(h || "")
      .toLowerCase()
      .trim();
  }

  function hostIsExcepted(host, list) {
    if (S) return S.hostInExceptions(host, list);
    host = normalizeHost(host);
    if (!host || !list || !list.length) return false;
    for (var i = 0; i < list.length; i++) {
      var e = normalizeHost(list[i]);
      if (!e) continue;
      if (host === e) return true;
      if (host.length > e.length && host.charAt(host.length - e.length - 1) === "." && host.slice(-e.length) === e) return true;
    }
    return false;
  }

  function fmt(n) {
    try {
      return new Intl.NumberFormat("fr-FR").format(Number(n) || 0);
    } catch (e) {
      return String(n);
    }
  }

  function loadStats() {
    var def = S && S.defaultQuietWebStats ? S.defaultQuietWebStats() : { totalBlocked: 0, viaSelector: 0, viaHeuristic: 0 };
    api.storage.local.get({ quietWebStats: def }, function (r) {
      var st = r.quietWebStats || def;
      if (S && S.sanitizeStatsObject) st = S.sanitizeStatsObject(st);
      statTotal.textContent = fmt(st.totalBlocked);
      statSel.textContent = fmt(st.viaSelector);
      statHeu.textContent = fmt(st.viaHeuristic);
    });
  }

  function dedupeHosts(arr) {
    if (S) return S.dedupeHosts(arr);
    var seen = {};
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var h = normalizeHost(arr[i]);
      if (!h || seen[h]) continue;
      seen[h] = true;
      out.push(h);
    }
    return out;
  }

  function setStatus(msg) {
    statusEl.textContent = msg || "";
    if (!msg) return;
    clearTimeout(setStatus._t);
    setStatus._t = setTimeout(function () {
      statusEl.textContent = "";
    }, 2000);
  }

  function persistTextFields() {
    api.storage.local.set({
      quietWebUserSelectors: userSelectors.value,
      quietWebUserNeedles: userNeedles.value
    }, function () {
      if (api.runtime && api.runtime.lastError) {
        setStatus("Erreur de sauvegarde.");
        return;
      }
      setStatus("Enregistré.");
    });
  }

  function schedulePersist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persistTextFields, 450);
  }

  function updateSiteUi() {
    if (!tabOk || !tabHostname) {
      siteHostEl.innerHTML = "<strong>—</strong> (ouvrez une page <code>http(s)</code>)";
      siteToggleBtn.disabled = true;
      rerunBtn.disabled = true;
      return;
    }
    siteHostEl.innerHTML = "<strong>" + tabHostname + "</strong>";
    siteToggleBtn.disabled = false;
    rerunBtn.disabled = false;
    var exc = hostIsExcepted(tabHostname, disabledSites);
    siteToggleBtn.textContent = exc ? "Réactiver sur ce site" : "Exclure ce site";
  }

  function loadTabThenStorage() {
    api.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var t = tabs && tabs[0];
      tabId = t && t.id ? t.id : null;
      tabHostname = "";
      tabOk = false;
      if (t && t.url) {
        try {
          var u = new URL(t.url);
          if (u.protocol === "http:" || u.protocol === "https:") {
            tabHostname = u.hostname;
            tabOk = true;
          }
        } catch (e) {
          tabOk = false;
        }
      }
      api.storage.local.get(defaults, function (res) {
        toggle.checked = res.quietWebEnabled !== false;
        mode.value = res.quietWebMode === "cookies" || res.quietWebMode === "modals" ? res.quietWebMode : "all";
        aggression.value = res.quietWebAggression === "prudent" ? "prudent" : "max";
        userSelectors.value = res.quietWebUserSelectors || "";
        userNeedles.value = res.quietWebUserNeedles || "";
        disabledSites = Array.isArray(res.quietWebDisabledSites) ? res.quietWebDisabledSites : [];
        updateSiteUi();
        loadStats();
      });
    });
  }

  loadTabThenStorage();

  api.storage.onChanged.addListener(function (changes, area) {
    if (area !== "local" || !changes.quietWebStats) return;
    loadStats();
  });

  openOptions.addEventListener("click", function () {
    if (api.runtime.openOptionsPage) api.runtime.openOptionsPage();
  });

  toggle.addEventListener("change", function () {
    api.storage.local.set({ quietWebEnabled: toggle.checked });
  });

  mode.addEventListener("change", function () {
    api.storage.local.set({ quietWebMode: mode.value });
  });

  aggression.addEventListener("change", function () {
    api.storage.local.set({ quietWebAggression: aggression.value });
  });

  userSelectors.addEventListener("input", schedulePersist);
  userNeedles.addEventListener("input", schedulePersist);
  userSelectors.addEventListener("blur", persistTextFields);
  userNeedles.addEventListener("blur", persistTextFields);

  siteToggleBtn.addEventListener("click", function () {
    if (!tabHostname) return;
    var h = normalizeHost(tabHostname);
    var list = dedupeHosts(disabledSites);
    var idx = list.indexOf(h);
    if (idx === -1) list.push(h);
    else list.splice(idx, 1);
    disabledSites = list;
    api.storage.local.set({ quietWebDisabledSites: list }, function () {
      if (api.runtime && api.runtime.lastError) {
        setStatus("Impossible d’enregistrer l’exception.");
        return;
      }
      updateSiteUi();
      setStatus(idx === -1 ? "Site exclu." : "Site réactivé.");
    });
  });

  rerunBtn.addEventListener("click", function () {
    if (!tabId) {
      setStatus("Onglet introuvable.");
      return;
    }
    api.tabs.sendMessage(tabId, { type: "QUIET_WEB_RERUN" }, function (response) {
      if (api.runtime && api.runtime.lastError) {
        setStatus("Impossible d’atteindre la page (rechargez l’onglet).");
        return;
      }
      void response;
      setStatus("Réanalyse lancée.");
    });
  });
})();
