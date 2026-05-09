# Quiet Web

Extension navigateur (Manifest V3) qui **réduit l’affichage** des bannières cookies (CMP courants) et des **modales intrusives** (anti-adblock, newsletters, etc.). Tout est traité **localement** : réglages et statistiques via `chrome.storage.local`, sans serveur ni télémétrie.

**Version actuelle du manifest :** 2.1.1

## Statistiques

Des **compteurs agrégés** (total masqué, masquage par sélecteurs vs analyse texte en mode Max) sont mis à jour sur l’appareil. Le popup et la page d’options les affichent ; vous pouvez les **réinitialiser** dans les options. L’**export JSON** inclut aussi ces compteurs.  
Les masquages réalisés très tôt par la petite feuille de style `early.js` **ne sont pas** inclus dans ces totaux (seul le script de contenu compte les nœuds qu’il cache lui-même).

## Publication (Opera Add-ons, etc.)

Voir **`STORE.md`** (emballage ZIP, checklist) et **`PRIVACY.md`** (texte de politique de confidentialité à héberger en HTTPS pour le formulaire du magasin).

## Installation (mode développeur)

### Chrome / Edge / Brave

1. Ouvrez `chrome://extensions` (ou `edge://extensions`).
2. Activez le **Mode développeur**.
3. **Charger l’extension non empaquetée** et sélectionnez le dossier `quiet-web-extension`.

### Firefox

1. Ouvrez `about:debugging` → **Ce Firefox**.
2. **Charger un module complémentaire temporaire** → choisissez le fichier `manifest.json` du dossier.

## Utilisation

- **Icône** : popup de contrôle rapide (activation globale, mode, agressivité, exclusion du site ouvert, réanalyse).
- **Réglages complets** : depuis le popup, lien vers la page d’**options** (liste d’exclusions multi-lignes, règles CSS / mots-clés, **export / import JSON**, réinitialisation).
- **Raccourcis** (modifiables dans le navigateur) :
  - `Alt+Shift+Q` — activer / désactiver globalement
  - `Alt+Shift+R` — réanalyser l’onglet actif  
  Chrome : `chrome://extensions/shortcuts`

## Modes

| Mode            | Comportement principal                                      |
|-----------------|---------------------------------------------------------------|
| Tout            | Cookies (CMP + textes) + modales (heuristique en mode Max). |
| Cookies seulement | CMP intégrés + textes consentement + vos règles.            |
| Modales seulement | Pas d’injection « early » CMP ; cible surtout modales.      |

**Prudent** : uniquement sélecteurs (intégrés + les vôtres), pas d’analyse texte des overlays. **Max** : heuristique complète.

## Exclusions par site

Entrez un **nom d’hôte** par ligne (`exemple.fr` couvre aussi `www.exemple.fr` et les sous-domaines si vous utilisez la forme parent telle quelle — voir logique suffixe dans le code). Le site listé n’est **pas** filtré, même si l’extension est activée globalement.

## Limites techniques

- **Shadow DOM fermé** : pas d’accès depuis un content script classique.
- **Iframes** : par défaut, seul le document principal est injecté (`all_frames: false`) pour limiter les effets sur des widgets tiers.
- **Conformité** : masquer une bannière **ne remplace pas** un choix de consentement ; à utiliser en connaissance de cause.

## Fichiers principaux

- `manifest.json` — déclaration MV3, commandes, scripts.
- `early.js` — injection `document_start` (sous-ensemble CMP, sauf mode « modales seulement »).
- `shared.js` — constantes de stockage, utilitaires, sanitisation d’import.
- `rules.js` — sélecteurs CMP et listes de textes.
- `content.js` — logique principale, observer, messages.
- `background.js` — raccourcis, migration légère au install/update.
- `options.html` / `options.js` — réglages avancés et sauvegarde.
- `popup.html` / `popup.js` — contrôle rapide.

## Confidentialité

Aucune donnée personnelle n’est envoyée vers un serveur Quiet Web. Le stockage local sert à la **configuration** et aux **statistiques agrégées**. Pour les magasins d’extensions, publiez une URL vers une politique dérivée de `PRIVACY.md`.

## Licence

Usage personnel ou open source selon votre choix — aucune licence imposée par ce dépôt exemple.
