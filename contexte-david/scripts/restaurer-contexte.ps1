# Restaure le contexte Claude de David sur Windows (PowerShell 5 ou 7).
# À lancer depuis la racine du repo :  powershell -ExecutionPolicy Bypass -File .\contexte-david\scripts\restaurer-contexte.ps1
# Ne remplace jamais un fichier existant sans sauvegarde.
$ErrorActionPreference = "Stop"

$Repo = (git rev-parse --show-toplevel).Trim() -replace '/', '\'
$Ctx = Join-Path $Repo "contexte-david"
# Claude Code range la mémoire d'un projet sous ~/.claude/projects/<chemin du repo, caractères non alphanumériques remplacés par ->/memory
$Encoded = $Repo -replace '[^A-Za-z0-9]', '-'
$Mem = Join-Path $HOME ".claude\projects\$Encoded\memory"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"

Write-Host "Repo    : $Repo"
Write-Host "Mémoire : $Mem"

New-Item -ItemType Directory -Force -Path $Mem | Out-Null
Get-ChildItem (Join-Path $Ctx "memoire\*.md") | ForEach-Object {
  $dest = Join-Path $Mem $_.Name
  if ((Test-Path $dest) -and ((Get-FileHash $dest).Hash -ne (Get-FileHash $_.FullName).Hash)) {
    Copy-Item $dest "$dest.bak-$Stamp"
    Write-Host "  sauvegarde : $($_.Name).bak-$Stamp"
  }
  Copy-Item $_.FullName $dest -Force
  Write-Host "  copié : $($_.Name)"
}

$Global = Join-Path $HOME ".claude\CLAUDE.md"
$GlobalSrc = Join-Path $Ctx "claude\CLAUDE-global.md"
if (-not (Test-Path $Global)) {
  New-Item -ItemType Directory -Force -Path (Split-Path $Global) | Out-Null
  Copy-Item $GlobalSrc $Global
  Write-Host "Instructions globales installées : $Global"
} elseif ((Get-FileHash $Global).Hash -ne (Get-FileHash $GlobalSrc).Hash) {
  Write-Host "Instructions globales déjà présentes et différentes : $Global (non modifiées ; comparer avec contexte-david\claude\CLAUDE-global.md)"
}

Write-Host ""
Write-Host "Outils :"
foreach ($t in "git", "node", "npm", "gh", "az", "terraform", "docker", "python") {
  if (Get-Command $t -ErrorAction SilentlyContinue) { Write-Host ("  {0,-10} ok" -f $t) }
  else { Write-Host ("  {0,-10} MANQUANT" -f $t) }
}
if (Get-Command gh -ErrorAction SilentlyContinue) {
  gh auth status *> $null
  if ($LASTEXITCODE -ne 0) { Write-Host "  gh n'est pas connecté : lancer  gh auth login -h github.com -p https -w" }
}

Write-Host ""
Write-Host "Étapes suivantes :"
Write-Host "  1. git fetch --all ; git switch david/moteur-score   (ou la branche du moment)"
Write-Host "  2. cd apps\api ; npm install ; npm test"
Write-Host "  3. Ouvrir le repo dans VS Code, lancer Claude Code et coller contexte-david\PROMPT-REPRISE.md"
