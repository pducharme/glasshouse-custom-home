# Photos, effet de verre et Toutes les apps

L'accueil comporte une petite section **Photos** à droite des consoles, avec un
bouton **Immich**. Elle ne crée pas de grande tuile dans le carrousel. Les consoles
et Photos partagent des faces de 224 × 126 et les mêmes arrondis; le fond commun
derrière les consoles est retiré. Les libellés sous les tuiles du carrousel, des
consoles et du tiroir sont masqués. Photos conserve son titre de section, sans
texte « Immich » ou « Prêt » sous la fleur. Les contrôles gardent leurs noms
accessibles et Photos son état accessible; les chaînes sans logo restent lisibles.
Le focus ajoute une
bordure lumineuse et un léger soulèvement. Avec le pointeur Magic Remote, le
reflet suit sa position dans la tuile et celle-ci s'incline légèrement. Un seul
rendu est programmé par frame, sans animation continue au repos. Le clavier, la
sortie de la tuile et l'ouverture d'un autre panneau rétablissent le focus fixe.
Les dégradés et contours fonctionnent sans flou d'arrière-plan; la préférence de
mouvement réduit conserve le focus visible et désactive reflet mobile et inclinaison.

Le chevron du bas ouvre **Toutes les apps**. Ce tiroir utilise le catalogue
d'applications fourni par Glasshouse, y compris celles masquées du carrousel.
Il ne désinstalle rien et ne modifie pas les favoris. Les services système sans
point de lancement, les favoris web et les entrées HDMI ne constituent pas une
liste exhaustive des paquets installés; les filtres de sécurité upstream restent
applicables. Les consoles et l'accès de secours à l'accueil LG restent disponibles.

## Navigation

- Depuis la dernière console, Droite rejoint Photos; Gauche revient aux consoles.
- Bas rejoint le chevron; OK ouvre le tiroir. Les flèches parcourent ses applications.
- OK lance l'application sélectionnée; l'appui long dans le tiroir ou sur Photos
  ne déclenche pas la réorganisation du carrousel.
- Retour/Echap ferme le tiroir et restaure le focus de l'accueil. Haut depuis la
  première ligne permet également de revenir. Un bouton Fermer est disponible.
- Le pointeur de la Magic Remote peut sélectionner les mêmes contrôles.
- Le bouton Photos explique son état lorsqu'il n'est pas configuré ou lorsque
  l'application choisie n'est pas disponible; aucun accès Immich n'est tenté.

Ces parcours sont testés avec la vraie page et des données synthétiques. Le
25 octobre 2026, les commandes existantes de télécommande sur une C6 ont aussi
permis de vérifier le focus Photos, son état non configuré, l'ouverture du tiroir,
le déplacement dans la grille, Retour/Haut et le retour au carrousel, puis le
lancement de YouTube et le retour à l'accueil. L'appui sur une télécommande
physique et le pointeur restent des essais distincts. La démo n'allume pas la télévision.

## Lanceur sans accès à la photothèque

La configuration du lanceur est un identifiant d'application, jamais une URL.
Le champ `photosAppId` de `home.json` vaut `""` par défaut, comme dans
`examples/home.example.json`. Le bouton affiche alors **Non configuré**.

Deux identifiants vérifiés sont acceptés :

