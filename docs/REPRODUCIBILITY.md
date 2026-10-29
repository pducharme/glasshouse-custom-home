# Ce qui est réellement reproductible

Cette livraison contient le Home personnalisé basé sur **Glasshouse 0.130.0**, commit
amont `1543769cfeb28c3ce0936dc6d20b24cd58c70255`. Le README principal et les guides
visent `main`; relevez toujours son SHA et sa CI. Les tableaux historiques ci-dessous
décrivent les contrôles antérieurs, pas l’état courant de la branche.

## État public lors de l’audit initial

| Source lors de l’audit | Révision vérifiée | Contenu à cette révision |
| --- | --- | --- |
| [Ancien `main`](https://github.com/pducharme/glasshouse-wallpapers/tree/9366c6bb9a1dcdbf8421d3f9de4dc178076e7491) | `9366c6bb9a1dcdbf8421d3f9de4dc178076e7491` | Cinq JPEG et un README de fonds. Aucun serveur, démo, installateur ou guide complet d’interface. |
| [Code de l’interface audité](https://github.com/pducharme/glasshouse-wallpapers/tree/d2e3ebc843c827a7040aa08e69abc9b7c31a8abe) | `d2e3ebc843c827a7040aa08e69abc9b7c31a8abe` | Sources Glasshouse 0.118.0 adaptées, démo synthétique, configuration d’exemple, dépendances verrouillées, tests et bundle de personnalisation. |
| [PR nº1](https://github.com/pducharme/glasshouse-wallpapers/pull/1) | Même commit de code | Ouverte, en brouillon, **non fusionnée lors de ce contrôle initial**. Son contenu était public mais différent du clone ordinaire de `main`. |

Les deux branches ont été clonées séparément pour ce contrôle. Le clone par défaut
contenait six fichiers suivis; celui de la PR en contenait 384 au commit ci-dessus.
Les guides autonomes ont été ajoutés après le commit `d2e3ebc` puis fusionnés par
la PR nº1 : revenir à ce SHA les retire du checkout. Pour connaître la livraison
actuelle, vérifiez le SHA distant de `main`, la version incluse et la présence de
`glasshouse/package.json`, `docs/MANUAL_GUIDE.md` et `docs/AI_PROMPTS.md` dans cette
référence. Une publication ou une fusion doit être confirmée par GitHub, pas déduite
de ce tableau historique.

Le code de la PR a une [CI réussie sur cette révision](https://github.com/pducharme/glasshouse-wallpapers/actions/runs/40212645485).
Cela vérifie le code et ses fixtures, pas une nouvelle télévision. Consulter la
branche, le SHA et la CI présents aujourd’hui avant de suivre un lien mobile `main`
ou un nom de branche.

## Sans Codex : oui pour la démo, sous conditions pour une TV

La démo ne dépend d’aucun agent : Git et Node.js 22+ suffisent. Les commandes du
[README](../README.md#démo-locale--local-demo) utilisent `main`.
Elles n’accèdent à aucun appareil. Les développeurs peuvent
reconstruire et tester le paquet avec npm, Python 3, `diff` et `patch`.

L’installation TV demande davantage : cible compatible déjà rootée, accès de
maintenance personnel fonctionnel, sauvegardes privées et vérification de la
configuration. Le [guide manuel](MANUAL_GUIDE.md) fournit ce parcours. Il ne crée
pas un root ni un nouvel accès. Le profil HDMI du code doit aussi correspondre à
vos appareils; ce n’est pas un installateur universel qui découvre vos consoles.

Un assistant muni des [prompts fournis](AI_PROMPTS.md) peut aider à vérifier et
adapter les sources. Il ne donne pas des permissions supplémentaires, ne résout
pas une incompatibilité de plateforme par une simple confirmation et ne doit pas
annoncer une installation qu’il n’a pas vérifiée.

## Compatibilité : serveur, Home et personnalisation sont distincts

| Environnement | Ce que permet cette livraison |
| --- | --- |
| Ordinateur avec Node.js 22+ | Démo hors ligne et tests. Aucun accès root, compte LG ou TV nécessaire. |
| LG avec Developer Mode uniquement | Ce mode permet le développement/déploiement d’apps dans son environnement; il n’accorde pas les droits root requis par ce serveur, ses hooks et le remplacement de HOME. Ce guide s’arrête avant le déploiement système. |
| TV déjà rootée, webOS 9 | Home accepté par le code. Le moteur, les entrées et les commandes doivent encore être vérifiés sur le modèle réel. |
| TV déjà rootée, webOS 7 ou 10 | Home proposé avec statut expérimental dans la base 0.130. |
| TV déjà rootée, webOS 11 | Home proposé seulement avec `allowExperimentalHome: true`. Le profil adapté a été utilisé sur une C6; cela ne certifie pas tous les modèles webOS 11. |
| webOS 5 / Node système 8, notamment UN7300 | Le serveur upstream peut avoir des compatibilités distinctes, mais **Home public est refusé par cette version**. Le bundle de personnalisation exige `fs.rmSync` (Node 14.14+). La variante Lightkeeper observée sur ce matériel n’est pas livrée ici. |

Les règles effectives de Home sont dans [`supported()`](../glasshouse/server/lib/home.js),
et les prérequis de persistance dans [son guide](../personalisation/README.md).
Ne déduire la version webOS ni du nom commercial ni de la version du firmware.
Ne pas modifier le contrôle de compatibilité pour faire apparaître un bouton.
Le port 8080 reste celui des exemples et du tunnel documenté; la base 0.130 ne
porte plus l’ancien refus Home fondé uniquement sur un autre port. Vérifier la
configuration effective avant d’adapter les commandes.

## Comparaison du rendu et des fonctions

| Élément | Branche publique Glasshouse | Expérience sur les deux familles de TV |
| --- | --- | --- |
| Carrousel, verre au pointeur, focus clavier, mouvement réduit | Inclus. Démo à données fictives, canevas 1920×1080 redimensionné. | Adaptation C6 observée; effet aussi porté séparément à Lightkeeper. Performance prolongée et pointeur physique doivent être validés sur chaque cible. |
| Tuiles et légendes | Apps 280×157,5; consoles/Photos 224×126. Noms sous les tuiles masqués, noms accessibles conservés, titre Photos visible. | Apparence commune recherchée; les sources Lightkeeper ne sont pas dans ce dépôt. |
| Logos d’apps | Icônes natives disponibles sur la TV, sinon noms typographiques dans la face. Neuf logos privés ne sont pas redistribués. | Les écrans privés peuvent donc différer visuellement. Une fidélité pixel pour pixel n’est pas promise. |
| HDMI | Profil écrit dans le code : ports 1 et 3 dans Consoles; port 4 présenté comme Bell Fibe si `order.app` le sélectionne; port 2 filtré hors de cette rangée. | Ne représente pas automatiquement votre câblage. La TV avec Firestick seul utilise un port Lightkeeper séparé et ne doit recevoir aucune console inventée. Voir l’adaptation HDMI dans le guide. |
| Photos / Immich | Fleur officielle transparente. `photosAppId` vide par défaut, puis identifiant d’une app réellement installée. Glasshouse ne fournit pas le client, le compte ou le serveur photo. | Lancement confirmé dans les adaptations privées C6 et UN7300, avec mécanismes distincts; cela ne rend pas Lightkeeper disponible dans ce paquet. |
| Toutes les apps | Catalogue de points de lancement Glasshouse, hors favoris/masquage du carrousel; ce n’est pas une liste exhaustive de tous les services système. | Fonctionnel dans le parcours Glasshouse testé. Sur le port Lightkeeper webOS 5, le catalogue de son contexte app était inaccessible; aucun contournement n’est fourni ici. |
| Paramètres et G | Engrenage discret, toggle natif Recommandations, fermeture et lancement de `com.tvweb.dashboard` si cette app est installée. | Lancement natif et résultat visuel confirmés sur C6; aucun réglage privé copié dans le dépôt. |
| Recommandations | Accordéon par identifiant d’app exact, replié par défaut, sans repli vers un autre fournisseur. Espace réservé pour stabiliser le dock; aucune carte visible si l’app n’en fournit pas. | Catalogue disponible sur la C6 testée. Ce ne sont ni des reprises ni des résultats personnalisés garantis; la présence de Plex ou d’une autre app ne prouve pas qu’elle publie des cartes. |
| News → Plex | Support natif `haystack` si la TV webOS 11 expose cette entrée et si Plex est installé. Aucun mapping préconfiguré. | Appui physique vérifié sur C6. Aucun équivalent News établi sur l’UN7300; ne pas copier un code de touche entre modèles. |
| Fonds et météo | Cinq paysages synthétiques; rotation quotidienne et nuit 17 h–6 h. Météo fictive en démo, réelle désactivée par défaut. | Heure, fuseau, ville et coordonnées appartiennent à chaque utilisateur; les réglages privés ne sont pas fournis. |
| Démarrage / HOME | Le serveur et le gardien ont leurs hooks. Home doit ensuite être activé explicitement; retour vers LG et restauration séparés. | Un réveil, un démarrage à froid et une mise à jour sont des essais distincts. L’appui News qui allume la TV peut encore suivre LG avant la réapplication du mapping. |

Les différences de profil sont visibles dans [`items()` / `TILE.dev`](../glasshouse/server/assets/home.html)
et [`launchPoints()`](../glasshouse/server/lib/home.js). Modifier seulement un exemple
JSON ne change pas ces choix de présentation. Le guide indique les points à
adapter et les tests à relancer avant tout déploiement.
La tuile Applications Bell peut cibler l’app native vérifiée indépendamment de la
boîte Bell Fibe sur HDMI. Aucun mapping News/Plex ni client Photos n’est configuré
pour une autre TV par l’exemple. Aucun PIN personnalisé n’est inclus.

## Installation, accès de secours et restauration

`server/deploy.sh --no-app` n’est pas une prévisualisation : il transfère les
fichiers, installe par défaut le hook serveur et relance Glasshouse. L’option évite
seulement d’ajouter la tuile du tableau de bord. L’activation de Glasshouse Home
se fait séparément. Une configuration existante est conservée, mais cela ne vaut
pas sauvegarde de toute l’installation.

Le retour à LG Home, la restauration d’un mapping, l’arrêt du gardien et le retour
aux fichiers d’avant déploiement sont quatre opérations distinctes. Le
[guide manuel](MANUAL_GUIDE.md) fournit les étapes et les points de vérification.
En particulier, ne présumer ni qu’un export JSON du dashboard contient tous les
secrets et fichiers, ni que `tvwebctl rollback` dispose d’une version précédente
après un premier déploiement SSH. Garder les sauvegardes complètes hors Git.
En récupération après update, préserver `.previous` avant une nouvelle update
et adapter les personnalisations à la version réelle. Le cache mémoire des assets
impose de comparer aussi la page servie; une relance du seul service peut être
nécessaire pendant une fenêtre approuvée. Ne pas restaurer toute une ancienne
configuration pour réparer le menu.

## Licences et attributions

Le code Glasshouse est sous MIT; les polices Outfit/Manrope sous SIL OFL.
TypeScript est sous Apache-2.0, `@types/node` et `undici-types` sous MIT. Le SVG
Immich est un asset distinct sous AGPL-3.0 avec source intacte, licence et notice;
les marques ne sont pas transférées par ces licences. Les clients photo restent
des projets tiers installés séparément.

Aucune licence globale nouvelle n’a été attribuée aux cinq paysages générés ni
au dépôt entier. Ne pas déduire des notices MIT du serveur une permission globale
sur chaque image ou marque. L’attribution Open-Meteo est conservée lorsque la météo
réelle est activée; ses conditions s’appliquent séparément. Voir la
[provenance détaillée](PROVENANCE.md) et les [droits du lanceur Photos](PHOTOS.md#droits).

## Portée des preuves

Les tests de démo, types, ES5, configuration, navigation et persistance peuvent
être exécutés sans télévision. La validation depuis des clones propres est
séparée des preuves privées d’usage réel; les captures, adresses, identifiants
matériels, réglages, sauvegardes et journaux personnels ne sont pas redistribués.
Aucun test logiciel ne garantit l’absence absolue de secret, la compatibilité de
toutes les TV ou la survie à toute mise à jour. [Validation et limites](VALIDATION.md).
