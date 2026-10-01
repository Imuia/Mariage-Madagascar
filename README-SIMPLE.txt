# V5 - Recuperation images blog depuis le site officiel

Cette V5 corrige le probleme de parser vu dans PowerShell 5.1.

La V3/V4 utilisait des caracteres Unicode dans le fichier `.ps1` sans BOM.
Windows PowerShell 5.1 pouvait alors mal interpreter certaines lignes.
La V5 est volontairement en ASCII uniquement.

## Utilisation

1. Decompresse ce ZIP dans le dossier `Mariage-Madagascar`.
2. Mets dans ce meme dossier ton XML WordPress :
   `mediumaquamarine-wombat-472759hostingersitecom.WordPress.2026-10-01(1).xml`
3. Double-clique sur :
   `DEMARRER-RECUPERATION-IMAGES-V5.bat`

La fenetre restera ouverte a la fin.

## Resultat

Le script cree :

`assets/img/blog/`

`blog_images_officiel_manifest.csv`

`04_blog_posts_local_images.sql`

## Source

Les pages et images sont recherchees sur :

`https://www.mariage-madagascar.com/`

L'ancien serveur Hostinger n'est plus utilise comme source d'images.

## Important

Les images qui ne sont plus publiquement accessibles seront marquees `download_failed` dans le manifeste.
