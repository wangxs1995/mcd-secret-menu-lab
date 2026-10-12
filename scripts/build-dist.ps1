# 打包 Skill ZIP（供 WorkBuddy 等客户端「导入技能」使用）
# 用法：.\scripts\build-dist.ps1   → 生成 dist/mcd-secret-menu-lab-skill.zip
$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
$Dist = Join-Path $Root 'dist'
$Stage = Join-Path $Dist 'mcd-secret-menu-lab'
$Zip = Join-Path $Dist 'mcd-secret-menu-lab-skill.zip'

if (Test-Path $Stage) { Remove-Item $Stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path $Stage | Out-Null

foreach ($f in @('SKILL.md', 'README.md', 'LICENSE', 'package.json', 'mcp-config.example.json', '.env.example', 'references', 'src', 'mcp-config')) {
  $from = Join-Path $Root $f
  if (Test-Path $from) { Copy-Item $from -Destination $Stage -Recurse -Force }
}

if (Test-Path $Zip) { Remove-Item $Zip -Force }
Compress-Archive -Path $Stage -DestinationPath $Zip
Remove-Item $Stage -Recurse -Force
$size = [math]::Round((Get-Item $Zip).Length / 1KB)
Write-Host "✅ $Zip ($size KB)"
