# Personnalisation persistante de Glasshouse

Ce bundle reproduit les changements publics de l'accueil C6 sur Glasshouse
**0.130.0**, base `1543769cfeb28c3ce0936dc6d20b24cd58c70255`. Il garde les
personnalisations hors du répertoire remplacé par les mises à jour. La variante
Lightkeeper utilise un mécanisme distinct et n'est pas couverte ici.

Les quatre patches portent sur `assets/home.html`, `lib/home.js`,
`lib/routes.js` et `lib/remotekeys.js` (touche News sur webOS 11).
Cinq ressources sont ajoutées : `lib/home-weather.js`, le
fond nocturne et les trois fichiers du logo officiel Immich (SVG intact, licence
AGPL-3.0 complète et notice). Les logos propriétaires personnalisés ne sont pas
redistribués. Le rendu public
utilise les alternatives prévues dans l'interface; l'ajout privé de logos dont
vous avez les droits reste séparé de ce bundle.

## Génération et tests sur ordinateur

Depuis la racine du dépôt, avec Node.js 22, Python 3 et la commande `patch` :

```sh
node personalisation/generate.js
node personalisation/generate.js --check
node personalisation/test-apply.js
node personalisation/test-guard.js
```

`generate.js` vérifie les empreintes des quatre sources MIT conservées dans
`base/`, calcule des patches sans horodatage avec `difflib` de Python (même
algorithme sur macOS et Linux), copie uniquement les cinq ressources
autorisées et écrit leurs SHA-256 dans `manifest.json`. Il n'accède à aucun
appareil et ne lit aucune configuration personnelle. Relancez-le après une
modification des sources publiques; `--check` échoue si le bundle est périmé.

Les tests construisent leurs propres dossiers temporaires. Ils couvrent les
conflits, l'intégrité des ressources, les chemins et symlinks, les écritures
concurrentes, le retour arrière en cas d'échec, la conservation des réglages et
les relances du service. Ils ne valident pas une nouvelle version sur une télé.

## Installation manuelle facultative

Cette procédure modifie une télé **déjà rootée** disposant de Glasshouse 0.130.0,
de Homebrew Channel, de `patch`, de `start-stop-daemon` et d'un Node.js système
compatible avec `fs.rmSync` (14.14 minimum). Elle ne convient pas aux anciens
modèles limités à Node.js 8. Elle ne réalise ni root, ni installation de firmware,
ni modification des protections de confidentialité. Préparez une sauvegarde
privée de votre installation et vérifiez la compatibilité avant de l'exécuter.

Les réglages, l'ordre et les fonds existants restent dans `/var/lib/tvweb`.
Configurez les tuiles et la météo selon la documentation du dépôt; ce bundle ne
remplace pas `home.json` ou `config.json`. Aucun identifiant ou état de votre
télé ne doit être ajouté à ce dépôt.

Après génération et tests, créez une archive contenant uniquement les fichiers
nécessaires. Remplacez `tv.example.invalid` par le nom de votre télé :

```sh
TV_HOST=tv.example.invalid
tar -czf /tmp/glasshouse-personalisation.tgz -C personalisation \
  apply.js guard.js 49-glasshouse-personalisation manifest.json patches files base/LICENSE
scp /tmp/glasshouse-personalisation.tgz "root@$TV_HOST:/tmp/glasshouse-personalisation.tgz"
```

Ouvrez une session SSH sur cette télé, puis exécutez les commandes ci-dessous.
Elles refusent d'écraser un bundle ou un hook déjà présents. Ne contournez pas ce
refus : l'ancienne personnalisation peut contenir des changements privés.

```sh
ssh "root@$TV_HOST"
```

Sur la télé :

