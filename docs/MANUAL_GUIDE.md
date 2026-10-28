# Installer et utiliser l’interface sans assistant

Ce guide s’exécute avec un terminal et un navigateur. Claude ou Codex ne sont pas
nécessaires. Il décrit les fichiers de **cette version**, pas un installateur
universel pour toutes les LG. Commencez par la démo; le parcours TV est facultatif.

## 1. Choisir la bonne source

La [PR nº1](https://github.com/pducharme/glasshouse-wallpapers/pull/1) est fusionnée.
Au contrôle du 28 octobre 2026, `main` livre encore l’adaptation 0.118.0 au SHA
`1711bdb79d680ea87e74a68e33e3ee265ec81f14`. Ce guide accompagne la branche
**0.130.0** `codex/c6-home-0130-recommendations`. Vérifiez sa publication, son SHA
et sa CI; une branche ou PR publique n’est pas automatiquement dans `main`.

Sur l’ordinateur, avec Git et Node.js 22 ou plus récent :

```sh
SOURCE_REF=codex/c6-home-0130-recommendations
git clone --branch "$SOURCE_REF" --single-branch \
  https://github.com/pducharme/glasshouse-wallpapers.git
cd glasshouse-wallpapers
git rev-parse HEAD
test -f glasshouse/package.json
test -f docs/MANUAL_GUIDE.md
test -f docs/AI_PROMPTS.md
npm --prefix glasshouse run demo -- --port 8766
```

Notez le SHA affiché et arrêtez si un des fichiers vérifiés est absent. La base
amont de cette branche est `1543769cfeb28c3ce0936dc6d20b24cd58c70255`, version
0.130.0; le SHA du fork personnalisé est distinct. Utilisez `main` comme
`SOURCE_REF` seulement après avoir vérifié qu’il contient cette évolution.
Ouvrez `http://127.0.0.1:8766/`. Les lancements et la météo sont simulés; aucune TV
n’est contactée. Les flèches, Entrée, appui long sur Entrée et Echap permettent
d’essayer l’accueil. `?hour=19` montre le mode sombre. Arrêtez avec `Ctrl+C`.

Pour vérifier les sources, installez aussi Python 3 et les commandes `diff` et
`patch`, puis, depuis la racine :

```sh
npm ci --prefix glasshouse --ignore-scripts --no-audit --no-fund
TEST_CONCURRENCY=1 sh scripts/validate.sh
```

Il n’y a pas de build JavaScript à déployer : le serveur est livré en source.
Ces tests ne valident ni les privilèges ni le moteur web de votre TV. Voir le
[comparatif de reproductibilité](REPRODUCIBILITY.md) pour ce qui est livré,
préparé ou absent, et les [instructions pour assistants](AI_PROMPTS.md).

## 2. Choisir un parcours compatible

| Situation | Parcours possible ici |
| --- | --- |
| Ordinateur uniquement | Démo et tests, sans compte LG ni télévision. |
| LG en Developer Mode seulement | Installation d’apps webOS selon LG; **pas** ce remplacement de HOME ni le serveur root de ce dépôt. |
| TV déjà rootée, Homebrew Channel et SSH root déjà fonctionnels | Vérifications ci-dessous, puis installation manuelle si la version convient. |
| Glasshouse Home sur webOS 9 ou 10 | Versions acceptées par cette source; validation sur votre matériel indispensable. |
| Glasshouse Home sur webOS 7 | Accepté avec statut expérimental par la base 0.130; validation du modèle indispensable. |
| Glasshouse Home sur webOS 11 | Option privée `allowExperimentalHome: true` nécessaire, après choix explicite du parcours expérimental. |
| webOS 5 / ancien Node système | Le port Lightkeeper utilisé sur un autre appareil est **distinct et absent de cette branche**. Ne pas copier ce bundle à sa place. |

Le serveur de tableau de bord peut avoir une compatibilité plus large que le
**remplacement de HOME** : `home.supported()` limite ce dernier à webOS 7, 9, 10 et
11 avec l’option indiquée. Ce guide utilise le **port 8080** de l’exemple; adapter
le tunnel si votre configuration en utilise un autre. Le bundle facultatif de
persistance exige en plus Node système 14.14+ (`fs.rmSync`), `patch` et
`start-stop-daemon`. Le succès d’une démo sur ordinateur ne lève pas ces limites.

Le [Developer Mode officiel LG](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app)
sert à installer et tester des apps avec l’utilisateur `prisoner`, généralement
sur le port 9922. Il est limité par une session; sa désactivation peut supprimer
les apps installées par ce moyen. Il ne fournit pas l’accès root utilisé ici.
Le [comparatif webOSbrew](https://www.webosbrew.org/rooting/) distingue également
ces capacités. Installer Homebrew Channel comme simple app ne prouve pas que la
TV est rootée. Si vous n’avez pas déjà l’accès requis, arrêtez le parcours TV :
ce guide ne crée pas de clé, ne root pas la TV et ne modifie pas le firmware.

## 3. Identifier la cible et vérifier l’accès existant

Toutes les valeurs ci-dessous se renseignent **localement**. Le nom factice ne
fonctionne pas. Gardez l’adresse, les noms d’appareils, mots de passe, clés et
archives hors du dépôt et hors des messages publics.

Sur l’ordinateur :

```sh
TV_HOST=tv.example.invalid
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes "root@$TV_HOST" \
  'id -u; /usr/bin/node --version; command -v tar; command -v start-stop-daemon'
```

`id -u` doit répondre `0`. Cette commande suppose une clé et une empreinte d’hôte
**déjà connues et vérifiées**. En cas d’échec d’authentification, de clé d’hôte
changée ou de cible ambiguë, arrêtez : n’acceptez pas aveuglément une nouvelle
empreinte, ne supprimez pas l’ancienne et ne basculez pas sur Telnet. Le script de
déploiement utilise lui-même `accept-new`; cette vérification préalable stricte
est donc importante. Les profils SSH existants peuvent fournir le port et la clé;
ne mettez pas de secret dans une ligne de commande.

Dans la session SSH existante, identifiez le modèle et les versions réellement
actifs; conservez le résultat dans vos notes privées :

```sh
/usr/bin/luna-send -n 1 -w 8000 \
  luna://com.webos.service.tv.systemproperty/getSystemProperties \
  '{"keys":["modelName","firmwareVersion","sdkVersion"]}' </dev/null
```

Vérifiez aussi la présence de `/var/lib/tvweb`, de son `config.json`, des hooks
`50-tvweb` et `49-glasshouse-personalisation` sous `/var/lib/webosbrew/init.d`,
et d’un éventuel `/var/lib/glasshouse-personalisation`. Ne remplacez pas une
installation Lightkeeper ou une personnalisation inconnue avec ce guide.

## 4. Sauvegarder avant toute installation

L’export JSON du tableau de bord est utile pour certains réglages, mais il ne
contient pas les secrets d’accès, tous les paramètres serveur, l’activation HOME,
le code ou les images téléversées. Il ne constitue pas une sauvegarde complète.
`deploy.sh` ne crée pas non plus le dossier `.previous` employé par l’updater.
Lorsqu’il existe déjà sous `/var/lib/tvweb`, préserver `.previous` avec l’état
actuel **avant toute autre mise à jour** : l’updater en place remplace cette copie
à l’update suivante. Une installation IPK ne garantit pas sa présence.

Pour une **mise à jour de Glasshouse existant** :

1. Notez la version, les fichiers/hooks présents, l’état activé de HOME et si le
   service/gardien tournent. Évitez les changements de réglages pendant la copie.
2. Si un gardien de personnalisation existe, arrêtez seulement ce gardien selon
   [sa procédure](../personalisation/README.md#diagnostic-et-limites), en notant
   son état et le mode du hook pour les rétablir ensuite. Une personnalisation
   privée différente exige une comparaison avant remplacement, pas une suppression.
3. Convenez d’une fenêtre d’interruption avant d’arrêter le service ou de changer
   l’app affichée. Sur la TV, arrêtez temporairement Glasshouse. Cette action rend la main à LG
   sans effacer `home.json`; le prochain démarrage peut reprendre l’accueil :

```sh
/var/lib/tvweb/tvwebctl stop
/var/lib/tvweb/tvwebctl status
```

Sur l’ordinateur, dans un **second terminal**, définissez le même `TV_HOST`, puis
créez une archive privée hors du checkout. Le répertoire neuf empêche d’écraser
une ancienne sauvegarde :

```sh
TV_HOST=tv.example.invalid
BACKUP_DIR="$HOME/glasshouse-private/backup-$(date +%Y%m%d-%H%M%S)"
(
set -eu
umask 077
mkdir -p "$HOME/glasshouse-private"
mkdir "$BACKUP_DIR"
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes "root@$TV_HOST" '
  set -eu
  cd /
  test -d var/lib/tvweb
  set -- var/lib/tvweb
  for p in var/lib/glasshouse-personalisation \
    var/lib/webosbrew/init.d/49-glasshouse-personalisation \
    var/lib/webosbrew/init.d/50-tvweb; do
    if test -e "$p"; then set -- "$@" "$p"; fi
  done
  tar -czf - "$@"
' > "$BACKUP_DIR/before.tgz"
test -s "$BACKUP_DIR/before.tgz"
tar -tzf "$BACKUP_DIR/before.tgz" > "$BACKUP_DIR/contents.txt"
)
```

Arrêtez si SSH ou `tar` échoue; une archive partielle ne suffit pas. Vérifiez dans
`contents.txt` que code, `config.json`, `home.json` s’il existe, fonds téléversés et
hooks attendus sont présents. Testez l’extraction dans un dossier privé vide et
calculez une empreinte locale :

```sh
mkdir "$BACKUP_DIR/verify"
tar -xzf "$BACKUP_DIR/before.tgz" -C "$BACKUP_DIR/verify"
shasum -a 256 "$BACKUP_DIR/before.tgz" > "$BACKUP_DIR/before.sha256"
```

Sur Linux, `sha256sum` peut remplacer `shasum -a 256`. Les fichiers extraits et
l’archive contiennent potentiellement des secrets : ne les joignez pas à une issue.
Cette copie ne remplace pas une sauvegarde de firmware ni des comptes d’apps.
Si vous abandonnez l’installation, redémarrez le service et remettez le gardien
exactement dans son état précédent.

Pour une **première installation réellement vierge**, consignez plutôt l’absence
des répertoires/hooks ciblés. N’exécutez pas le bloc de sauvegarde ci-dessus sans
`/var/lib/tvweb`. Si des fichiers existent déjà malgré l’absence du serveur,
classez la situation comme installation existante et examinez-les avant d’écrire.

## 5. Préparer la configuration privée

Pour une première installation, depuis la racine du checkout, cette commande
crée le fichier ignoré avec un token aléatoire sans l’afficher et refuse d’écraser
un fichier existant :

```sh
node -e 'const fs=require("fs"),crypto=require("crypto"); const c=JSON.parse(fs.readFileSync("glasshouse/config.example.json")); c.token=crypto.randomBytes(32).toString("hex"); fs.writeFileSync("glasshouse/server/config.json",JSON.stringify(c,null,2)+"\n",{flag:"wx",mode:0o600});'
```

Ouvrez **ce fichier privé** dans votre éditeur et renseignez seulement les choix
voulus. Conservez `host: "127.0.0.1"` et `port: 8080` pour le parcours tunnel.
`allowControl: true` autorise les commandes et l’activation de HOME;
`allowPower` n’est pas nécessaire au lanceur. Sur webOS 11, choisissez
`allowExperimentalHome: true` uniquement après les vérifications précédentes.
Les fonctions MQTT, météo, télémétrie optionnelle et masquage système peuvent
rester désactivées. Ne remplacez pas le token par une valeur d’exemple.

Pour une installation existante, le fichier effectif est
`/var/lib/tvweb/config.json` **sur la TV**. Modifiez seulement les valeurs voulues
avec votre éditeur privé via l’accès existant, après sauvegarde; conservez toutes
les autres valeurs. Un `config.json` local d’amorçage ne remplace jamais celui-ci.
Ne copiez pas `config.example.json` ou `home.example.json` sur votre configuration.

## 6. Installer le serveur, puis activer HOME séparément

Après revue de la cible, de la sauvegarde et du diff, cette commande **écrit sur la
TV et redémarre Glasshouse** :

```sh
cd glasshouse
bash server/deploy.sh "$TV_HOST" --no-app
```

Elle copie le serveur dans `/var/lib/tvweb`, conserve sa configuration existante,
installe par défaut le hook de démarrage `50-tvweb`, puis redémarre le serveur.
`--no-app` évite seulement d’ajouter la tuile du **tableau de bord** dans LG Home;
il n’active pas Glasshouse Home et ne désactive pas la persistance.
Le raccourci **G** des paramètres exige cette app native : vérifiez
`com.tvweb.dashboard` dans le catalogue. S’il manque, `--no-app` ne l’installera
pas et le G signalera l’échec. Choisir séparément son installation avec `--app`,
puis vérifier l’app réellement installée avant de tester
le raccourci. Ne substituez pas une URL ni une app trouvée par nom approximatif.
Sans option, une première installation ajoute l’app, mais une mise à jour laisse
son état inchangé : elle ne réinstalle pas une app que vous aviez retirée.
`--no-persist` évite l’écriture du hook, mais ne retire pas un hook déjà présent.
Les fichiers existants sont remplacés; ce script n’est pas une transaction de
rollback intégral en cas de coupure. En cas de résultat incertain, contrôlez l’état
avant toute répétition.

Depuis l’ordinateur, ouvrez le tableau de bord par un tunnel lié à la boucle locale :

```sh
ssh -o StrictHostKeyChecking=yes -N \
  -L 127.0.0.1:8767:127.0.0.1:8080 "root@$TV_HOST"
```

Ouvrez `http://127.0.0.1:8767/`. Utilisez le token de votre configuration privée
pour vous authentifier; gardez-le hors de l’URL et des rapports. Le tunnel doit
rester ouvert pendant l’utilisation du tableau de bord; `Ctrl+C` le ferme.

Dans **Home**, choisissez **Use Glasshouse Home**, puis la confirmation proposée.
Cette étape modifie le remplacement de l’accueil LG; elle est distincte du serveur.
Le mécanisme courant superpose temporairement l’interface à l’accueil LG par
montage, il ne s’agit pas d’installer une app HOME générique en Developer Mode.
Le port choisi doit rester disponible. Un contrôle de compatibilité refusé n’est
pas à désactiver pour forcer une autre version.

Vérifiez tout de suite les moyens de sortie : tuile **LG Home**, appui prolongé
sur **HOME** (environ 1,2 s), puis retour par HOME court. Pour revenir durablement
à l’accueil LG, utilisez **Use LG Home**. Si le tableau de bord ne répond plus,
la commande de secours ciblée est, sur la TV :

```sh
/var/lib/tvweb/tvwebctl restore-glasshouse-home
```

`restore-home` est une autre fonction liée à la disposition LG : ne la substituez
pas. Une restauration signalée incomplète doit être terminée avant désinstallation.
Ne copiez pas une procédure d’effacement de checkpoints ou de reboot comme remède
habituel à un problème d’interface.

## 7. Adapter les apps, HDMI, Photos et fonds à votre TV

**Apps.** Installez et connectez vos services séparément. Dans le tableau de bord,
utilisez les apps réellement listées, puis leur affichage/masquage et leur ordre
dans Home. Le nom commercial ne garantit pas le même identifiant dans chaque
région. « Toutes les apps » liste les points de lancement exposés par le serveur,
pas chaque paquet système; il garde les apps retirées du carrousel accessibles.
Conservez la tuile LG Home. L’appui long sur OK permet la réorganisation; testez
sauvegarde et annulation avant de poursuivre.
Bell dans Applications doit utiliser l’ID de l’app webOS réellement installée si
c’est cette destination qui est souhaitée. La boîte Bell Fibe et son entrée HDMI
restent un périphérique distinct; changer l’un ne doit pas supprimer l’autre.

**HDMI.** Le profil source contient des choix fixes, pas une détection universelle :
présentation de consoles sur HDMI 1/3 et une tuile TV sur HDMI 4. Ne recopiez pas
ces choix sur une TV où seul un Firestick est connecté. Le réglage d’ordre et de
masquage ne change pas une association codée en dur. Avant installation, adaptez
les sélections dans `items()` et `TILE.dev` de
[`home.html`](../glasshouse/server/assets/home.html), et l’entrée HDMI virtuelle
dans [`home.js`](../glasshouse/server/lib/home.js), selon les ports et appareils
que vous avez identifiés. Puis régénérez/testez le bundle comme indiqué plus bas.
Si vous ne souhaitez pas modifier le code, la démo est utilisable mais ce profil
n’est pas encore un configurateur matériel universel. Ne fabriquez pas de consoles
pour remplir une rangée.

**Photos.** Le logo est fourni; aucun client ni compte Immich ne l’est. Si vous
souhaitez ce lanceur, installez un client choisi séparément selon ses instructions,
puis vérifiez l’ID de l’app réellement installée dans le catalogue de la TV. Pour
une lecture locale par votre accès SSH existant :

```sh
/usr/bin/luna-send -n 1 -w 8000 \
  luna://com.webos.applicationManager/listApps '{}' </dev/null
```

Cette liste est privée; ne la publiez pas. Dans le `home.json` privé existant sous
`/var/lib/tvweb`, changez uniquement `photosAppId` vers l’ID vérifié et accepté :
`com.immich.webos` ou `com.seeky91.immichtv`. Ces chaînes ne constituent pas une
preuve d’installation. Gardez `""` si aucun client n’est choisi. Le serveur
refuse de lancer une app absente ou une cible hors liste autorisée. Voir
[Photos](PHOTOS.md) pour les projets, licences et limites. Le lanceur n’a besoin
ni d’une URL de serveur, ni d’une clé API, ni d’un album. Vérifiez seulement que
l’app correcte s’ouvre; l’accès au contenu et l’authentification sont des étapes
séparées, propres au client.

**Fonds.** Téléversez les quatre JPEG diurnes dans les emplacements morning,
afternoon, evening et night dans cet ordre : `01-…`, `02-…`, `03-…`, `04-…`.
Dans cette personnalisation, ils tournent **par jour**, malgré les noms historiques
des emplacements. Le cinquième fond `05-lac-nuit.jpg` est embarqué pour 17 h–6 h,
selon l’heure locale de la TV. Les uploads restent hors du payload des mises à jour.
La météo réelle est facultative; renseignez vos coordonnées et attribution selon
[Installation](INSTALLATION.md#météo-privée-optionnelle), uniquement dans le fichier
privé. La démo ne reproduit pas votre lieu ou vos abonnements.

**News → Plex.** Dans **Apps → Remote keys**, choisissez News uniquement si cette
touche est offerte par le mécanisme réellement actif et si votre appui physique
correspond à cette entrée. Le support ajouté concerne le mapping natif `haystack`
sur webOS 11; ce n’est pas un keycode universel. Choisissez votre Plex installé,
puis testez un appui réel. Si la touche est inconnue, arrêtez cette partie plutôt
que d’inventer un code ou d’installer un intercepteur. Pour annuler seulement ce
choix, utilisez **As LG has it** sur cette touche. `restore-keys` restaure toutes
les touches et n’est pas le retour ciblé. Au démarrage/à la sortie de veille, le
raccourci LG peut agir avant Glasshouse, notamment si le bouton sert à allumer la TV.

**Paramètres et Recommandations.** Depuis Toutes les apps, Droite puis OK ouvre
l’engrenage. Le toggle Recommandations conserve les autres réglages et respecte
la valeur déjà enregistrée; il est désactivé dans les exemples. L’activer autorise
l’affichage des contenus proposés par les apps et le chargement de leurs images
distantes. Ne promettez ni reprise ni personnalisation. L’accordéon s’ouvre par
Bas/clic, ne mélange jamais les fournisseurs et ne présente aucune carte pour une
app qui n’en donne pas. L’absence de carte n’est pas une erreur à contourner.
Voir [le guide des paramètres](HOME_SETTINGS.md) pour le comportement complet.
Le petit G à droite de Fermer ouvre uniquement l’app Glasshouse vérifiée.

## 8. Persistance, démarrage et validation

Le hook serveur `50-tvweb` relance Glasshouse au démarrage. Le gardien facultatif
`49-glasshouse-personalisation` réapplique ce bundle après une mise à jour
compatible. Ce sont deux mécanismes différents. Suivez
[son guide](../personalisation/README.md) seulement après installation fonctionnelle
et vérification de la version Node système; il refuse un bundle/hook préexistant.
N’écrasez pas ce refus : une adaptation privée peut déjà s’y trouver.

Après une modification de source et **avant** de construire/copier le bundle :

```sh
# Depuis la racine du dépôt
node personalisation/generate.js
node personalisation/generate.js --check
node personalisation/test-apply.js
node personalisation/test-guard.js
TEST_CONCURRENCY=1 sh scripts/validate.sh
```

Sur la TV, lisez le `status.json` du gardien **en privé** : `current` confirme les
fichiers attendus; `applied` doit aussi avoir une relance réussie ou non nécessaire.
`blocked`, `busy` ou `waiting` ne sont pas des succès. Les sauvegardes techniques
`latest`/`previous` du bundle ne remplacent pas votre archive initiale.

Testez sans ouvrir de contenu personnel : lancement d’une app, HDMI choisi,
Photos, flèches/OK/Retour, tiroir, réorganisation, noms accessibles et mouvement
réduit. Vérifiez que le logo Immich reste transparent et que les noms/« Prêt »
restent absents visuellement. Un test de veille et de démarrage à froid est ensuite
**distinct** : prévoyez-le quand aucune lecture/enregistrement n’est en cours.
Ne promettez pas un délai fixe. Quick Start+, Home Auto Launch, le firmware et les
services influencent le démarrage; l’activation peut ajuster Home Auto Launch,
qui est restauré lors de la désactivation. Ne forcez pas ces réglages pour imiter
une autre TV. Gardez un accès de secours à LG Home.

## Récupérer le menu après une mise à jour amont

Un retour au menu standard ne prouve pas la perte des réglages. Avant une autre
update, préserver l’état actuel **et `.previous` s’il existe**, selon la sauvegarde
ci-dessus. Relever la version réelle, les hashes, les assets, l’état du gardien et
les seules erreurs utiles en privé. Un `blocked` peut signaler un patch incompatible;
un retour à LG Home peut aussi être un secours. Ne pas réinstaller à l’aveugle.

Comparer les personnalisations sauvegardées avec les sources officielles de la
version maintenant installée. Reprendre les deltas compatibles, conserver les
nouvelles fonctions amont et tester avant application. Vérifier séparément les
champs personnalisés : une version stock peut supprimer un champ qu’elle ne connaît
pas lorsqu’elle sauvegarde les réglages. Réparer seulement le champ nécessaire
avec la cible installée vérifiée; préserver les autres préférences actuelles.

Appliquer les fichiers préparés avec une sauvegarde ciblée et des contrôles de
modification concurrente. Ne pas copier toute l’ancienne page, `home.json` ou
`.previous` sur la nouvelle version. La procédure complète de retour à un ancien
état ci-dessous est un choix séparé, pas le traitement normal d’un menu perdu.

Le serveur conserve les assets en mémoire. Comparer le hash du fichier et celui
du contenu **réellement servi**; un simple rafraîchissement peut garder l’ancienne
page. Pendant une fenêtre d’interruption acceptée seulement :

```sh
/var/lib/tvweb/tvwebctl restart
```

Cela redémarre le service, pas la télévision. Vérifier ensuite la réponse HTTP,
le gardien, le menu et les destinations approuvées avant d’annoncer la restauration.
Une capture vide ne prouve pas que l’écran physique est éteint. Préserver les
mises à jour LG/HBC et les protections; aucun PIN personnalisé n’est à réintroduire.

## 9. Revenir à l’état précédent

Pour abandonner seulement le remplacement d’accueil, **Use LG Home** ou
`restore-glasshouse-home` suffit; vérifiez que LG Home revient. Pour revenir aux
**fichiers d’avant un déploiement manuel**, utilisez votre archive privée :

1. Vérifiez l’empreinte et le contenu de l’archive sur l’ordinateur. Elle doit venir
   de cette TV, de l’intervention concernée, et contenir uniquement les chemins
   sauvegardés. Ne restaurez pas l’archive d’un autre appareil.
2. Sur la TV, restaurez d’abord LG Home, puis arrêtez le gardien de personnalisation
   et le serveur. Si la restauration HOME échoue, arrêtez cette procédure.
3. Conservez l’installation actuelle et les réglages récents dans une **nouvelle**
   sauvegarde privée. Comparez les dates et les changements utilisateur intervenus
   depuis le premier backup : ne les écrasez pas sans les réconcilier.
4. Placez l’archive vérifiée dans un répertoire temporaire privé et extrayez-la
   d’abord dans un **répertoire neuf de staging**, pas directement par-dessus le
   système actif. Vérifiez code, configuration, fichiers et modes restaurés.
5. Remplacez uniquement les répertoires/hooks présents dans l’inventaire initial,
   en conservant les versions retirées pour retour. Les fichiers créés par cette
   installation mais absents de l’inventaire doivent être retirés seulement après
   identification, pas par une suppression générale de `/var/lib`.
6. Réappliquez les modes du snapshot, puis le mode **original noté avant l’arrêt**
   du hook du gardien : la sauvegarde a pu le capturer temporairement désactivé.
   Redémarrez serveur/gardien uniquement s’ils étaient actifs avant. Vérifiez
   version, HOME, configuration et lancements.

Pour préparer ce staging avec l’archive créée plus haut, gardez votre `TV_HOST`
et `BACKUP_DIR` privés. Sur l’ordinateur :

```sh
(
set -eu
ssh -o StrictHostKeyChecking=yes "root@$TV_HOST" \
  'umask 077; test ! -e /var/lib/glasshouse-restore-manual && mkdir -m 700 /var/lib/glasshouse-restore-manual'
scp -o StrictHostKeyChecking=yes "$BACKUP_DIR/before.tgz" \
  "root@$TV_HOST:/var/lib/glasshouse-restore-manual/before.tgz"
)
```

Ne poursuivez pas si le répertoire existait déjà ou si la copie échoue. Sur la TV,
**après** les étapes 1–3 et vérification de l’archive privée :

```sh
set -eu
cd /var/lib/glasshouse-restore-manual
mkdir stage current
tar -xzf before.tgz -C stage
test -f stage/var/lib/tvweb/tvweb.js
test -f stage/var/lib/tvweb/config.json
```

À ce point, inspectez le staging et comparez les changements récents. Le bloc
suivant est le **remplacement effectif**, limité aux quatre chemins du backup;
il conserve les versions retirées dans `current`. Ne l’exécutez pas pour une
archive d’une autre TV, pour une première installation sans backup, ou si les
changements utilisateur n’ont pas été réconciliés. HOME, serveur et gardien doivent
être arrêtés comme décrit plus haut. Si un chemin ciblé est un lien symbolique
ou reste un montage actif, arrêtez et examinez cette particularité avant de le déplacer :

```sh
set -eu
cd /var/lib/glasshouse-restore-manual
for p in var/lib/tvweb var/lib/glasshouse-personalisation \
  var/lib/webosbrew/init.d/49-glasshouse-personalisation \
  var/lib/webosbrew/init.d/50-tvweb; do
  if test -e "/$p"; then
    mkdir -p "current/$(dirname "$p")"
    mv "/$p" "current/$p"
  fi
  if test -e "stage/$p"; then
    mkdir -p "/$(dirname "$p")"
    mv "stage/$p" "/$p"
  fi
done
```

Une interruption exige l’inspection de `stage`, `current` et des destinations
avant toute reprise : ce bloc n’est pas atomique ni réexécutable à l’aveugle.
Il respecte aussi l’absence d’un ancien hook/bundle : un fichier ajouté depuis le
backup demeure dans `current` au lieu d’être relancé. Réappliquez le mode original
du hook de gardien, si présent, puis `/var/lib/tvweb/tvwebctl start` et le hook de
gardien seulement s’ils étaient actifs au départ. Vérifiez les statuts et gardez
`current` privé tant que la restauration n’est pas validée.

Pour une première installation, le retour vise l’absence initiale des fichiers
appartenant à ce paquet après restauration HOME, pas une remise à zéro de la TV;
le bloc ci-dessus exige une ancienne installation sauvegardée et ne convient pas.
`tvwebctl rollback` utilise `.previous` créé par l’**updater** : ne le présentez pas
comme un backup garanti de `deploy.sh`. Conservez l’archive manuelle jusqu’à ce que
le résultat, puis un démarrage, soient vérifiés.

## 10. Ce que vous pouvez partager

Code Glasshouse : MIT; polices : SIL OFL; logo Immich : SVG original accompagné de
sa licence AGPL-3.0 et de sa notice. Conservez ces fichiers et attributions lors
d’une redistribution. Les marques et leurs conditions sont distinctes du droit
sur le code. Les logos privés des services TV ne sont pas livrés : le rendu public
utilise des alternatives typographiques et les icônes natives disponibles, donc
il n’est pas pixel pour pixel identique à une installation privée. Le dépôt ne
réattribue pas de licence globale nouvelle aux fonds déjà publiés.

Les sources précises sont dans [Provenance](PROVENANCE.md). Ne partagez pas les
fichiers de configuration remplis, archives, journaux, captures personnelles,
clés SSH, sessions de clients photo ou liens privés. Un scan de secrets est un
contrôle complémentaire, pas une garantie absolue. Une publication, un nouveau
root/accès, l’installation d’un client ou un changement de sécurité restent des
décisions séparées de la préparation de ce guide.
