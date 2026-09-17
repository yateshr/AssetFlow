# AssetFlow Executive / Management Reports installer
# Run this PowerShell script from the AssetFlow project root.
# It creates a backup of App.tsx before changing it.

$ErrorActionPreference = "Stop"

$appPath = Join-Path (Get-Location) "src\components\App.tsx"
$reportsPath = Join-Path (Get-Location) "src\components\ReportsPage.tsx"

if (-not (Test-Path $appPath)) {
  throw "Could not find src\components\App.tsx. Run this script from the AssetFlow project root."
}
if (-not (Test-Path $reportsPath)) {
  throw "Could not find src\components\ReportsPage.tsx. Copy the included ReportsPage.tsx there first."
}

$content = Get-Content $appPath -Raw

$old = 'case ''reports'':`r`n        return <ReportsPage />;'
$new = @'
case 'reports':
        return (
          <ReportsPage
            assetsList={assetsList}
            usersList={usersList}
            assignmentsList={assignmentsList}
            invoicesList={invoicesList}
            vendorsList={vendorsList}
            locationsList={locationsList}
            departmentsList={departmentsList}
          />
        );
'@

if (-not $content.Contains($old)) {
  $old = "case 'reports':`n        return <ReportsPage />;"
}

if (-not $content.Contains($old)) {
  throw "Could not find the expected 'case reports' block in App.tsx. No changes were made."
}

$backup = "$appPath.executive-reports-backup"
Copy-Item $appPath $backup -Force

$content = $content.Replace($old, $new.TrimEnd())
Set-Content $appPath $content -Encoding UTF8

Write-Host ""
Write-Host "Executive / Management Reports installed." -ForegroundColor Green
Write-Host "Backup created: $backup"
Write-Host ""
Write-Host "Next: run npm run build"
