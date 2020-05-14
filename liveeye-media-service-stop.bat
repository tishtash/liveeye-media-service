@ECHO OFF
PAUSE

ECHO 'STOPPING SERVER.......'
call pm2 stop liveeye-media-service
ECHO 'STEP COMPLETED'

ECHO 'REMOVING PROCESS FROM WINDOWS STARTUP.....'
call pm2 delete liveeye-media-service
ECHO 'STEP COMPLETED'

PAUSE
cmd /k