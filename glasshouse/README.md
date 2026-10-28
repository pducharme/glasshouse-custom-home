# Glasshouse — sources de la variante publique

Ce dossier reprend le serveur, les pages et les tests de **Glasshouse 0.130.0**,
commit amont `1543769cfeb28c3ce0936dc6d20b24cd58c70255`, avec l’accueil personnalisé
assaini de ce dépôt. Les [sources officielles de cette version](https://github.com/rorygallagher2024/glasshouse/tree/1543769cfeb28c3ce0936dc6d20b24cd58c70255)
restent la référence amont. Licence MIT, copyright 2026 Rory Gallagher, conservée
dans [LICENSE](LICENSE).

Commencer par le [README du dépôt](../README.md), le
[guide manuel autonome](../docs/MANUAL_GUIDE.md) et les
[prompts Claude/Codex](../docs/AI_PROMPTS.md). Ils distinguent la démo, la première
installation, la mise à jour d’une installation privée et les différences avec
Lightkeeper. Cette branche n’est pas automatiquement le contenu publié de `main`.

## Démo et contrôles sur ordinateur

Depuis la racine du dépôt, avec Node.js 22+ :

```sh
npm --prefix glasshouse run demo -- --port 8766
```

La démo écoute sur `127.0.0.1`, avec apps/météo synthétiques et lancements simulés.
Elle ne contacte aucun appareil ni fournisseur de contenu. La validation complète
nécessite aussi Python 3, `diff` et `patch` :

```sh
npm ci --prefix glasshouse --ignore-scripts --no-audit --no-fund
sh scripts/validate.sh
```

Le serveur n’ajoute aucune dépendance npm de production. Les outils de
développement sont verrouillés dans `package-lock.json`. Voir
[provenance et licences](../docs/PROVENANCE.md) et
[validation et limites](../docs/VALIDATION.md).

## Installation TV

Ce serveur exige un **accès root existant**. Developer Mode seul ne fournit pas
les droits requis. L’installation par `server/deploy.sh` écrit les fichiers et
redémarre le service; elle n’est pas une prévisualisation. Suivre le guide manuel
pour identifier la cible, vérifier l’hôte, sauvegarder, préparer les réglages
privés, choisir une fenêtre d’interruption et contrôler le retour à LG Home.
Ne jamais remplacer une configuration existante par `config.example.json`.

Home et le tableau de bord ont des compatibilités distinctes. Le code 0.130 accepte
Home sur webOS 9, propose webOS 7/10 comme expérimentaux et requiert l’option
`allowExperimentalHome` sur webOS 11. Le bundle de persistance exige en plus un
Node système moderne. Aucun root, firmware, accès permanent, PIN personnalisé ou
port Lightkeeper n’est fourni par cette variante.

Le G des paramètres lance l’app native `com.tvweb.dashboard` seulement si elle
est présente; `--no-app` ne l’installe pas. Le toggle
[Recommandations](../docs/HOME_SETTINGS.md) utilise les cartes publiées par les
apps, sans garantie de reprise ou de personnalisation. Les images distantes ne
sont pas incluses. Les appels réseau optionnels restent désactivés dans l’exemple.

Pour les fonctions amont, lire [docs/](docs/) et la
[documentation officielle](https://rorygallagher2024.github.io/glasshouse/).
Les réglages d’accès et de confidentialité de cette variante sont documentés
séparément dans le [guide de configuration](../docs/INSTALLATION.md).
