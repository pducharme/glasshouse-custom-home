# Contribuer / Contributing

## Français

Commencez par la démo locale et les vérifications du [README](README.md#développement--development). Ouvrez une issue avec la version Glasshouse, le modèle, la version webOS, le SHA du checkout et des étapes reproductibles. N’incluez aucun secret, configuration réelle, journal non expurgé ou photo personnelle.

Gardez les corrections ciblées. Une modification du Home doit conserver les comportements clavier/télécommande, le mode réduit en mouvement et les variantes sans recommandations ni Photos configuré. Mettez à jour les tests pertinents; si le bundle change, régénérez-le avec `node personalisation/generate.js`, puis exécutez `sh scripts/validate.sh`. Documentez la compatibilité réellement testée et les limites. Une CI verte ne valide pas un autre appareil.

Préservez les licences et notices des ressources. Les nouveaux logos, images et dépendances nécessitent une provenance et des conditions de redistribution documentées. L’ajout d’une donnée privée dans un exemple n’est jamais nécessaire.

## English

Start with the local demo and the [README checks](README.md#développement--development). Report the Glasshouse version, TV model, webOS version, checkout SHA and reproducible steps. Do not include secrets, real configuration, unredacted logs or personal photos.

Keep changes focused. Home changes should preserve keyboard/remote navigation, reduced motion and the states with recommendations disabled or Photos unconfigured. Update relevant tests; when changing the bundle, regenerate it with `node personalisation/generate.js`, then run `sh scripts/validate.sh`. Document the compatibility actually tested and remaining limits. Green CI does not certify another device.

Preserve asset licenses and notices. New logos, images and dependencies need documented provenance and redistribution terms. Examples never need private data.
