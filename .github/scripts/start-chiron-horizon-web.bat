@echo off
setlocal EnableDelayedExpansion

:: 脚本所在目录（等价于 ROOT）
set ROOT=%~dp0
:: 去掉末尾反斜杠
set ROOT=%ROOT:~0,-1%

set CHIRON_HORIZON_PACKAGE_ROOT=%ROOT%

:: static dir
if "%CHIRON_HORIZON_STATIC_DIR%"=="" (
    :: dist静态资源文件已直接嵌入到二进制文件中，环境变量中没有设置的话，直接用二进制中的静态文件
    rem set CHIRON_HORIZON_STATIC_DIR=%ROOT%\dist
)
:: data dir
if "%CHIRON_HORIZON_DATA_DIR%"=="" (
    set CHIRON_HORIZON_DATA_DIR=%ROOT%\data
)

:: port
if "%CHIRON_HORIZON_PORT%"=="" (
    set CHIRON_HORIZON_PORT=4224
)

:: base path
set BASE_PATH=%CHIRON_HORIZON_PUBLIC_BASE_PATH%
if "%BASE_PATH%"=="" set BASE_PATH=/

:: 如果不是以 / 开头，补上 /
echo %BASE_PATH% | findstr /r "^/" >nul || (
    set BASE_PATH=/!BASE_PATH!
)

echo CHIRON_HORIZON_DATA_DIR=%CHIRON_HORIZON_DATA_DIR%
echo Chiron Horizon browser UI: http://127.0.0.1:%CHIRON_HORIZON_PORT%%BASE_PATH%

cd /d "%ROOT%"

:: 执行程序
chiron-horizon-web.exe %*
