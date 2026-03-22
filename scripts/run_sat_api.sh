#!/bin/bash
cd /home/gaibarra/materialidad
source ~/.nvm/nvm.sh
# Use whatever python version is available
python3 -m venv venv_sat
source venv_sat/bin/activate
pip install fastapi uvicorn psycopg2-binary pandas requests
uvicorn sat_api_v2:app --host 0.0.0.0 --port 8001
