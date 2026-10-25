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
Les notices MIT et OFL restent présentes; aucun logo personnalisé des marques
n'est redistribué. Les sept fixtures réseau upstream utilisent « Demo Wi-Fi ».

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

Les différences assumées sont les logos remplacés, la ville et la météo de démo,
les lancements simulés et l'absence de données personnelles. La page dépend de la
résolution et du moteur webOS de l'appareil. La version publique assainie n'a pas
été déployée sur la télévision personnelle; la lecture vidéo, la télécommande
physique, le redémarrage et les futures mises à jour ne sont donc pas certifiés
par les essais locaux. La PR reste brouillon jusqu'à revue et validation matérielle.

L'extension Photos et Toutes les apps ajoute des tests de navigation aux quatre
flèches, activation, fermeture et restauration du focus, ainsi que des tests du
lanceur : identifiant vide/invalide, application absente, refus de lancement et
conservation du réglage. Les cibles et paramètres envoyés par le navigateur ne
peuvent pas remplacer le client photo configuré. La démo vérifie l'accès aux apps
fictives masquées du carrousel, sans connexion à une photothèque. Aucun test local
ne prouve la compatibilité du client Immich ni le rendu exact sur la télévision.
