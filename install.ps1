<#
  一键安装：把本仓库装进 AI 助手的 skills 目录，并装好依赖
  用法: powershell -ExecutionPolicy Bypass -File install.ps1 [目标skills目录]

  有 git 就 clone；没有 git 就自动下载 GitHub zip 包解压
  （zip 里顶层目录名是 chaoxing-quiz-auto-*，会重命名为目标目录名）。
#>
param([string]$SkillsDir = "")
$ErrorActionPreference = 'Stop'

if (-not $SkillsDir) {
  $SkillsDir = if ($env:USERPROFILE) { Join-Path $env:USERPROFILE ".workbuddy\skills" }
               else { Join-Path $HOME ".workbuddy/skills" }
}
$RepoUrl = "https://github.com/jeeleonard9-art/chaoxing-quiz-auto.git"
$RepoZip = "https://github.com/jeeleonard9-art/chaoxing-quiz-auto/archive/refs/heads/main.zip"
$Target = Join-Path $SkillsDir "chaoxing-quiz-auto"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "需要 Node.js 20+，请先安装" }
$major = [int](node -e "process.stdout.write(process.versions.node.split('.')[0])")
if ($major -lt 20) { throw "Node.js 版本过低：playwright-core 1.6x 要求 Node 20+" }

New-Item -ItemType Directory -Force -Path $SkillsDir | Out-Null

if (Test-Path (Join-Path $Target ".git")) {
  Write-Host "更新已有安装: $Target"
  git -C $Target pull --ff-only
} elseif ((Test-Path (Join-Path $Target "SKILL.md"))) {
  Write-Host "目标目录已存在且是已解压的技能包: $Target"
  Write-Host "如需更新请先删除该目录后重跑本脚本"
} else {
  if (Get-Command git -ErrorAction SilentlyContinue) {
    Write-Host "安装到: $Target"
    git clone --depth 1 $RepoUrl $Target
  } else {
    Write-Host "未检测到 git，改用 zip 包安装"
    $tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("cqz-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null
    try {
      $zip = Join-Path $tmp "repo.zip"
      Invoke-WebRequest -Uri $RepoZip -OutFile $zip -UseBasicParsing
      Expand-Archive -Path $zip -DestinationPath $tmp -Force
      $src = Get-ChildItem -Path $tmp -Directory | Where-Object { $_.Name -like "chaoxing-quiz-auto*" } | Select-Object -First 1
      if (-not $src) { throw "解压失败，zip 结构异常" }
      Move-Item -Path $src.FullName -Destination $Target
      Write-Host "安装到: $Target"
    } finally {
      Remove-Item -Path $tmp -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

Push-Location $Target
try {
  npm install --no-audit --no-fund
} finally { Pop-Location }

Write-Host ""
Write-Host "完成。安装位置: $Target"
Write-Host "下一步: 用你的 AI 助手打开作业页面，然后说「帮我把超星作业做完」"
