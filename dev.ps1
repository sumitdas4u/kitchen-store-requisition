$ErrorActionPreference = "Stop"

$action = if ($args.Count -gt 0) { $args[0] } else { "up" }

switch ($action) {
    "up" {
        Write-Host "Starting dev stack (Postgres + Redis in Docker, apps locally)..." -ForegroundColor Cyan
        Write-Host ""
        Write-Host "   Backend  -> http://localhost:3001" -ForegroundColor Green
        Write-Host "   Frontend -> http://localhost:3000" -ForegroundColor Green
        Write-Host ""
        npm run dev
    }
    "down" {
        Write-Host "Stopping infrastructure containers..." -ForegroundColor Yellow
        docker compose -f docker-compose.dev.yml down
    }
    "reset" {
        Write-Host "Tearing down containers + wiping volumes..." -ForegroundColor Red
        docker compose -f docker-compose.dev.yml down -v
        Write-Host "Clean slate. Run .\dev.ps1 to start fresh." -ForegroundColor Green
    }
    "logs" {
        docker compose -f docker-compose.dev.yml logs -f
    }
    "docker" {
        Write-Host "Starting full Docker stack (all services in Docker)..." -ForegroundColor Cyan
        docker compose -f docker-compose.dev.yml up --build
    }
    default {
        Write-Host "Usage: .\dev.ps1 [up|down|reset|logs|docker]"
    }
}
