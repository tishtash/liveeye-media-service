@ECHO OFF
PAUSE

ECHO 'INSTALLING NPM PACKAGE DEPENDECIES....'
call npm i
ECHO 'NPM DEPENDENCIES HAS BEEN INSTALLED'

ECHO 'DELETE EXISTING PM2 PROCESS (IF ANY)......'
call pm2 delete liveeye-media-service
ECHO 'STEP COMPLETED'

ECHO 'FIRING UP THE APPLICATION.....'
call pm2 start index.js --name liveeye-media-service -i 1
ECHO 'STEP COMPLETED'

ECHO 'SAVING THE PROCESS IN WINDOWS STARTUP PROCESS.....'
call pm2 save
ECHO 'STEP COMPLETED'

PAUSE
cmd /k