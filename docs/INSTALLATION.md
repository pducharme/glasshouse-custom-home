# Installation et configuration

Pour un premier parcours sans assistant, suivre le [guide manuel autonome](MANUAL_GUIDE.md).
Ce document est la référence des réglages du profil public. Vérifier d’abord
[l’audit initial et la compatibilité](REPRODUCIBILITY.md), puis la présence du code
dans la référence téléchargée. Les anciens commits de `main`, antérieurs à la
fusion de la PR nº1, ne contiennent que les fonds.

La démo du README est le parcours recommandé pour examiner le rendu sans matériel.
Cette procédure facultative concerne une télé déjà rootée avec Homebrew Channel et
un accès SSH personnel, jamais une installation de root ou de firmware.

## Source complète

La version de cette branche est Glasshouse **0.130.0**, base
`1543769cfeb28c3ce0936dc6d20b24cd58c70255`, avec l'accueil C6 personnalisé. Le serveur
reste ES5, mais le mécanisme de persistance requiert un Node système moderne; voir
son guide. Cette version publique modifiée doit être validée sur chaque télévision.
L'expérience historique C6 ne prouve pas la compatibilité de tous les modèles.

Avant un déploiement, conserver hors du dépôt une sauvegarde privée de l'installation
et des réglages, puis vérifier les modifications. Le script ci-dessous installe et
redémarre Glasshouse et ajoute par défaut le hook `50-tvweb`; `--no-app` évite
seulement la tuile du tableau de bord. Il n’active pas automatiquement Glasshouse
Home. Il ne réalise pas une sauvegarde complète ni une restauration de version
prête à l’emploi; préparer celles du guide manuel avant de le lancer. Il ne fait
pas partie des commandes de démonstration ou de CI.

Pour une première installation, préparer d'abord un fichier privé minimal. Cette
commande refuse d'écraser un fichier existant et génère le token sans l'afficher :

```sh
cd glasshouse
node -e 'const fs=require("fs"),crypto=require("crypto"); const c=JSON.parse(fs.readFileSync("config.example.json")); c.token=crypto.randomBytes(32).toString("hex"); fs.writeFileSync("server/config.json",JSON.stringify(c,null,2)+"\n",{flag:"wx",mode:0o600});'
```

Pour une mise à jour avec une configuration existante sur la télé, aucun nouveau
fichier local n'est nécessaire. La première installation sans configuration est
refusée avant le remplacement des fichiers. Le transport SSH ne retombe jamais
silencieusement sur Telnet.

Depuis `glasshouse/` :

```sh
TV_HOST=tv.example.invalid
bash server/deploy.sh "$TV_HOST" --no-app
```

Le nom factice doit être remplacé localement. Le script préserve le `config.json`
existant et le stockage des fonds; une configuration locale d'amorçage ne sert que
sur une installation qui n'en a pas encore. Conserver les paramètres privés dans
`glasshouse/server/config.json` (ignoré), jamais dans un fichier versionné.
Le `config.example.json` doit être adapté : un token aléatoire local, le binding
réseau souhaité et uniquement les commandes nécessaires. Ne pas exposer le serveur
rooté à Internet. La documentation upstream est dans `glasshouse/docs/SECURITY.md`.

Le binding local de l'exemple nécessite un tunnel pour accéder au tableau de bord :

```sh
ssh -N -L 8767:127.0.0.1:8080 "root@$TV_HOST"
```

Ouvrir `http://127.0.0.1:8767/` et saisir le token depuis le fichier privé dans le
champ d'authentification; ne pas mettre de token dans une URL publique ou un rapport.
Activer explicitement `allowControl` dans la configuration privée quand les commandes
sont souhaitées. `allowPower` reste facultatif. Sur une installation existante,
modifier le `/var/lib/tvweb/config.json` de la télévision via les réglages ou SSH :
la copie locale d’amorçage ne remplace jamais ce fichier.

Le guide utilise le port serveur **8080**, valeur de l’exemple. Home est accepté
sur **webOS 9**, proposé sur **webOS 7 et 10** avec statut expérimental, puis sur
**webOS 11** seulement avec
`allowExperimentalHome: true`. Ce drapeau n’active pas Home sur webOS 5 ou sur
toute autre version non reconnue. Le Developer Mode ne remplace pas le root
requis. L’option reste désactivée dans l’exemple; vérifier la cible avant de
l’activer. La variante Lightkeeper des anciens modèles n’est pas incluse.

## Reproduire les rangées

