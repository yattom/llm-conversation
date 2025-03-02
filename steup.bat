@echo off
echo Multi-Agent LLM Conversation System Setup
echo =========================================
echo.

REM Check if Docker is installed
where docker >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Docker not found! Please install Docker Desktop first.
    echo Download from: https://www.docker.com/products/docker-desktop/
    exit /b 1
)

REM Create necessary directories
echo Creating directories...
mkdir ollama-data 2>nul
mkdir conversations 2>nul
mkdir characters 2>nul
mkdir orchestrator 2>nul
mkdir web-ui 2>nul
mkdir web-ui\src 2>nul

REM Copy configuration files from the current directory
echo Copying configuration files...
copy docker-compose.yml docker-compose.yml >nul

REM Copy orchestrator files
copy orchestrator\app.py orchestrator\app.py >nul
copy orchestrator\Dockerfile orchestrator\Dockerfile >nul
copy orchestrator\requirements.txt orchestrator\requirements.txt >nul

REM Copy web-ui files
copy web-ui\src\App.js web-ui\src\App.js >nul
copy web-ui\Dockerfile web-ui\Dockerfile >nul
copy web-ui\nginx.conf web-ui\nginx.conf >nul
copy web-ui\package.json web-ui\package.json >nul

REM Create the sample characters directory
mkdir README 2>nul
copy example-characters.md README\example-characters.md >nul

echo Starting Docker Compose...
docker-compose up -d

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Docker Compose failed to start. Please check the error message above.
    exit /b 1
)

echo.
echo Setup complete! The system is now running.
echo.
echo Next steps:
echo 1. Download models with: docker exec -it ollama-service ollama pull llama3:8b
echo 2. Access the web UI at: http://localhost:3000
echo 3. Create AI characters and start conversations
echo.
echo Enjoy your multi-agent LLM conversation system!
