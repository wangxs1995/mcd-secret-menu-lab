# 麦门隐藏菜单研究所 · 一键安装（Windows PowerShell）
# 把 Skill 复制到 WorkBuddy 与 Claude Code 的技能目录；已存在时先备份。
# 用法：.\install.ps1   （可加 -Target workbuddy|claude|all，默认 all）
param(
  [ValidateSet('workbuddy', 'claude', 'all')]
  [string]$Target = 'all'
)

$ErrorActionPreference = 'Stop'
$Src = $PSScriptRoot
$Name = 'mcd-secret-menu-lab'
$Files = @('SKILL.md', 'package.json', 'mcp-config.example.json', '.env.example', 'references', 'src')

$targets = @()
if ($Target -in @('workbuddy', 'all')) { $targets += Join-Path $HOME ".workbuddy\skills\$Name" }
if ($Target -in @('claude', 'all'))    { $targets += Join-Path $HOME ".claude\skills\$Name" }

foreach ($dest in $targets) {
  if (Test-Path $dest) {
    $backup = "$dest.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Move-Item $dest $backup
    Write-Host "已备份旧版本 -> $backup"
  }
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  foreach ($f in $Files) {
    $from = Join-Path $Src $f
    if (Test-Path $from) { Copy-Item $from -Destination $dest -Recurse -Force }
  }
  Write-Host "✅ 已安装到 $dest"
}

Write-Host ''
Write-Host '下一步：'
Write-Host '  1. 在客户端里配置麦当劳 MCP 连接器（见 mcp-config/README.md），替换 ${MCD_MCP_TOKEN}'
Write-Host '  2. 在技能目录里复制 .env.example 为 .env 并填入 Token（CLI 模式需要）'
Write-Host '  3. 对 Agent 说：「给我来一个 30 块以内的麦当劳隐藏吃法」'