Dans les réglages Glasshouse Home, activer l'accueil et conserver Applications puis
Consoles. L'exemple `examples/home.example.json` décrit les valeurs
synthétiques de départ; il ne faut pas le copier sur un `home.json` existant.

L'ordre de démonstration est YouTube, Netflix, Plex, Crave, Prime Video, ICI TOU.TV,
Bell Fibe et Accueil LG. Les applications doivent être installées séparément. Leurs
abonnements, sessions et données ne sont pas inclus. L'accueil LG reste accessible.
Pour lancer Bell comme une app, choisissez son identifiant réellement installé
(le profil accepte `com.bell.fibetv.production`), pas l’entrée HDMI de la boîte.
L’existence de cet ID sur une autre TV ne prouve pas sa présence sur la vôtre.
Le profil visuel C6 associe Switch 2 à HDMI 1, Xbox Series X à HDMI 3 et Bell Fibe à
HDMI 4; HDMI 2 n'est pas affiché parmi les consoles. Ce sont des choix de ce profil,
pas une détection universelle du matériel. Pour d'autres ports, adapter `items` et
`TILE.dev` dans `glasshouse/server/assets/home.html` et la tuile Bell dans
`glasshouse/server/lib/home.js`, puis régénérer le bundle et exécuter les tests.

Les quatre fonds diurnes sont téléversés dans les emplacements de Glasshouse Home :

| Emplacement | Fichier |
| --- | --- |
| morning | 01-lac-alpin-bleu.jpg |
| afternoon | 02-rockies-turquoise.jpg |
| evening | 03-lac-soleil-doux.jpg |
| night | 04-foret-brume-bleue.jpg |

L'accueil fait tourner ces quatre emplacements **par jour**, malgré leurs noms
historiques. Le cinquième fond, `05-lac-nuit.jpg`, est embarqué comme
`assets/home-wallpaper-dark.jpg` pour la plage sombre 17 h–6 h. L'heure de la télé
commande cette plage. L'appui long OK réorganise les tuiles sans révéler les apps
masquées.

Pour le lanceur photo optionnel, lire [Photos](PHOTOS.md). Il est non configuré par
défaut et n'exige aucun serveur, compte ou jeton pour examiner la démo.
Les [paramètres discrets](HOME_SETTINGS.md) donnent accès au toggle Recommandations
et à l’app native Glasshouse. Ils ne fournissent aucun verrou PIN personnalisé.

## Météo privée optionnelle

Le module n'effectue aucune requête quand `homeWeather.enabled` est faux ou lorsque
les paramètres sont invalides. La configuration privée accepte une latitude et une
longitude numériques, un fuseau IANA et un libellé de ville. Exemple de forme,
à remplir localement dans le `config.json` existant :

```json
{
  "homeWeather": {
    "enabled": false,
    "latitude": null,
    "longitude": null,
    "timezone": "Etc/UTC",
    "label": "YOUR_CITY"
  }
}
```

Après renseignement, `enabled: true` autorise les requêtes Open-Meteo avec ces
coordonnées. Le libellé est affiché dans le widget. Respecter les conditions du
service et conserver l'attribution. Ne jamais publier le fichier rempli.

## Mises à jour

La mise à jour upstream peut remplacer les fichiers personnalisés. Le bundle
[personalisation](../personalisation/README.md) les réapplique si les contextes sont
compatibles, sans restaurer d'anciens réglages. Une mise à jour incompatible bloque
l'application du patch et exige une adaptation. Vérifier le statut et le rendu après
chaque mise à jour. Le dépôt ne change ni les protections de confidentialité ni les
accès de la télévision.

Si le menu personnalisé disparaît, sauvegarder d’abord l’état actuel et, lorsqu’il
existe, `/var/lib/tvweb/.previous` : l’updater en place remplace cette copie à la
mise à jour suivante. Une installation IPK ne garantit pas cette sauvegarde.
Comparer version, configuration, assets et état du gardien avant de restaurer.
Rebaser les seuls changements compatibles sur la version installée; ne pas
rétrograder ni recopier aveuglément l’ancienne page ou l’ancien `home.json`.

Les assets sont aussi mis en cache en mémoire par le serveur. Après un remplacement
validé, un simple rafraîchissement peut encore servir l’ancienne page. Pendant une
fenêtre d’interruption acceptée, redémarrer **uniquement le service Glasshouse**,
puis vérifier l’empreinte de la réponse HTTP réellement servie et le rendu. Un
redémarrage de la TV n’est pas une étape par défaut. La procédure de sauvegarde
et de récupération est détaillée dans le [guide manuel](MANUAL_GUIDE.md).
