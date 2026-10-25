# Validation du paquet public

`sh scripts/validate.sh` exécute les tests du serveur et de l'interface, les tests
spécifiques de démo et de configuration météo, les tests d'application/guard, le
contrôle TypeScript sans émission, les contrôles ES5, modules, identifiants DOM,
traductions, QML, fichiers déployés et entités. Il assemble également le contenu
installable à partir de la même liste de fichiers que le script de déploiement.
Le runner limite les processus de test à deux par défaut (`TEST_CONCURRENCY`, maximum
quatre). Les changements d'interface doivent régénérer les patches avant validation.

Le serveur JavaScript n'a pas d'étape de transpilation. Le staging est testé sans
installer de paquet sur une télé; la création du conteneur IPK avec l'outil LG et
la vérification Homebrew Channel sur matériel restent des validations distinctes.
Le déploiement SSH direct documenté utilise les sources incluses.

Les vérifications upstream `check-upgrade.js` et `check-entity-stability.py` exigent
l'historique et les tags du dépôt upstream. Ils sont conservés pour référence mais
ne s'appliquent pas directement à ce dépôt imbriqué de sources. Les tests de
persistance utilisent trois bases upstream épinglées et incluses, donc n'exigent
aucune copie privée ou historique externe.

## Contrôles de publication

Les vérifications couvrent l'arbre de travail, les fichiers générés, l'index et
l'historique candidat. Gitleaks 8.30.1 est utilisé avec masquage intégral des valeurs
et sans tolérer les commentaires d'exclusion. La CI épingle son archive par SHA-256.
Les recherches complémentaires vérifient les chemins privés, configurations,
identifiants d'appareils, emplacements, clés, archives, sauvegardes et journaux.
Les notices MIT et OFL restent présentes; les neuf logos personnalisés privés
ne sont pas redistribués. Le logo officiel Immich conserve séparément son SVG
source intact, sa licence AGPL-3.0 et sa notice; la démo, le paquet et la
persistance vérifient que ces trois fichiers sont présents. Les sept fixtures
réseau upstream utilisent « Demo Wi-Fi ».

Ces contrôles ne garantissent pas l'absence absolue de secret ou de vulnérabilité.
Tout secret confirmé dans l'historique public impose l'arrêt de la publication
concernée et un traitement séparément autorisé; la rotation et la réécriture de
l'historique ne font pas partie de ce paquet.

## Fidélité et limites

L'inspection locale utilise la véritable page `home.html`, les cinq fonds publics,
les modes jour/nuit et les données synthétiques. Le focus clavier, l'appui long,
le déplacement et la conservation de l'ordre après rechargement sont vérifiables
sans accès à une télévision. Les tuiles gardent le format C6 (applications
280 × 157,5; consoles 224 × 126) dans le canevas 1920 × 1080.

Les différences assumées sont les neuf logos privés remplacés, la ville et la météo de démo,
les lancements simulés et l'absence de données personnelles. La page dépend de la
résolution et du moteur webOS de l'appareil. La version publique assainie n'a pas
été substituée aux réglages de la télévision personnelle. Le 25 octobre 2026,
le delta d'interface a été appliqué séparément à une C6 avec sauvegarde vérifiée,
conservation des réglages et fonds, et contrôle des empreintes. Les captures de
l'écran réel ont confirmé Photos, la sélection verre et le tiroir Toutes les apps.
Les commandes de télécommande existantes ont validé les flèches, OK, Retour/Haut,
le retour du focus au carrousel, le lancement de YouTube et le retour à l'accueil.
Le guard est resté `current`. Ces preuves privées ne sont pas incluses dans ce dépôt.
La correction du logo officiel a ses tests locaux de source, de démo hors ligne
et de paquet. Son rendu à 112 × 112 pixels et son focus verre ont également été
observés sur la C6, avec contrôle de l'identité du SVG et des empreintes déployées.
Le lanceur Photos est resté non configuré; aucun client ni photothèque n'a été ouvert.

La lecture vidéo, les gestes sur une télécommande physique, son pointeur, un
redémarrage complet de la télévision et les futures mises à jour restent à
vérifier. La PR reste brouillon pour revue; aucune fusion automatique n'est prévue.

L'extension Photos et Toutes les apps ajoute des tests de navigation aux quatre
flèches, activation, fermeture et restauration du focus, ainsi que des tests du
lanceur : identifiant vide/invalide, application absente, refus de lancement et
conservation du réglage. Les cibles et paramètres envoyés par le navigateur ne
peuvent pas remplacer le client photo configuré. La démo vérifie l'accès aux apps
fictives masquées du carrousel, sans connexion à une photothèque. Aucun test local
ne prouve la compatibilité du client Immich ni le rendu exact sur la télévision.
