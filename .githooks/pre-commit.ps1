#!/usr/bin/env pwsh
# Minimal pre-commit helper: run lint and quick secrets grep
Write-Host "Running pre-commit checks..."

# Run ESLint
Write-Host "Running eslint..."
npm run lint --silent
if ($LASTEXITCODE -ne 0) { Write-Error "ESLint failed"; exit 1 }

# Quick grep for potential secrets (very basic)
Write-Host "Scanning for obvious secrets..."
$patterns = @('AKIA', 'PRIVATE KEY', 'BEGIN RSA PRIVATE KEY', 'SECRET', 'PASSWORD=')
$hasIssue = $false
foreach ($p in $patterns) {
  $found = git grep -n -- "${p}" 2>$null
  if ($found) { Write-Warning "Possible secret matches for pattern: $p"; $hasIssue = $true }
}

if ($hasIssue) { Write-Error "Possible secrets detected. Review before committing."; exit 1 }

Write-Host "Pre-commit checks passed."; exit 0
