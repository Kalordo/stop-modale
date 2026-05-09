(function () {
  var api = typeof chrome !== "undefined" ? chrome : browser;

  api.runtime.onInstalled.addListener(function (details) {
    if (details.reason === "install" || details.reason === "update") {
      api.storage.local.get(
        {
          quietWebEnabled: true,
          quietWebMode: "all",
          quietWebUserSelectors: "",
          quietWebUserNeedles: "",
          quietWebDisabledSites: [],
          quietWebAggression: "max"
        },
        function (cur) {
          var patch = {};
          if (typeof cur.quietWebEnabled !== "boolean") patch.quietWebEnabled = true;
          if (!cur.quietWebMode) patch.quietWebMode = "all";
          if (typeof cur.quietWebUserSelectors !== "string") patch.quietWebUserSelectors = "";
          if (typeof cur.quietWebUserNeedles !== "string") patch.quietWebUserNeedles = "";
          if (!Array.isArray(cur.quietWebDisabledSites)) patch.quietWebDisabledSites = [];
          if (cur.quietWebAggression !== "prudent" && cur.quietWebAggression !== "max") patch.quietWebAggression = "max";
          if (Object.keys(patch).length) api.storage.local.set(patch);
        }
      );
    }
  });

  api.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (msg && msg.type === "QUIET_WEB_BROADCAST_CLEAR_STATS_BUFFERS") {
      api.tabs.query({}, function (tabs) {
        for (var i = 0; i < tabs.length; i++) {
          var id = tabs[i].id;
          if (!id) continue;
          api.tabs.sendMessage(id, { type: "QUIET_WEB_CLEAR_STATS_BUFFER" }, function () {
            void api.runtime.lastError;
          });
        }
      });
      sendResponse({ ok: true });
    }
  });

  api.commands.onCommand.addListener(function (command) {
    if (command === "toggle-quiet-web") {
      api.storage.local.get({ quietWebEnabled: true }, function (r) {
        var on = r.quietWebEnabled !== false;
        api.storage.local.set({ quietWebEnabled: !on });
      });
      return;
    }
    if (command === "rerun-quiet-web-tab") {
      api.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        var tab = tabs && tabs[0];
        if (!tab || !tab.id) return;
        api.tabs.sendMessage(tab.id, { type: "QUIET_WEB_RERUN" }, function () {
          void api.runtime.lastError;
        });
      });
    }
  });
})();
