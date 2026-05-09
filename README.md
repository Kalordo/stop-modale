# Quiet Web

**Quiet Web** est une extension navigateur (**Manifest V3**) développée par **3Devs**. Elle **réduit l’affichage** des bannières cookies (CMP courants) et des **modales intrusives** (anti-adblock, newsletters, etc.). Tout est traité **localement** : réglages et statistiques via `chrome.storage.local`, sans serveur dédié et **sans télémétrie**.

Le dépôt de sources sur GitHub s’appelle **stop-modale** ; le nom du produit dans le navigateur reste **Quiet Web** (voir `manifest.json`, champ `author` : **3Devs**).

**Version du manifest :** 2.1.3

Pour **maximiser** le blocage (bannières souvent dans une iframe), les scripts s’exécutent aussi dans les **sous-cadres** (`all_frames`). Si un lecteur ou un widget tiers est affecté sur un site précis, utilisez les **exceptions** pour ce domaine.

## Dépôt

- Code source : [github.com/Kalordo/stop-modale](https://github.com/Kalordo/stop-modale)
- Politique de confidentialité (fichier brut, utilisable comme URL pour les stores) :  
  `https://raw.githubusercontent.com/Kalordo/stop-modale/main/PRIVACY.md`

## Statistiques

Des **compteurs agrégés** (total masqué, masquage par sélecteurs vs analyse texte en mode Max) sont enregistrés **uniquement sur l’appareil**. Le popup et la page d’options les affichent ; vous pouvez les **réinitialiser** dans les options. L’**export JSON** inclut aussi ces compteurs.  
Les masquages réalisés très tôt par la feuille de style injectée dans `early.js` **ne sont pas** inclus dans ces totaux (seul le script de contenu compte les nœuds qu’il masque lui-même).

## Publication (Opera Add-ons, Chrome Web Store, etc.)

Voir **`STORE.md`** (ZIP, checklist) et **`PRIVACY.md`** (texte légal ; à lier depuis la fiche du magasin, idéalement en HTTPS — le lien `raw.githubusercontent.com` ci-dessus convient souvent pour les formulaires).

## Installation depuis les sources

Le dossier à charger est la **racine du dépôt** (là où se trouve `manifest.json`), pas un sous-dossier.

```bash
git clone https://github.com/Kalordo/stop-modale.git
cd stop-modale
```

Puis, dans le navigateur :

### Chrome / Edge / Brave / Opera

1. Ouvrez la page des extensions :  
   - Chrome : `chrome://extensions`  
   - Edge : `edge://extensions`  
   - Opera : `opera://extensions`
2. Activez le **mode développeur** (libellé variable selon le navigateur).
3. **Charger l’extension non empaquetée** / **Load unpacked** et choisissez le dossier **`stop-modale`** (racine du clone).

### Firefox

1. `about:debugging` → **Ce Firefox**.
2. **Charger un module complémentaire temporaire** → sélectionnez le fichier **`manifest.json`** à la racine du dépôt.

> Le chargement temporaire sous Firefox est surtout utile pour des tests ; pour un usage quotidien, privilégiez Chromium/Opera avec ce manifest MV3.

## Utilisation

- **Icône** : popup (activation globale, mode, agressivité, exclusion du site ouvert, statistiques, réanalyse).
- **Réglages complets** : lien depuis le popup vers la page **options** (exclusions multi-lignes, règles CSS / mots-clés, export / import JSON, réinitialisation des stats).
- **Raccourcis** (modifiables dans le navigateur) :
  - `Alt+Shift+Q` — activer / désactiver globalement  
  - `Alt+Shift+R` — réanalyser l’onglet actif  
  Pages typiques : `chrome://extensions/shortcuts`, `opera://settings/manageKeybindings` (selon version).

## Modes

| Mode | Comportement principal |
|------|-------------------------|
| Tout | Cookies (CMP + textes) + modales (heuristique en mode Max). |
| Cookies seulement | CMP intégrés + textes de consentement + vos règles. |
| Modales seulement | Pas d’injection « early » CMP ; cible surtout les modales. |

**Prudent** : uniquement les sélecteurs (intégrés + les vôtres), sans analyse texte des overlays. **Max** : heuristique complète.

## Exclusions par site

Un **nom d’hôte** par ligne dans les options. Une entrée `exemple.fr` couvre aussi `www.exemple.fr` et les sous-domaines (logique suffixe — voir le code). Les sites listés ne sont **pas** filtrés, même si l’extension est activée globalement.

## Limites techniques

- **Shadow DOM fermé** : inaccessible aux scripts de contenu classiques.
- **Iframes** : par défaut, injection uniquement dans le document principal (`all_frames: false`).
- **Conformité** : masquer une bannière **ne remplace pas** un choix de consentement ; à utiliser en connaissance de cause.

## Fichiers principaux

| Fichier | Rôle |
|---------|------|
| `manifest.json` | MV3, permissions, commandes, scripts |
| `early.js` | Injection très tôt (`document_start`), sous-ensemble CMP |
| `shared.js` | Stockage, utilitaires, sanitisation des imports |
| `rules.js` | Sélecteurs CMP et listes de textes |
| `content.js` | Masquage, observer, stats, messages |
| `background.js` | Service worker, raccourcis, diffusion reset stats |
| `options.html` / `options.js` | Réglages avancés |
| `popup.html` / `popup.js` | Contrôle rapide |

## Confidentialité

Aucune donnée n’est envoyée vers un serveur exploité par **3Devs**. Le stockage local sert à la **configuration** et aux **statistiques agrégées**. Détails : **`PRIVACY.md`**.

## Licence

**MIT** — voir le fichier **`LICENSE`** (titulaire des droits : **3Devs**).
