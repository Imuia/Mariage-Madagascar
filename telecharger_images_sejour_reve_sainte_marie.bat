@echo off
setlocal
title Telechargement images - Sejour reve Sainte-Marie
set "DEST=assets\img\products\MM-SEJOUR-REVE-DEMANDE-MARIAGE-SAINTEMARIE"
if not exist "%DEST%" mkdir "%DEST%"
echo Telechargement des images du produit...

echo Image 1/9
curl.exe -L --fail --silent --show-error "https://cdn.zyrosite.com/cdn-cgi/image/format=auto,w=1024,h=769,fit=crop/cdn-ecommerce/store_01GP5043QBABN9G8NA9DTQ574E/assets/4c55c5ee-9eab-4aee-9884-70f11a897265.webp" -o "%DEST%\sejour-sainte-marie-01.webp"
if errorlevel 1 echo ERREUR image {i} - verifier le lien source.

echo Image 2/9
curl.exe -L --fail --silent --show-error "https://cdn.zyrosite.com/cdn-cgi/image/format=auto,w=1024,h=769,fit=crop/cdn-ecommerce/store_01GP5043QBABN9G8NA9DTQ574E/assets/83f57685-0941-462b-b077-f21376936ffb.jpeg" -o "%DEST%\sejour-sainte-marie-02.webp"
if errorlevel 1 echo ERREUR image {i} - verifier le lien source.

echo Image 3/9
curl.exe -L --fail --silent --show-error "https://cdn.zyrosite.com/cdn-cgi/image/format=auto,w=1024,h=769,fit=crop/cdn-ecommerce/store_01GP5043QBABN9G8NA9DTQ574E/assets/b6341637-8421-4c2d-9a5f-39bbaff2dc77.jpeg" -o "%DEST%\sejour-sainte-marie-03.webp"
if errorlevel 1 echo ERREUR image {i} - verifier le lien source.

echo Image 4/9
curl.exe -L --fail --silent --show-error "https://cdn.zyrosite.com/cdn-cgi/image/format=auto,w=1024,h=769,fit=crop/cdn-ecommerce/store_01GP5043QBABN9G8NA9DTQ574E/assets/7c69dbfb-0cea-4f2f-998c-c6db80be7f21.jpg" -o "%DEST%\sejour-sainte-marie-04.webp"
if errorlevel 1 echo ERREUR image {i} - verifier le lien source.

echo Image 5/9
curl.exe -L --fail --silent --show-error "https://cdn.zyrosite.com/cdn-cgi/image/format=auto,w=1024,h=769,fit=crop/cdn-ecommerce/store_01GP5043QBABN9G8NA9DTQ574E/assets/20085f96-1aee-490b-ad2f-448966055597.jpeg" -o "%DEST%\sejour-sainte-marie-05.webp"
if errorlevel 1 echo ERREUR image {i} - verifier le lien source.

echo Image 6/9
curl.exe -L --fail --silent --show-error "https://cdn.zyrosite.com/cdn-cgi/image/format=auto,w=1024,h=769,fit=crop/cdn-ecommerce/store_01GP5043QBABN9G8NA9DTQ574E/assets/713bb9b7-831e-4e3f-8932-34c775090ffd.webp" -o "%DEST%\sejour-sainte-marie-06.webp"
if errorlevel 1 echo ERREUR image {i} - verifier le lien source.

echo Image 7/9
curl.exe -L --fail --silent --show-error "https://cdn.zyrosite.com/cdn-cgi/image/format=auto,w=1024,h=769,fit=crop/cdn-ecommerce/store_01GP5043QBABN9G8NA9DTQ574E/assets/cb89c794-9cde-4930-8512-fad7ea153221.jpg" -o "%DEST%\sejour-sainte-marie-07.webp"
if errorlevel 1 echo ERREUR image {i} - verifier le lien source.

echo Image 8/9
curl.exe -L --fail --silent --show-error "https://cdn.zyrosite.com/cdn-cgi/image/format=auto,w=1024,h=769,fit=crop/cdn-ecommerce/store_01GP5043QBABN9G8NA9DTQ574E/assets/ea9084e5-ff1f-48f0-b103-5ba2ed7eb5dd.webp" -o "%DEST%\sejour-sainte-marie-08.webp"
if errorlevel 1 echo ERREUR image {i} - verifier le lien source.

echo Image 9/9
curl.exe -L --fail --silent --show-error "https://cdn.zyrosite.com/cdn-cgi/image/format=auto,w=1024,h=769,fit=crop/cdn-ecommerce/store_01GP5043QBABN9G8NA9DTQ574E/assets/7da06386-7dd9-446b-8016-94d256355f2c.jpeg" -o "%DEST%\sejour-sainte-marie-09.webp"
if errorlevel 1 echo ERREUR image {i} - verifier le lien source.

echo.
echo Termine. Verifiez les fichiers dans %DEST%.
pause
endlocal