# Validation du paquet public

Le contrôle reproductible de cette branche est :

```sh
npm ci --prefix glasshouse --ignore-scripts --no-audit --no-fund
TEST_CONCURRENCY=1 sh scripts/validate.sh
```

Il exécute les tests du serveur et de la démo, les tests de configuration météo,
d’application/guard, TypeScript sans émission, ES5, modules, identifiants DOM,
traductions, QML, fichiers déployés et entités, puis assemble le contenu installable.
Le runner limite les processus de test à deux par défaut (`TEST_CONCURRENCY`,
maximum quatre). Le serveur reste du JavaScript livré en source : il n’y a pas
de transpilation. Les patches doivent être régénérés avant validation.

L’assemblage local n’installe rien sur une TV. Le conteneur IPK et son installation
Homebrew Channel sur matériel sont des validations distinctes du déploiement SSH.
Les contrôles amont `check-upgrade.js` et `check-entity-stability.py` nécessitent
l’historique/tag upstream; ils ne s’appliquent pas directement à un sous-dossier
vendored. Les quatre bases de personnalisation 0.130 sont incluses pour tester
le bundle sans historique privé.

## Preuves de préparation C6 et limites

L’adaptation 0.130 dont cette branche reprend le code assaini a été vérifiée
localement avec **45 contrôles navigateur synthétiques, 11 suites backend et
39 cas de transaction/rollback**. Ces nombres décrivent cette préparation privée,
**pas** la CI finale de ce commit public. Les scripts opérationnels, sauvegardes,
rapports de scan privés et captures TV ne sont pas importés dans le dépôt. Le
résultat public à retenir est celui de `scripts/validate.sh` et de la CI du SHA
exact effectivement poussé; ni le résultat d’une autre branche ni un ancien
badge vert ne le remplacent.

Les contrôles de l’interface couvrent notamment :

- Bell vers une app native, Photos et son état non configuré, Toutes les apps,
  réorganisation, focus/Retour et mouvement réduit;
- Paramètres au pointeur et à la télécommande, confinement du focus, appui OK
maintenu, absence de lancement derrière le modal, fermeture et retour à l’engrenage;
- écriture limitée à `recommended`, réponse tardive antérieure à une sauvegarde,
  erreur de sauvegarde et relecture de l’état, sans confirmation optimiste;
- accordéon replié sans chargement d’affiche, attribution à l’app exacte, navigation
  horizontale et suppression des cartes d’une réponse YouTube tardive après passage
  à Plex, Bell, ICI TOU.TV ou Crave;
- stabilité verticale du dock lorsque l’app n’a pas de cartes ou que le réglage est
  OFF, séparation de la date et des rangées ouvertes, formats 1920×1080 et 1280×720;
- lancement du G par le mécanisme natif, erreurs et répétitions bloquées.

Sur la C6, la version réellement servie et les empreintes ont été contrôlées,
les réglages actuels et `.previous` préservés, puis le menu restauré sur 0.130
sans downgrade. Le propriétaire a confirmé le rendu, les paramètres, le toggle,
le filtrage des recommandations, la stabilité du dock et le bouton G ouvrant
Glasshouse. Le lancement natif de Glasshouse a aussi été vérifié par l’app au
premier plan. Ces essais n’ont pas remplacé la configuration personnelle par
l’exemple public.

News → Plex a été rétabli et vérifié dans les mappings enregistré/natif, sans
modifier les autres touches. Son appui physique avait été confirmé sur une version
antérieure; il n’a pas été retesté physiquement dans cette passe 0.130. Une lecture
complète de contenu recommandé, la qualité de reprise de chaque fournisseur,
le pointeur physique mesuré séparément, la veille et le reboot restent des tests
distincts. Aucun verrou PIN n’a été installé. La variante TV2 Lightkeeper n’est
pas incluse ni certifiée par ce résultat.

## Contrôles avant publication

Examiner l’arbre, les fichiers générés, l’index, le diff et l’historique candidat.
Gitleaks 8.30.1 est prévu avec masquage intégral et sans autoriser des commentaires
d’exclusion; son archive est épinglée par SHA-256 en CI. Compléter par la recherche
de configurations privées, chemins utilisateur, identités d’appareils, captures,
archives, sauvegardes, journaux et secrets. Un résultat sur les fichiers de
préparation privés ne constitue pas un résultat sur la branche publique finale.

Conserver les notices MIT et OFL, le G Glasshouse MIT et le SVG Immich original
avec sa licence AGPL-3.0 et sa notice. Les logos propriétaires privés et les images
de cartes des fournisseurs ne sont pas redistribués. Les fixtures publiques
utilisent des données synthétiques. La démo ne contacte aucune TV ni photothèque.

Ces contrôles réduisent le risque d’exposition; ils ne garantissent pas l’absence
absolue de secret ou de vulnérabilité. Si un secret publié est confirmé, arrêter
la publication concernée sans révéler sa valeur. Rotation, réécriture d’historique
et changements d’accès nécessitent une décision séparée.

## Fidélité publique

Applications conserve des faces de 280×157,5, consoles/Photos de 224×126 dans le
canevas 1920×1080 redimensionné. Le verre, les légendes masquées et les noms
accessibles sont conservés. Les neuf logos propriétaires privés sont remplacés
par des icônes natives disponibles ou des noms typographiques; les fonds sont
les cinq paysages publics. Météo, ordre de démo et lancements sont synthétiques.

Recommandations reflète ce que les apps publient à cet instant, sans garantie de
personnalisation, de reprise ou de progression. Les futures mises à jour peuvent
nécessiter une nouvelle adaptation. Vérifier [l’état de la branche](REPRODUCIBILITY.md)
avant d’attribuer ces fonctions à `main`.
