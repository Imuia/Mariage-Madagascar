# Mariage Madagascar - BLOG IMAGES V5
# Windows PowerShell 5.1 compatible.
# IMPORTANT: this file contains ASCII only to avoid encoding/parser errors.

$ErrorActionPreference = "Continue"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$OutRoot = Join-Path $Root "assets\img\blog"
$ManifestPath = Join-Path $Root "blog_images_officiel_manifest.csv"
$SqlPath = Join-Path $Root "04_blog_posts_local_images.sql"

New-Item -ItemType Directory -Path $OutRoot -Force | Out-Null

Write-Host ""
Write-Host "==============================================="
Write-Host " MARIAGE MADAGASCAR - BLOG IMAGES V5"
Write-Host " SOURCE : SITE OFFICIEL"
Write-Host "==============================================="
Write-Host ""

# Find the WordPress XML in the project.
$xmlFile = Get-ChildItem -Path $Root -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "mediumaquamarine*.xml" } |
    Select-Object -First 1

if ($null -eq $xmlFile) {
    Write-Host "ERREUR : fichier XML WordPress introuvable." -ForegroundColor Red
    Write-Host "Place le fichier XML dans ce dossier."
    Read-Host "Appuie sur Entree pour fermer"
    exit 1
}

Write-Host ("XML trouve : " + $xmlFile.FullName)
Write-Host ""

# Extract published posts from the XML using regex.
$xmlText = [System.IO.File]::ReadAllText($xmlFile.FullName, [System.Text.Encoding]::UTF8)
$itemMatches = [regex]::Matches(
    $xmlText,
    '<item\b[\s\S]*?</item>',
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
)

$posts = New-Object System.Collections.Generic.List[object]
$seenSlugs = New-Object 'System.Collections.Generic.HashSet[string]'

