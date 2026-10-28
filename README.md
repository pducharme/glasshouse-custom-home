# Glasshouse — accueil C6 reproductible

> **Version de cette branche : 0.130.0.** Au contrôle du 28 octobre 2026,
> [main](https://github.com/pducharme/glasshouse-wallpapers/tree/1711bdb79d680ea87e74a68e33e3ee265ec81f14)
> livre encore l’adaptation 0.118.0; la [PR nº1](https://github.com/pducharme/glasshouse-wallpapers/pull/1)
> est fusionnée. L’évolution décrite ici appartient à
> `codex/c6-home-0130-recommendations` tant que sa propre fusion n’est pas vérifiée.
> [État public, compatibilité et différences](docs/REPRODUCIBILITY.md).

Aucun agent n’est nécessaire : le [guide manuel autonome](docs/MANUAL_GUIDE.md)
couvre la démo, les prérequis, la sauvegarde, l’installation et la restauration.
Des [prompts pour Claude ou Codex](docs/AI_PROMPTS.md) sont disponibles si vous
préférez être accompagné. Ils ne remplacent pas les vérifications propres à votre TV.

Ce dépôt contient les sources de l'accueil personnalisé Glasshouse, son serveur,
les cinq fonds déjà publiés, les tests et la protection contre l'écrasement des
personnalisations lors d'une mise à jour compatible. Base : **Glasshouse 0.130.0**,
commit `1543769cfeb28c3ce0936dc6d20b24cd58c70255`. Une mise à jour incompatible
peut remplacer le menu et nécessiter une nouvelle adaptation; le gardien ne
garantit pas une reprise automatique de toutes les futures versions.

L'interface conserve le carrousel horizontal, les rangées Applications et Consoles,
l'appui long sur OK pour réorganiser, les fonds quotidiens et le mode sombre de
17 h à 6 h. Une petite section Photos se trouve à droite des consoles; le bouton
Immich affiche le logo officiel et reste non configuré par défaut. La sélection
utilise un effet de verre et
le chevron du bas ouvre « Toutes les apps », y compris les apps masquées du carrousel.
Les logos propriétaires ne sont pas redistribués : des noms
typographiques les remplacent et les icônes natives sont utilisées sur une télé
lorsqu'elles existent. Le logo Immich est un asset distinct sous AGPL-3.0,
fourni avec sa source, sa licence et sa notice; les marques restent celles de
leurs propriétaires. La météo et tous les états de la démo sont synthétiques.
La variante Lightkeeper d'une autre télévision n'est pas incluse.

Un engrenage discret près de Toutes les apps ouvre **Paramètres**. Le toggle
**Recommandations** commande la fonction native : les cartes de l’app sélectionnée
se déplient à la demande et restent absentes si elle n’en fournit aucune. Il n’y
a ni reprise universelle, ni progression ou personnalisation garantie. Le petit
**G** ouvre l’app native Glasshouse lorsqu’elle est installée. Le profil public
garde Recommended désactivé et Photos non configuré. Aucun verrou PIN personnalisé
n’est fourni. Voir [Paramètres et recommandations](docs/HOME_SETTINGS.md).

## Démo locale sans télévision

Prérequis : Node.js 22 ou plus récent. Aucun paquet npm n'est nécessaire à la démo.

```sh
SOURCE_REF=codex/c6-home-0130-recommendations
git clone --branch "$SOURCE_REF" --single-branch \
  https://github.com/pducharme/glasshouse-wallpapers.git glasshouse-interface
cd glasshouse-interface
git rev-parse HEAD
test -f glasshouse/package.json
npm --prefix glasshouse run demo -- --port 8766
```

Ouvrir `http://127.0.0.1:8766/`. Le serveur écoute exclusivement sur la boucle locale;
il ne contacte ni télévision ni service externe. Les données privées ne sont pas
lues. Les lancements sont simulés, et l'ordre revient à sa valeur initiale à chaque
redémarrage. `Ctrl+C` arrête la démo. Notez le SHA affiché : une branche peut évoluer.
Si `glasshouse/package.json` est absent, arrêtez et vérifiez la branche; un ancien
checkout de fonds seuls ne contient pas la démo.
Utilisez `main` à la place de `SOURCE_REF` seulement après avoir vérifié qu’il
contient cette évolution et relevé son SHA.

Navigation : flèches, Entrée pour OK, appui long sur Entrée pour déplacer une tuile,
Retour/Echap pour annuler. `?hour=12` montre le jour et `?hour=19` le mode sombre.
Le rendu cible est 1920 × 1080 et se redimensionne à la fenêtre.
Le tiroir se parcourt avec les flèches; Retour/Echap revient à l'accueil.
Les applications supplémentaires et la météo sont fictives. Le bouton Photos
n'accède à aucune photothèque. Voir [Photos et navigation](docs/PHOTOS.md).

## Sources et installation

- [Guide manuel autonome](docs/MANUAL_GUIDE.md) : parcours complet sans Codex.
- [Prompts Claude / Codex](docs/AI_PROMPTS.md) : diagnostic puis préparation et validation.
- `glasshouse/` : serveur, interface et tests; [référence de configuration](docs/INSTALLATION.md).
- `personalisation/` : patches reproductibles et garde de persistance;
  [installation facultative](personalisation/README.md).
- `examples/home.example.json` : ordre synthétique des tuiles.
- `glasshouse/config.example.json` : configuration avec placeholders et météo désactivée.
- [Provenance et licences](docs/PROVENANCE.md), [validation et limites](docs/VALIDATION.md).
- [Lanceur Photos, clients Immich et navigation](docs/PHOTOS.md).
- [Paramètres, Recommandations et raccourci G](docs/HOME_SETTINGS.md).

L'installation sur une télé est manuelle et distincte de la démo. Elle exige une
télé déjà rootée et compatible. Le Developer Mode seul ne fournit pas les droits
requis pour remplacer HOME ou installer le serveur et ses hooks. La démo ne déploie
rien. Le script de déploiement TV, lui, écrit les fichiers, installe par défaut un
hook de démarrage et relance le serveur; `--no-app` évite seulement la tuile du
tableau de bord. Lire le guide et préparer le retour arrière avant son utilisation.
Les réglages réels, adresses, clés, mots de passe, cookies, sauvegardes, journaux et
captures personnelles restent privés; `.gitignore` couvre les emplacements usuels.
Une configuration existante ne doit pas être remplacée par l'exemple.

## Vérification depuis un checkout propre

Avec Node.js 22+, Python 3, `diff` et `patch` :

```sh
npm ci --prefix glasshouse --ignore-scripts --no-audit --no-fund
sh scripts/validate.sh
```

Il n'y a pas de compilation du serveur : JavaScript est livré directement. Le
contrôle vérifie les types, la compatibilité ES5, les tests, le bundle de persistance
et l'assemblage du paquet. Les sorties temporaires restent hors du dépôt. Les scans
Gitleaks de l'arbre et de l'historique s'exécutent aussi dans la CI. Ils réduisent le
risque d'exposition sans constituer une garantie absolue.

# Fonds d’écran

Cinq fonds d’écran générés par IA pour un accueil Glasshouse : lacs alpins, montagnes et forêt, avec un fond dédié au mode sombre.

Les fichiers JPEG sont les images utilisées pour cet accueil. Les paysages sont synthétiques et ne représentent pas nécessairement des lieux réels.

| Fond | Téléchargement direct |
| --- | --- |
| Lac alpin bleu | [01-lac-alpin-bleu.jpg](https://raw.githubusercontent.com/pducharme/glasshouse-wallpapers/main/01-lac-alpin-bleu.jpg) |
| Lac turquoise des Rocheuses | [02-rockies-turquoise.jpg](https://raw.githubusercontent.com/pducharme/glasshouse-wallpapers/main/02-rockies-turquoise.jpg) |
| Lac au soleil doux | [03-lac-soleil-doux.jpg](https://raw.githubusercontent.com/pducharme/glasshouse-wallpapers/main/03-lac-soleil-doux.jpg) |
| Forêt et brume bleue | [04-foret-brume-bleue.jpg](https://raw.githubusercontent.com/pducharme/glasshouse-wallpapers/main/04-foret-brume-bleue.jpg) |
| Lac de nuit | [05-lac-nuit.jpg](https://raw.githubusercontent.com/pducharme/glasshouse-wallpapers/main/05-lac-nuit.jpg) |

## Aperçus

### Lac alpin bleu

![Lac alpin bleu](01-lac-alpin-bleu.jpg)

### Lac turquoise des Rocheuses

![Lac turquoise des Rocheuses](02-rockies-turquoise.jpg)

### Lac au soleil doux

![Lac au soleil doux](03-lac-soleil-doux.jpg)

### Forêt et brume bleue

![Forêt et brume bleue](04-foret-brume-bleue.jpg)

### Lac de nuit

![Lac de nuit](05-lac-nuit.jpg)
