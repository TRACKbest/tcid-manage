# PowerShell wrapper: runs infra/stop-tcid.sh with Git Bash (same options).
$bash = "C:\Program Files\Git\bin\bash.exe"
if (-not (Test-Path $bash)) { throw "Git Bash not found at $bash" }
& $bash "$PSScriptRoot/stop-tcid.sh" @args
exit $LASTEXITCODE
