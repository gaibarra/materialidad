import multiprocessing
from pathlib import Path

bind = "unix:/run/materialidad/gunicorn.sock"
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "gthread"
threads = 4
chdir = str(Path(__file__).resolve().parent)
timeout = 180
keepalive = 5
accesslog = "-"
errorlog = "-"
loglevel = "info"
