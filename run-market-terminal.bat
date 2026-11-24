@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  py -3 -m venv .venv
  call .venv\Scripts\python.exe -m pip install --upgrade pip
  call .venv\Scripts\python.exe -m pip install -r market_terminal\requirements.txt
)
call .venv\Scripts\python.exe -m market_terminal dashboard --interval 30
