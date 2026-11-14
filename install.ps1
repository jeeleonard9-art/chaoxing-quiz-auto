<#
  一键安装：把本仓库装进 AI 助手的 skills 目录，并装好依赖
  用法: powershell -ExecutionPolicy Bypass -File install.ps1 [目标skills目录]
#>
param([string]$SkillsDir = "")
$ErrorActionPreference = 'Stop'

if (-not $SkillsDir) {
  $SkillsDir = if ($env:USERPROFILE) { Join-Path $env:USERPROFILE ".workbuddy\skills" }
               else { Join-Path $HOME ".workbuddy/skills" }
}
$RepoUrl = "https://github.com/jeeleonard9-art/chaoxing-quiz-auto.git"
$Target = Join-Path $SkillsDir "chaoxing-quiz-auto"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "需要 Node.js 18+，请先安装" }
$major = [int](node -e "process.stdout.write(process.versions.node.split('.')[0])")
if ($major -lt 18) { throw "Node.js 版本过低，需要 18+" }

New-Item -ItemType Directory -Force -Path $SkillsDir | Out-Null

if (Test-Path (Join-Path $Target ".git")) {
  Write-Host "更新已有安装: $Target"
  git -C $Target pull --ff-only
} else {
  Write-Host "安装到: $Target"
  git clone --depth 1 $RepoUrl $Target
}

Push-Location $Target
try {
  npm install --no-audit --no-fund
} finally { Pop-Location }

Write-Host ""
Write-Host "完成。安装位置: $Target"
Write-Host "下一步: 用你的 AI 助手打开作业页面，然后说「帮我把超星作业做完」"
