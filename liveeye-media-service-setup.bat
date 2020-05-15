::==================================================================
:: The program will start the installation of the following programs
:: Chocolatey package manager
:: DOCKER
:: LIVEEYE MEDIA PACKAGE
::==================================================================
@ECHO OFF
PAUSE

ECHO 'INSTALLING CHOCOLATEY PACKAGE MANAGER'
@"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -InputFormat None -ExecutionPolicy Bypass -Command "iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))" && SET "PATH=%PATH%;%ALLUSERSPROFILE%\chocolatey\bin"
ECHO 'CHOCOLATEY HAS BEEN INSTALLED ON YOUR SYSTEM'

REM ECHO 'INSTALLING DOCKER PACKAGE'
REM choco install docker-desktop
REM ECHO 'INSTALLED DOCKER PACKAGE'

REM ECHO 'PULLING LIVE EYE MEDIA SERVICE PACKAGE'
REM call docker pull liveeye/media-service:latest
REM ECHO 'PULLED LIVE EYE MEDIA SERVICE PACKAGE'

REM ECHO 'PULLING LIVE EYE MEDIA SERVICE PACKAGE'
REM call docker pull liveeye/media-service:latest
REM ECHO 'PULLED LIVE EYE MEDIA SERVICE PACKAGE'

REM ECHO 'STARTING MEDIA SERVICE'
REM call docker run -p 8080:8080 liveeye/media-service
REM ECHO 'STARTED'

ECHO 'INSTALLING NODE.....'
choco install nodejs
ECHO 'NODE HAS BEEN INSTALLED ON YOUR SYSTEM'

ECHO 'INSTALLING FFMPEG.....'
choco install ffmpeg
ECHO 'FFMPEG HAS BEEN INSTALLED ON YOUR SYSTEM'

ECHO 'INSTALLING PROCESS MANAGER FOR WINDOWS.....'
call npm i pm2 -g
ECHO 'PROCESS MANAGER INSTALLATION COMPLETED'

ECHO 'INSTALLING pm2-windows-startup package FOR WINDOWS.....'
call npm i pm2-windows-startup -g
ECHO 'INSTALLTION COMPLETED'

ECHO 'SETTING UP WINDOWS REGISTRY WITH PM2.....'
call pm2-startup install
ECHO 'SETUP COMPLETED - APPLICATION IS READY TO BE CONFIGURED. PLEASE RUN `START.bat`'

PAUSE
cmd /k