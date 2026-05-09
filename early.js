/**
 * Injection très tôt : masque les CMP les plus courants avant paint quand c’est pertinent.
 * Doit rester aligné avec le haut de rules.js (hideSelectors). Pas d’injection si mode « modales ».
 */
(function () {
  var api = typeof chrome !== "undefined" ? chrome : browser;
  var STYLE_ID = "quietweb-early-style";

  function hostExc(list, host) {
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

  /* Sous-ensemble des sélecteurs CMP (voir rules.js) */
  var EARLY_SEL = [
    "#onetrust-banner-sdk",
    "#onetrust-consent-sdk",
    ".onetrust-pc-dark-filter",
    "#CybotCookiebotDialog",
    "#CybotCookiebotDialogBodyUnderlay",
    "#cookiescript_injected",
    "#qc-cmp2-ui",
    "#sp-cc-wrapper",
    "#sp_message_container",
    "#ncmp__tool",
    "#ncmp__banner",
    "#didomi-host",
    "#usercentrics-root",
    "#uc-banner",
    "#cookie-law-info-bar",
    "#cmplz-cookiebanner-container",
    ".cc-window",
    "#cookieConsent",
    "#tarteaucitronRoot",
    "#CookiebotDialog",
    "#axeptio_overlay",
    "#klaro",
    "#borlabs-cookie",
    ".osano-cm-window",
    "#shopify-pc__banner",
    "#shopify-pc__banner__backdrop",
    "#funding-choices",
    ".fc-dialog",
    ".fc-dialog-container",
    ".fc-consent-root",
    "#moove_gdpr_cookie_info_bar",
    "#termly-code-snippet-support",
    "#trustarc-banner",
    ".truste_box_overlay",
    "#cookiefirst-root",
    "#orejime",
    ".orejime-Root",
    "#pandectes-banner",
    "#transcend-consent-manager"
  ];

  var css = "";
  for (var j = 0; j < EARLY_SEL.length; j++) {
    css += EARLY_SEL[j] + "{display:none!important;visibility:hidden!important;pointer-events:none!important}";
  }

  api.storage.local.get(
    {
      quietWebEnabled: true,
      quietWebDisabledSites: [],
      quietWebMode: "all"
    },
    function (r) {
      if (r.quietWebEnabled === false) return;
      var mode = r.quietWebMode || "all";
      if (mode === "modals") return;
      var host = "";
      try {
        host = location.hostname || "";
      } catch (e) {
        return;
      }
      if (hostExc(r.quietWebDisabledSites, host)) return;
      if (document.getElementById(STYLE_ID)) return;
      var root = document.head || document.documentElement;
      if (!root) return;
      var s = document.createElement("style");
      s.id = STYLE_ID;
      s.setAttribute("data-quietweb", "early");
      s.textContent = css;
      root.appendChild(s);
    }
  );
})();