foreach ($itemMatch in $itemMatches) {
    $item = $itemMatch.Value

    if ($item -notmatch '<wp:post_type><!\[CDATA\[post\]\]></wp:post_type>') {
        continue
    }

    if ($item -notmatch '<wp:status><!\[CDATA\[publish\]\]></wp:status>') {
        continue
    }

    $slugMatch = [regex]::Match(
        $item,
        '<wp:post_name><!\[CDATA\[(.*?)\]\]></wp:post_name>',
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    if (-not $slugMatch.Success) {
        continue
    }

    $slug = $slugMatch.Groups[1].Value.Trim()

    if (-not $seenSlugs.Add($slug)) {
        continue
    }

    $titleMatch = [regex]::Match(
        $item,
        '<title><!\[CDATA\[(.*?)\]\]></title>',
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    $idMatch = [regex]::Match(
        $item,
        '<wp:post_id>(.*?)</wp:post_id>',
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    $title = if ($titleMatch.Success) { $titleMatch.Groups[1].Value.Trim() } else { $slug }
    $wpId = if ($idMatch.Success) { $idMatch.Groups[1].Value.Trim() } else { "" }

    $posts.Add([pscustomobject]@{
        Title = $title
        Slug = $slug
        WpId = $wpId
    })
}

Write-Host ("Articles publies trouves : " + $posts.Count)
Write-Host ""

if ($posts.Count -eq 0) {
    Write-Host "ERREUR : aucun article publie trouve." -ForegroundColor Red
    Read-Host "Appuie sur Entree pour fermer"
    exit 1
}

$headers = @{
    "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154 Safari/537.36"
    "Accept" = "text/html,application/xhtml+xml,image/*,*/*;q=0.8"
}

function Get-OfficialCandidates {
    param([string]$Slug)

    $s = $Slug.Trim("/")

    $list = New-Object System.Collections.Generic.List[string]
    [void]$list.Add("https://www.mariage-madagascar.com/$s/")
    [void]$list.Add("https://www.mariage-madagascar.com/$s-")
    [void]$list.Add("https://www.mariage-madagascar.com/-$s-")
    [void]$list.Add("https://www.mariage-madagascar.com/en/$s/")
    [void]$list.Add("https://www.mariage-madagascar.com/en/$s-")
    [void]$list.Add("https://www.mariage-madagascar.com/en/-$s-")

    return @($list)
}

function Get-AbsoluteUrl {
    param(
        [string]$BaseUrl,
        [string]$Value
    )

    try {
        $v = [System.Net.WebUtility]::HtmlDecode($Value.Trim())

        if ($v.StartsWith("//")) {
            $v = "https:" + $v
        }

        $baseUri = New-Object System.Uri($BaseUrl)
        $uri = New-Object System.Uri($baseUri, $v)

        return $uri.AbsoluteUri
    }
    catch {
        return $null
    }
}

function Get-ImageUrlsFromPage {
    param(
        [string]$Html,
        [string]$PageUrl
    )

    $found = New-Object System.Collections.Generic.List[string]

    $metaPatterns = @(
        '<meta[^>]+property=["'']og:image["''][^>]+content=["'']([^"'']+)["'']',
        '<meta[^>]+content=["'']([^"'']+)["''][^>]+property=["'']og:image["'']',
        '<meta[^>]+name=["'']twitter:image["''][^>]+content=["'']([^"'']+)["'']'
    )

    foreach ($pattern in $metaPatterns) {
        foreach ($m in [regex]::Matches($Html, $pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
            $u = Get-AbsoluteUrl -BaseUrl $PageUrl -Value $m.Groups[1].Value
            if ($null -ne $u) {
                [void]$found.Add($u)
            }
        }
    }

    $imgPattern = '<img\b[^>]*?(?:src|data-src)=["'']([^"'']+)["'']'

    foreach ($m in [regex]::Matches($Html, $imgPattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        $u = Get-AbsoluteUrl -BaseUrl $PageUrl -Value $m.Groups[1].Value
        if ($null -ne $u) {
            [void]$found.Add($u)
        }
    }

    $result = New-Object System.Collections.Generic.List[string]
    $seen = New-Object 'System.Collections.Generic.HashSet[string]'

    foreach ($u in $found) {
        $low = $u.ToLowerInvariant()

        if ($low -match "favicon|logo|icon|sprite|avatar|googleusercontent") {
            continue
        }

        if ($low -notmatch "\.(jpg|jpeg|png|webp|gif|avif|svg)(\?|$)") {
            continue
        }

        if ($seen.Add($u)) {
            [void]$result.Add($u)
        }
    }

    return @($result)
}

function Get-Extension {
    param([string]$Url)

    try {
        $path = ([System.Uri]$Url).AbsolutePath.ToLowerInvariant()

        if ($path.EndsWith(".jpeg")) { return ".jpg" }
        if ($path.EndsWith(".jpg")) { return ".jpg" }
        if ($path.EndsWith(".png")) { return ".png" }
        if ($path.EndsWith(".webp")) { return ".webp" }
        if ($path.EndsWith(".gif")) { return ".gif" }
        if ($path.EndsWith(".avif")) { return ".avif" }
        if ($path.EndsWith(".svg")) { return ".svg" }
    }
    catch {
    }

    return ".jpg"
}

$manifest = New-Object System.Collections.Generic.List[object]
$sqlLines = New-Object System.Collections.Generic.List[string]

$sqlLines.Add("-- Mariage Madagascar - images locales du blog")
$sqlLines.Add("-- Source : https://www.mariage-madagascar.com/")
$sqlLines.Add("")

$totalDownloaded = 0
$totalFailed = 0
$postIndex = 0

foreach ($post in $posts) {
    $postIndex++

    Write-Host ("[" + $postIndex + "/" + $posts.Count + "] " + $post.Title) -ForegroundColor Cyan

    $officialPage = ""
    $pageHtml = $null

    foreach ($candidate in (Get-OfficialCandidates -Slug $post.Slug)) {
        try {
            $response = Invoke-WebRequest `
                -Uri $candidate `
                -Headers $headers `
                -UseBasicParsing `
                -TimeoutSec 25

            if ($response.StatusCode -ge 200 -and
                $response.StatusCode -lt 400) {

                $pageHtml = $response.Content
                $officialPage = $response.BaseResponse.ResponseUri.AbsoluteUri
                break
            }
        }
        catch {
        }
    }

    if ($null -eq $pageHtml) {
        Write-Host "  PAGE OFFICIELLE INTROUVABLE" -ForegroundColor Yellow

        $manifest.Add([pscustomobject]@{
            wp_id = $post.WpId
            title = $post.Title
            slug = $post.Slug
            official_page = ""
            images_downloaded = 0
            local_images = ""
            status = "official_page_not_found"
        })

        continue
    }

    $imageUrls = @(Get-ImageUrlsFromPage -Html $pageHtml -PageUrl $officialPage)

    if ($imageUrls.Count -eq 0) {
        Write-Host "  AUCUNE IMAGE TROUVEE" -ForegroundColor Yellow

        $manifest.Add([pscustomobject]@{
            wp_id = $post.WpId
            title = $post.Title
            slug = $post.Slug
            official_page = $officialPage
            images_downloaded = 0
            local_images = ""
            status = "no_images_found"
        })

        continue
    }

    $postDir = Join-Path $OutRoot $post.Slug
    New-Item -ItemType Directory -Path $postDir -Force | Out-Null

    $localImages = New-Object System.Collections.Generic.List[string]
    $imageNumber = 0

    foreach ($imageUrl in $imageUrls) {
        $imageNumber++
        $extension = Get-Extension -Url $imageUrl
        $target = Join-Path $postDir ("{0:D2}{1}" -f $imageNumber, $extension)

        try {
            Invoke-WebRequest `
                -Uri $imageUrl `
                -Headers $headers `
                -UseBasicParsing `
                -TimeoutSec 40 `
                -OutFile $target

            if ((Get-Item -LiteralPath $target).Length -le 0) {
                throw "fichier vide"
            }

            $relative = $target.Substring($Root.Length).TrimStart("\") -replace "\\","/"
            $localUrl = "/" + $relative

            [void]$localImages.Add($localUrl)
            $totalDownloaded++

            Write-Host ("  OK " + $localUrl) -ForegroundColor Green
        }
        catch {
            $totalFailed++
            if (Test-Path -LiteralPath $target) {
                Remove-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue
            }
            Write-Host ("  ECHEC " + $imageUrl) -ForegroundColor Yellow
        }
    }

    $localFirst = if ($localImages.Count -gt 0) { $localImages[0] } else { "" }

    $manifest.Add([pscustomobject]@{
        wp_id = $post.WpId
        title = $post.Title
        slug = $post.Slug
        official_page = $officialPage
        images_downloaded = $localImages.Count
        local_images = ($localImages -join " | ")
        status = if ($localImages.Count -gt 0) { "downloaded" } else { "download_failed" }
    })

    if ($localImages.Count -gt 0) {
        $featured = $localFirst.Replace("'","''")
        $titleSql = $post.Title.Replace("'","''")

        $sqlLines.Add(
            "update public.blog_posts set featured_image_url='$featured', updated_at=now() where legacy_wp_id=$($post.WpId);"
        )

        $sqlLines.Add(
            "delete from public.blog_post_images where blog_post_id in (select id from public.blog_posts where legacy_wp_id=$($post.WpId));"
        )

        for ($j = 0; $j -lt $localImages.Count; $j++) {
            $localSql = $localImages[$j].Replace("'","''")
            $isFeatured = if ($j -eq 0) { "true" } else { "false" }

            $sqlLines.Add(
                "insert into public.blog_post_images (blog_post_id,image_url,alt_text,sort_order,is_featured) select id,'$localSql','$titleSql',$j,$isFeatured from public.blog_posts where legacy_wp_id=$($post.WpId);"
            )
        }
    }

    Write-Host ""
}

$manifest | Export-Csv -LiteralPath $ManifestPath -NoTypeInformation -Encoding UTF8 -Delimiter ";"

$sqlLines.Add("")
$sqlLines.Add("-- Controle final")
$sqlLines.Add("select count(*) as posts_with_local_images from public.blog_posts where featured_image_url like '/assets/img/blog/%' or content like '%/assets/img/blog/%';")

$sqlLines | Set-Content -LiteralPath $SqlPath -Encoding UTF8

Write-Host "==============================================="
Write-Host " TERMINE"
Write-Host "==============================================="
Write-Host ("Articles traites    : " + $posts.Count)
Write-Host ("Images telechargees : " + $totalDownloaded) -ForegroundColor Green
Write-Host ("Images en echec     : " + $totalFailed) -ForegroundColor Yellow
Write-Host ""
Write-Host ("Dossier : " + $OutRoot)
Write-Host ("Manifest: " + $ManifestPath)
Write-Host ("SQL     : " + $SqlPath)
Write-Host ""

Read-Host "Appuie sur Entree pour fermer"
