@echo off
cd /d "%~dp0"
set GIT="%LOCALAPPDATA%\Programs\Git\cmd\git.exe"
if not exist %GIT% set GIT=git

echo ========================================================
echo   Pushing Hope Dealers Updates to GitHub for Netlify
echo ========================================================
echo.

%GIT% add .
set /p commit_msg="Enter update description (press Enter for 'Update Hope Dealers app'): "
if "%commit_msg%"=="" set commit_msg=Update Hope Dealers app

%GIT% commit -m "%commit_msg%"
%GIT% push -u origin main

echo.
echo ========================================================
echo   Pushed! Netlify is now automatically building & deploying.
echo ========================================================
pause
