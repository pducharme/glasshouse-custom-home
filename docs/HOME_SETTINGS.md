# Paramètres et Recommandations

L’engrenage discret à droite de **Toutes les apps** ouvre les paramètres de Home.
Il garde une cible de sélection suffisante pour le pointeur et un focus visible.
Depuis Toutes les apps, Droite rejoint l’engrenage; OK ouvre le panneau. Les
flèches et Tab parcourent ses contrôles. Retour/Echap ou **Fermer** referme le
panneau et restitue le focus. Les tuiles derrière le panneau ne s’activent pas.

## Recommandations

Le toggle reprend `home.json.recommended`, sans écrire les favoris, l’ordre,
Photos ou les autres préférences. Une sauvegarde non confirmée affiche une erreur
et relit l’état du serveur; elle n’est pas répétée automatiquement. La page
respecte le choix existant. L’exemple public et la démo démarrent désactivés.

La fonction native, ajoutée dans Glasshouse 0.129 et présente en 0.130, lit les
cartes que les apps publient pour LG Home. Ce sont des **contenus proposés par les
apps**, pas une liste garantie de reprises ou de contenus personnalisés. Aucun
pourcentage d’avancement ni position de lecture n’est inventé. Les affiches sont
chargées depuis les serveurs des apps lorsque les cartes sont ouvertes; elles ne
sont pas redistribuées dans le dépôt. Aucun compte ou jeton supplémentaire n’est
demandé par ce module.

Sous Applications, l’accordéon reste replié jusqu’à Bas ou un clic. Il affiche
uniquement les cartes dont l’identifiant d’app correspond à la sélection actuelle,
avec la source indiquée. Une app sans carte ne reçoit jamais les recommandations
d’une autre, même après une réponse réseau tardive. Aucun message d’absence
n’encombre Home; l’emplacement replié conserve sa hauteur pour éviter de déplacer
le carrousel. Haut, Retour, la sortie de la rangée ou le retour à Home replient
les cartes. Gauche/Droite parcourent la liste ouverte; OK utilise le lancement
natif de l’app vers le titre publié. L’app décide de ce qu’elle ouvre réellement.

Netflix, Prime Video, Disney+, HBO Max et YouTube sont documentés par l’amont sur
webOS 10. La disponibilité varie selon la TV, la région, le profil et l’app.
Plex, Bell, ICI TOU.TV ou Crave installés ne prouvent pas qu’ils publient des cartes.
Le module garde au maximum douze cartes par app et relit le catalogue notamment
au retour à Home et périodiquement; ce n’est pas un suivi de lecture en temps réel.
Sur certaines versions webOS, aucune carte n’est fournie.

Sources : [release 0.129](https://github.com/rorygallagher2024/glasshouse/releases/tag/v0.129.0),
[module 0.130](https://github.com/rorygallagher2024/glasshouse/blob/v0.130.0/server/lib/home-recommended.js),
[documentation Home](https://github.com/rorygallagher2024/glasshouse/blob/v0.130.0/docs/dashboard/home.md).

## Bouton G — ouvrir Glasshouse

Le G officiel, à droite de Fermer, lance l’application native de tableau de bord
`com.tvweb.dashboard` via le mécanisme existant de lancement d’apps. Il n’ouvre
pas une URL de navigateur et ne modifie aucun réglage. Son nom accessible est
**Ouvrir Glasshouse**. Les répétitions sont bloquées tant que le lancement est
en cours; un refus affiche une erreur utile.

Vérifiez cet identifiant dans le catalogue réel avant d’annoncer le raccourci
fonctionnel. Une installation avec `deploy.sh --no-app` n’installe pas cette app;
le bouton ne l’installe pas à sa place. Une installation explicitement choisie
avec `deploy.sh --app` et sa vérification sont décrites dans le
[guide manuel](MANUAL_GUIDE.md#6-installer-le-serveur-puis-activer-home-séparément).
La démo simule son lancement. Retour ne peut pas annuler un lancement natif déjà
envoyé.

Le logo vient de `assets/favicon.svg` de Glasshouse, sous la licence MIT conservée
dans le dépôt. Il est distinct du logo Immich sous AGPL-3.0. Aucun logo de service
privé, PIN, compte photo ou configuration personnelle n’est ajouté par ces réglages.
