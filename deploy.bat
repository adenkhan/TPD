@echo off
echo ========================================================
echo               DEPLOYMENT PIPELINE TRIGGER
echo ========================================================
echo.
echo [1/3] Staging all changes...
git add .

echo.
echo [2/3] Committing changes...
:: Get current date and time for the commit message
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "YY=%dt:~2,2%" & set "YYYY=%dt:~0,4%" & set "MM=%dt:~4,2%" & set "DD=%dt:~6,2%"
set "HH=%dt:~8,2%" & set "Min=%dt:~10,2%" & set "Sec=%dt:~12,2%"
set "timestamp=%YYYY%-%MM%-%DD% %HH%:%Min%:%Sec%"

git commit -m "Auto-deploy: %timestamp%"

echo.
echo [3/3] Pushing to GitHub...
git push origin main

echo.
echo ========================================================
echo                    SUCCESS!
echo ========================================================
echo Changes pushed to GitHub.
echo Vercel should now recognize the new commit and start building.
echo.
pause
