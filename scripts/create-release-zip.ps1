$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Package = Get-Content (Join-Path $Root 'package.json') -Raw | ConvertFrom-Json
$Version = $Package.version
$Release = Join-Path $Root 'release'
$Staging = Join-Path ([System.IO.Path]::GetTempPath()) ("mws-release-" + [Guid]::NewGuid().ToString('N'))
$ProjectName = Split-Path $Root -Leaf
$StagedProject = Join-Path $Staging $ProjectName
$Zip = Join-Path $Release ("modbus-workflow-studio-v$Version.zip")

New-Item -ItemType Directory -Force -Path $Release, $StagedProject | Out-Null
$ExcludedDirectories = @('node_modules', 'dist', 'coverage', 'release', '.git')
$ExcludedFiles = @('.env')
Get-ChildItem $Root -Force | Where-Object {
  $ExcludedDirectories -notcontains $_.Name -and $ExcludedFiles -notcontains $_.Name -and $_.Extension -ne '.zip'
} | ForEach-Object {
  Copy-Item $_.FullName $StagedProject -Recurse -Force
}
Get-ChildItem (Join-Path $StagedProject 'data') -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Extension -in @('.json', '.log') } | Remove-Item -Force
if (Test-Path $Zip) { Remove-Item $Zip -Force }
Compress-Archive -Path $StagedProject -DestinationPath $Zip -CompressionLevel Optimal
Get-FileHash $Zip -Algorithm SHA256
Remove-Item $Staging -Recurse -Force
