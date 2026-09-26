$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$previewUrl = 'http://127.0.0.1:4173/'

function Test-LocalPreview {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 $previewUrl
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

if (-not (Test-LocalPreview)) {
    $nodePath = (Get-Command node -ErrorAction Stop).Source
    Start-Process -FilePath $nodePath `
        -ArgumentList @('node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4173') `
        -WorkingDirectory $projectDir -WindowStyle Hidden | Out-Null

    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 300
        if (Test-LocalPreview) {
            $ready = $true
            break
        }
    }
    if (-not $ready) {
        Write-Error 'Local preview failed to start. Please send a screenshot of this window.'
        exit 1
    }
}

Start-Process $previewUrl
Write-Host 'The website homepage is open in your browser.'
