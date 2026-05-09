# Publier Quiet Web (Opera Add-ons / Chrome Web Store)

## Opera Add-ons

1. Créez un compte développeur sur [Opera Add-ons — développeurs](https://addons.opera.com/developer/).
2. **Emballez** le dossier de l’extension en ZIP (à la racine du ZIP : `manifest.json`, pas de dossier parent superflu).
3. Hébergez une **politique de confidentialité** publique (HTTPS). Vous pouvez reprendre `PRIVACY.md` en la publiant sur votre site ou un dépôt GitHub (fichier `.md` brut ou page HTML).
4. Dans le formulaire Opera, indiquez :
   - nom, description courte / longue (FR ou EN selon votre cible),
   - **Privacy Policy URL** : lien vers votre politique,
   - captures d’écran (voir tailles recommandées sur le portail),
   - catégorie (ex. Productivité / Outils).
5. Soumettez la version. Les extensions Chromium non signées Opera peuvent nécessiter une **revue** ; respectez les règles du programme (pas de contenu trompeur, description alignée avec les permissions).

## Chrome Web Store (optionnel)

Même ZIP MV3, compte développeur Google, fiche similaire + URL de politique de confidentialité.

## Checklist avant envoi

- [ ] `manifest.json` : version incrémentée, description à jour, icônes présentes.
- [ ] Tester sur un profil propre : installation, options, popup, raccourcis, stats.
- [ ] Politique de confidentialité en ligne + lien exact à copier dans le formulaire.
- [ ] Remplacer `"author": "Quiet Web"` par votre nom ou marque si besoin.
- [ ] Captures : popup, page d’options, exemple de site (sans données personnelles).

## ZIP (PowerShell, exemple)

```powershell
Compress-Archive -Path manifest.json,background.js,content.js,early.js,shared.js,rules.js,popup.html,popup.js,options.html,options.js,icons -DestinationPath quiet-web.zip -Force
```

Adaptez la liste des fichiers si vous ajoutez des ressources.
