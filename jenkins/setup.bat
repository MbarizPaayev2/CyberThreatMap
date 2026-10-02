@echo off
REM Jenkins Setup Helper Script for Windows
REM This script helps with initial Jenkins configuration

echo ==========================================
echo Jenkins CI/CD Setup for Live Threat Map
echo ==========================================
echo.

REM Check if env.template exists
if not exist "env.template" (
    echo Error: env.template not found in jenkins directory
    exit /b 1
)

REM Copy template to .env if it doesn't exist
if not exist ".env" (
    echo Creating .env from template...
    copy env.template .env >nul
    echo [OK] Created .env file
    echo.
    echo IMPORTANT: Please edit .env and fill in the actual values
    echo DO NOT commit .env with real values to version control
    echo.
) else (
    echo [OK] .env file already exists
)

echo.
echo ==========================================
echo Next Steps:
echo ==========================================
echo.
echo 1. Edit jenkins\.env and fill in the required values
echo 2. Configure Jenkins with the plugins listed in README.md
echo 3. Set up Node.js in Jenkins Global Tool Configuration
echo 4. Create a folder named 'live-threat-map' in Jenkins
echo 5. Create a pipeline job in that folder
echo 6. Configure the pipeline to use jenkins\Jenkinsfile
echo 7. Add required credentials to Jenkins
echo 8. Trigger a build
echo.
echo For detailed instructions, see jenkins\README.md
echo.
