@echo off
rem ------------------------------------------------------------------
rem  Metrology Request Tracker - launcher
rem
rem  Opens the app in Microsoft Edge and tells it who you are
rem  (your Windows user name). Keep this file next to index.html.
rem  It finds its own folder, so the tool folder can be moved or
rem  copied - no path is written in here. Works from a mapped drive
rem  (Z:\...) and from a network path (\\server\share\...).
rem
rem  Started from a network path, Windows first prints "UNC paths are
rem  not supported..." - that is harmless, this script never uses
rem  the current folder.
rem ------------------------------------------------------------------
setlocal EnableExtensions EnableDelayedExpansion

rem This file's folder, e.g. Z:\Lab\Metrology Tool\  or  \\server\share\mrt\
set "HERE=%~dp0"

rem Backslashes become slashes; spaces, # and %% are URL-encoded.
set "PCT=%%"
set "P=!HERE:\=/!"
set "P=!P:%%=%PCT%25!"
set "P=!P: =%PCT%20!"
set "P=!P:#=%PCT%23!"

rem \\server\share\  ->  file://server/share/     Z:\  ->  file:///Z:/
if "!P:~0,2!"=="//" (set "URL=file:!P!index.html") else (set "URL=file:///!P!index.html")

rem Who you are: DOMAIN\user, the backslash encoded as %%5C
set "WHO=%USERNAME%"
if defined USERDOMAIN set "WHO=%USERDOMAIN%%PCT%5C%USERNAME%"
set "WHO=!WHO: =%PCT%20!"

start "" msedge "!URL!?who=!WHO!"
if errorlevel 1 (
  echo.
  echo Microsoft Edge could not be started.
  echo Open this address in Edge by hand:
  echo !URL!
  pause
)
endlocal