```sh
set -eu
test -d /var/lib/webosbrew/init.d
test -f /var/lib/tvweb/tvweb.js
test -x /usr/bin/node
command -v patch
command -v start-stop-daemon
/usr/bin/node -e 'if (typeof require("fs").rmSync !== "function") process.exit(1)'
test ! -e /var/lib/glasshouse-personalisation
test ! -e /var/lib/webosbrew/init.d/49-glasshouse-personalisation
mkdir -m 700 /var/lib/glasshouse-personalisation
tar -xzf /tmp/glasshouse-personalisation.tgz -C /var/lib/glasshouse-personalisation
chmod 700 /var/lib/glasshouse-personalisation
cp /var/lib/glasshouse-personalisation/49-glasshouse-personalisation /var/lib/webosbrew/init.d/
chmod 755 /var/lib/webosbrew/init.d/49-glasshouse-personalisation
/var/lib/webosbrew/init.d/49-glasshouse-personalisation
cat /var/lib/glasshouse-personalisation/status.json
```

Le hook applique le bundle au démarrage, avant le hook officiel `50-tvweb`, puis
surveille les fichiers toutes les dix secondes. Il attend deux observations
stables après une mise à jour et relance Glasshouse une seule fois s'il était
déjà actif. Il ne démarre pas un service volontairement arrêté.
L’installation du hook et une réapplication peuvent donc interrompre Home :
prévoir une fenêtre acceptée avant de l’exécuter pendant un visionnement.

## Diagnostic et limites

- `current` : fichiers personnalisés présents.
- `applied` : application terminée; consulter aussi le champ `restart`.
- `busy` : installation ou autre application en cours.
- `blocked` : conflit ou contrôle échoué; lire `message` et adapter le bundle.
- `waiting` : Glasshouse absent; aucune réinstallation automatique.
- `restart: failed` : fichiers appliqués mais relance du service échouée.

Les changements upstream hors des patches sont conservés. Un contexte ambigu,
une ressource existante différente ou un fichier incompatible bloque
l'application avant remplacement. Les deux dernières sauvegardes techniques
restent dans `backups/latest` et `backups/previous` **sur la télé**. Gardez-les
privées. N'envoyez pas non plus `status.json`, les verrous ou les journaux au dépôt.

Cette méthode ne garantit pas la compatibilité de toutes les futures versions,
d'une refonte de Glasshouse, d'une désinstallation, d'une remise à zéro ou d'une
mise à jour du firmware. Après une mise à jour, vérifiez l'état, le rendu et les
actions de la télécommande. Le changement de version reste un test distinct de
l'application locale des patches.

En cas de menu revenu au rendu amont, préserver d’abord l’installation actuelle
et `/var/lib/tvweb/.previous` s’il existe, avant une autre mise à jour. Cette copie
appartient à l’updater en place, n’est pas créée par un premier `deploy.sh` et n’est
pas garantie pour une installation IPK. Elle est remplacée à la prochaine mise
à jour. Les préférences peuvent survivre alors que les fichiers d’interface sont
remplacés; une sauvegarde de code n’autorise pas l’écrasement des réglages récents.

Un bundle bloqué doit être adapté à la version réellement installée. Comparer les
patches, les assets et les champs personnalisés normalisés par cette version,
puis tester le résultat localement; ne pas installer les bases de référence ni
rétrograder le serveur. Après application, contrôler les hashes sur disque **et**
la page HTTP servie. Le cache mémoire des assets peut nécessiter une relance du
seul service Glasshouse pendant une fenêtre approuvée, suivie d’un rafraîchissement
de Home. Les mises à jour LG/HBC et les protections ne sont pas modifiées par ce
bundle. Aucun gardien PIN n’est inclus.

Pour arrêter l'automatisme sans restaurer d'anciens fichiers, sur la télé :

```sh
chmod -x /var/lib/webosbrew/init.d/49-glasshouse-personalisation
start-stop-daemon -K -q -p /var/run/glasshouse-personalisation.pid
```

Cela conserve l'accueil et les réglages actuels. Pour réactiver, rendez le hook
exécutable puis lancez-le. Pour réessayer après une adaptation compatible :

```sh
/usr/bin/node /var/lib/glasshouse-personalisation/guard.js --once
```

La notice MIT des sources upstream est conservée dans [base/LICENSE](base/LICENSE).
Le logo Immich conserve sa licence AGPL-3.0 séparée sous
`files/assets/third-party/immich/`; conserver ensemble le SVG, la licence et la
notice. Aucun logo n'est présenté comme une affiliation avec Immich ou FUTO.
