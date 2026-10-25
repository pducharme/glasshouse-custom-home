# Sources et redistribution

La source Glasshouse importée est la version 0.118.0 de
[rorygallagher2024/glasshouse](https://github.com/rorygallagher2024/glasshouse/tree/859f5e134e0d9d4b499afe48084b9cdb82db9164),
commit `859f5e134e0d9d4b499afe48084b9cdb82db9164`. Sa licence MIT et son copyright
sont conservés dans `glasshouse/LICENSE`. Les fichiers `personalisation/base/`
proviennent du même commit; leur notice MIT est conservée dans ce dossier.

Les modifications de l'accueil C6 portent sur `home.html`, `home.js`, `routes.js`,
la météo, les assets de nuit, le déploiement et leurs tests. Le bundle de persistance
est reconstruit à partir de ces sources publiques. Il n'importe aucune sauvegarde
ni configuration d'une télévision. Lightkeeper, utilisé sur une seconde télé,
est un autre projet et n'est pas inclus.

Les polices Outfit et Manrope conservent leurs notices SIL Open Font License 1.1
sous `glasshouse/server/assets/fonts/`. Les dépendances de développement verrouillées
sont TypeScript 5.9.3 (Apache-2.0), @types/node 20.19.43 (MIT) et undici-types
6.21.0 (MIT). Aucun paquet npm n'est nécessaire au serveur en production.

Les cinq fonds JPEG étaient déjà publics, décrits comme générés par IA. Leur statut
n'est pas changé. Le fond nocturne embarqué est une copie de `05-lac-nuit.jpg`.
Aucune licence globale nouvelle n'est appliquée aux fonds ou au dépôt.

Les neuf logos personnalisés provenant des sites des marques ne sont pas
redistribués : aucune autorisation de redistribution n'était documentée. Les tuiles
conservent leur couleur, leur taille et leur nom, avec des libellés typographiques.
Sur une télévision, les icônes natives des applications installées sont utilisées
quand elles sont disponibles. Les marques restent celles de leurs propriétaires.
Il ne s'agit donc pas d'une reproduction pixel pour pixel des logos privés.

Le lanceur Photos emploie le [logo officiel Immich](https://github.com/immich-app/immich/blob/256eb55dbe92ac77e02794442f9487e88ffed2b1/design/immich-logo.svg),
commit `256eb55dbe92ac77e02794442f9487e88ffed2b1`, SHA-256
`dfa5ef704d07854914306c0c224173bda2710f8fc0dffeb7d78690f58f9811a6`.
Le SVG inchangé constitue un asset distinct sous AGPL-3.0, accompagné de la licence
complète et d'une notice dans `glasshouse/server/assets/third-party/immich/`.
Ces trois fichiers sont aussi inclus dans la persistance et l'assemblage du paquet;
la licence MIT du code Glasshouse ne s'applique pas à cette illustration.
Immich et son logo sont des marques de FUTO; leur présence identifie seulement
le lanceur facultatif et n'implique aucune affiliation ou approbation.
Le logo officiel transparent reste prioritaire sur l'icône native du client
configuré pour conserver la même tuile sur l'appareil. Aucun code de client
Immich n'est redistribué. Les identifiants vérifiés et les conditions de
marque sont documentés dans [Photos](PHOTOS.md). La référence visuelle de l'effet
de verre est consultée localement et n'est pas incluse dans le dépôt.

La météo réelle optionnelle utilise [Open-Meteo](https://open-meteo.com/en/licence),
données sous CC BY 4.0 et conditions du service applicables; le widget fournit le crédit.
La démo utilise exclusivement des données synthétiques.

Les captures de documentation upstream, ses workflows de publication et de mesure
du trafic, et les scripts locaux hors source n'ont pas été importés. Certains liens
illustratifs des documents upstream renvoient donc à leur dépôt d'origine. Le guide
public de ce dépôt est `README.md`.
