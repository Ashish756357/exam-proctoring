$ErrorActionPreference = "Stop"

$checks = @(
  @{ Name = "Candidate App"; Url = "http://localhost:5173" },
  @{ Name = "Mobile App"; Url = "http://localhost:5174" },
  @{ Name = "Admin App"; Url = "http://localhost:5175" },
  @{ Name = "Backend API"; Url = "http://localhost:8080/api/v1/health" },
  @{ Name = "AI Engine"; Url = "http://localhost:8090/health" }
)

foreach ($check in $checks) {
  try {
    $resp = Invoke-WebRequest -Uri $check.Url -UseBasicParsing -TimeoutSec 5
    Write-Host ("[health] {0}: OK ({1})" -f $check.Name, $resp.StatusCode)
  } catch {
    Write-Host ("[health] {0}: FAIL" -f $check.Name)
  }
}
