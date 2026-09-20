param([Parameter(Mandatory=$true)][string]$ZipPath)
$ErrorActionPreference = 'Stop'
$Temp = Join-Path ([System.IO.Path]::GetTempPath()) ("mws-verify-" + [Guid]::NewGuid().ToString('N'))
Expand-Archive $ZipPath $Temp
$Forbidden = Get-ChildItem $Temp -Recurse -Force | Where-Object {
  $_.FullName -match '[\\/](node_modules|dist|coverage|\.git)([\\/]|$)' -or
  ($_.Name -match '^\.env($|\.)') -or
  ($_.FullName -match '[\\/]data[\\/].*\.(json|log)$')
}
if ($Forbidden) { throw "Forbidden release content detected: $($Forbidden.FullName -join ', ')" }
Get-FileHash $ZipPath -Algorithm SHA256
Remove-Item $Temp -Recurse -Force
Write-Host 'Release ZIP structure verified.'
