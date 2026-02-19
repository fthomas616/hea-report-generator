# ============================================================
# HEA TWA Fix & Rebuild Script
# Fixes package ID, restores keystore, updates fingerprint,
# cleans and rebuilds the APK
# ============================================================

$TWA_DIR = "C:\HEA_TWA"
$BACKUP_KEYSTORE = "C:\HEA_Offline_Tool\android.keystore.backup"
$KEYSTORE = "C:\HEA_TWA\android.keystore"
$MANIFEST = "C:\HEA_TWA\twa-manifest.json"
$CORRECT_PACKAGE = "com.hea.reportgenerator"
$CORRECT_FINGERPRINT = "E7:1A:79:3E:63:AD:B4:AB:B0:AE:BC:DC:63:4D:6D:25:44:37:E2:6B:B9:09:DB:0F:5A:00:14:E9:C8:23:7B:F6"
$KEYSTORE_ALIAS = "android"

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  HEA TWA Fix & Rebuild Script" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

# ── STEP 1: Restore keystore from backup ──────────────────
Write-Host "STEP 1 - Restoring keystore from backup..." -ForegroundColor Yellow

if (Test-Path $BACKUP_KEYSTORE) {
    Copy-Item $BACKUP_KEYSTORE $KEYSTORE -Force
    Write-Host "  ✅ Keystore restored from backup" -ForegroundColor Green
} elseif (Test-Path $KEYSTORE) {
    Write-Host "  ✅ Keystore already present, skipping restore" -ForegroundColor Green
} else {
    Write-Host "  ❌ ERROR: No keystore found at $BACKUP_KEYSTORE or $KEYSTORE" -ForegroundColor Red
    Write-Host "     Cannot continue without keystore. Exiting." -ForegroundColor Red
    exit 1
}

# ── STEP 2: Fix twa-manifest.json ─────────────────────────
Write-Host ""
Write-Host "STEP 2 - Fixing twa-manifest.json..." -ForegroundColor Yellow

if (-not (Test-Path $MANIFEST)) {
    Write-Host "  ❌ ERROR: twa-manifest.json not found at $MANIFEST" -ForegroundColor Red
    exit 1
}

$manifest = Get-Content $MANIFEST -Raw

# Fix package ID
$currentPackage = ($manifest | Select-String '"packageId":\s*"([^"]+)"').Matches.Groups[1].Value
if ($currentPackage -ne $CORRECT_PACKAGE) {
    $manifest = $manifest -replace '"packageId":\s*"[^"]+"', "`"packageId`": `"$CORRECT_PACKAGE`""
    Write-Host "  ✅ Package ID fixed: $currentPackage → $CORRECT_PACKAGE" -ForegroundColor Green
} else {
    Write-Host "  ✅ Package ID already correct: $CORRECT_PACKAGE" -ForegroundColor Green
}

# Fix startUrl
$manifest = $manifest -replace '"startUrl":\s*"/index.html"', '"startUrl": "/"'
Write-Host "  ✅ Start URL set to /" -ForegroundColor Green

# Fix fingerprint - replace empty array with correct fingerprint
$manifest = $manifest -replace '"fingerprints":\s*\[\s*\]', @"
"fingerprints": [
    {
      "name": "android",
      "value": "$CORRECT_FINGERPRINT"
    }
  ]
"@

Write-Host "  ✅ Fingerprint added to manifest" -ForegroundColor Green

# Save manifest
$manifest | Out-File $MANIFEST -Encoding UTF8
Write-Host "  ✅ twa-manifest.json saved" -ForegroundColor Green

# ── STEP 3: Verify keystore fingerprint ───────────────────
Write-Host ""
Write-Host "STEP 3 - Verifying keystore fingerprint..." -ForegroundColor Yellow

$keytoolOutput = & keytool -list -v -keystore $KEYSTORE -alias $KEYSTORE_ALIAS -storepass "HEASolutions2026" 2>&1
$sha256Match = $keytoolOutput | Select-String "SHA256:"
$sha256Line = if ($sha256Match) { $sha256Match.ToString().Trim() } else { "" }

if ($sha256Line -like "*$CORRECT_FINGERPRINT*") {
    Write-Host "  ✅ Keystore fingerprint matches assetlinks.json" -ForegroundColor Green
} else {
    Write-Host "  ❌ WARNING: Keystore fingerprint does NOT match!" -ForegroundColor Red
    Write-Host "     Found:    $sha256Line" -ForegroundColor Red
    Write-Host "     Expected: SHA256: $CORRECT_FINGERPRINT" -ForegroundColor Red
    Write-Host "     The app will show the URL bar. Check your keystore backup." -ForegroundColor Red
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne "y") { exit 1 }
}

# ── STEP 4: Clean old build artifacts ─────────────────────
Write-Host ""
Write-Host "STEP 4 - Cleaning old build artifacts..." -ForegroundColor Yellow

cd $TWA_DIR

if (Test-Path "app\build") {
    Remove-Item -Recurse -Force "app\build"
    Write-Host "  ✅ app\build deleted" -ForegroundColor Green
}
if (Test-Path "app-release-signed.apk") {
    Remove-Item "app-release-signed.apk"
    Write-Host "  ✅ app-release-signed.apk deleted" -ForegroundColor Green
}
if (Test-Path "app-release-bundle.aab") {
    Remove-Item "app-release-bundle.aab"
    Write-Host "  ✅ app-release-bundle.aab deleted" -ForegroundColor Green
}

# ── STEP 5: Build ─────────────────────────────────────────
Write-Host ""
Write-Host "STEP 5 - Building APK..." -ForegroundColor Yellow
Write-Host "  Enter your keystore password when prompted: HEASolutions2026" -ForegroundColor Cyan
Write-Host ""

bubblewrap build

# ── STEP 6: Verify output ─────────────────────────────────
Write-Host ""
if (Test-Path "app-release-signed.apk") {
    $apkSize = (Get-Item "app-release-signed.apk").Length / 1MB
    Write-Host "====================================================" -ForegroundColor Green
    Write-Host "  ✅ BUILD SUCCESSFUL!" -ForegroundColor Green
    Write-Host "  APK Size: $([math]::Round($apkSize, 2)) MB" -ForegroundColor Green
    Write-Host "  Location: $TWA_DIR\app-release-signed.apk" -ForegroundColor Green
    Write-Host "====================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Uninstall HEA Report from your phone" -ForegroundColor White
    Write-Host "  2. Transfer app-release-signed.apk via Bluetooth" -ForegroundColor White
    Write-Host "  3. Install on phone and test" -ForegroundColor White
} else {
    Write-Host "====================================================" -ForegroundColor Red
    Write-Host "  ❌ BUILD FAILED - No APK generated" -ForegroundColor Red
    Write-Host "  Check the error messages above" -ForegroundColor Red
    Write-Host "====================================================" -ForegroundColor Red
}