| Client communautaire | Identifiant | Source examinée le 25 octobre 2026 |
| --- | --- | --- |
| immich-webOS, Aneesh Tigga | `com.immich.webos` | [Manifest 0.14.0](https://github.com/aneeshtigga/immich-webos/blob/e43ac58e9b6af6cffa6236c65cb77698bf9b2b42/public/appinfo.json) |
| Immich TV, Seeky91 | `com.seeky91.immichtv` | [Manifest 1.7.0](https://github.com/Seeky91/immich-tv-webos/blob/8187a502d35ef8efa5cdaf0abc60d81b3b88004a/webos-meta/appinfo.json) |

Le serveur vérifie que l'application configurée figure dans ses points de
lancement avant de l'ouvrir. Le client ne peut pas substituer une autre cible ou
des paramètres de lancement. Le **logo officiel Immich**, conservé sans
modification, reste prioritaire même si le client installé fournit une autre
icône. La fleur transparente apparaît seule dans une tuile sombre, sans carré
blanc ajouté. Le SVG est servi depuis ce dépôt, y compris dans la démo hors ligne :
son affichage ne contacte aucun serveur Immich. Aucun code client tiers ni
bibliothèque supplémentaire n'est embarqué.

Un choix ultérieur du client se fait dans le `home.json` privé existant, en
modifiant uniquement `photosAppId`, jamais en remplaçant tous les réglages par
l'exemple. Le réordonnancement et la remise à zéro des rangées préservent ce choix.
Ne configurer ce champ qu'après installation séparément autorisée du client choisi.
La démo reste sans compte ni application Immich réelle.

## Possibilités et limites des clients

Ces deux projets sont indépendants d'Immich. Le client Aneesh annonce webOS 5 ou
plus récent. Le client Seeky annonce webOS 4 dans sa version 1.7, tandis que sa
fiche Homebrew indique encore webOS 5; le test webOS 4 publié concerne un moteur
Chromium, pas une télévision physique. Leur compatibilité avec une télévision
donnée n'est donc pas établie par leurs seuls manifests.
Sources : [Aneesh](https://github.com/aneeshtigga/immich-webos),
[release Seeky 1.7](https://github.com/Seeky91/immich-tv-webos/releases/tag/v1.7.0),
[catalogue Aneesh](https://repo.webosbrew.org/apps/com.immich.webos/),
[catalogue Seeky](https://repo.webosbrew.org/apps/com.seeky91.immichtv/).

Ils proposent photos, vidéos, timeline, albums et diaporama. Glasshouse ne fait
qu'ouvrir l'application : aucun contrat vérifié de lancement direct vers un album
n'est utilisé. Le choix de contenu reste dans le client photo.

Les clients documentent une connexion email/mot de passe ou clé API, avec saisie
sur téléphone par QR local. Même si le mot de passe n'est pas conservé, les jetons
ou clés API et l'adresse du serveur persistent dans leur stockage local.
Le QR ne prouve pas une prise en charge native d'OIDC : Immich propose
[OIDC](https://docs.immich.app/administration/oauth/), mais cela ne garantit pas
son fonctionnement dans ces clients.
Sources : [stockage Aneesh](https://github.com/aneeshtigga/immich-webos/blob/e43ac58e9b6af6cffa6236c65cb77698bf9b2b42/src/auth/store.ts),
[stockage Seeky](https://github.com/Seeky91/immich-tv-webos/blob/8187a502d35ef8efa5cdaf0abc60d81b3b88004a/src/utils/accountsStore.ts).

Les permissions de clé API limitent des opérations; elles ne garantissent pas
que la clé soit restreinte à un seul album. Avant une activation réelle, choisir
le client puis le périmètre de contenu : compte complet ou albums explicitement
partagés avec un utilisateur lecteur. Aucun compte, partage ni jeton n'est créé
par ce dépôt. Les liens de partage et toutes les données d'authentification restent
hors Git. Voir le [partage officiel Immich](https://docs.immich.app/features/sharing/).

## Droits

Les deux clients ont une licence MIT ([Aneesh](https://github.com/aneeshtigga/immich-webos/blob/e43ac58e9b6af6cffa6236c65cb77698bf9b2b42/LICENSE),
[Seeky](https://github.com/Seeky91/immich-tv-webos/blob/8187a502d35ef8efa5cdaf0abc60d81b3b88004a/LICENSE)).
Le logo provient séparément du [dépôt officiel Immich](https://github.com/immich-app/immich/blob/256eb55dbe92ac77e02794442f9487e88ffed2b1/design/immich-logo.svg),
commit `256eb55dbe92ac77e02794442f9487e88ffed2b1`. Le SVG original, sa
[licence AGPL-3.0](../glasshouse/server/assets/third-party/immich/LICENSE-AGPL-3.0.txt)
et sa [notice de provenance](../glasshouse/server/assets/third-party/immich/NOTICE.txt)
sont conservés ensemble sous `glasshouse/server/assets/third-party/immich/` et
dans le bundle de persistance. Cette illustration n'est pas relicenciée sous MIT;
la licence du code Glasshouse reste inchangée. Sa source modifiable est le SVG
lui-même, copié à l'identique; conserver ces trois fichiers lors d'une redistribution.

Immich et son logo sont des marques de FUTO. Leur emploi identifie l'application
photo facultative, sans suggérer d'affiliation, d'approbation ou de service officiel.
La marque est traitée séparément dans la
[FAQ Immich](https://docs.immich.app/FAQ/#what-are-your-guidelines-for-resellers-and-trademark-usage).
Le lanceur ne réutilise pas le code des clients.
