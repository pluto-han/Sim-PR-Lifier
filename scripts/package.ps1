$ErrorActionPreference = "Stop"

$repoDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $repoDir

$manifest = Get-Content -Raw "manifest.json" | ConvertFrom-Json
$version = $manifest.version
$buildDir = "dist/build"

if (Test-Path $buildDir) { Remove-Item -Recurse -Force $buildDir }
New-Item -ItemType Directory -Force -Path "$buildDir/chrome", "$buildDir/firefox" | Out-Null

Copy-Item -Recurse "manifest.json", "src" "$buildDir/chrome"
Copy-Item -Recurse "manifest.json", "src" "$buildDir/firefox"
node "scripts/prep-manifest.js" "$buildDir/firefox/manifest.json"

$chromeZip = "dist/simprler-$version-chrome.zip"
$firefoxZip = "dist/simprler-$version-firefox.zip"
if (Test-Path $chromeZip) { Remove-Item -Force $chromeZip }
if (Test-Path $firefoxZip) { Remove-Item -Force $firefoxZip }

Compress-Archive -Path "$buildDir/chrome/*" -DestinationPath $chromeZip
Compress-Archive -Path "$buildDir/firefox/*" -DestinationPath $firefoxZip

Write-Output "dist/simprler-$version-chrome.zip"
Write-Output "dist/simprler-$version-firefox.zip"