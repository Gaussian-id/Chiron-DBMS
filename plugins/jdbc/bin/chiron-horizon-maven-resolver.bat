@echo off
setlocal

if defined CHIRON_HORIZON_JAVA_BIN (
    if exist "%CHIRON_HORIZON_JAVA_BIN%" (
        set "JAVA_BIN=%CHIRON_HORIZON_JAVA_BIN%"
        goto :run
    )
)

if defined JAVA_HOME (
    if exist "%JAVA_HOME%\bin\java.exe" (
        set "JAVA_BIN=%JAVA_HOME%\bin\java.exe"
        goto :run
    )
)

where java >nul 2>nul
if %errorlevel% equ 0 (
    java -version >nul 2>nul
    if %errorlevel% equ 0 (
        set "JAVA_BIN=java"
        goto :run
    )
)

echo Java runtime not found. Install Java or the optional Chiron Horizon JDBC runtime. >&2
exit /b 127

:run
"%JAVA_BIN%" -Dfile.encoding=UTF-8 -Dsun.stdout.encoding=UTF-8 -Dsun.stderr.encoding=UTF-8 -cp "%~dp0..\lib\chiron-horizon-jdbc-plugin.jar" app.chiron.horizon.jdbc.maven.ChironHorizonMavenResolver %*
