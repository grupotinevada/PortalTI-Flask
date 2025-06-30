# gunicorn.conf.py
#EN LA CONSOLA SE EJECUTA CON ESTE COMANDO:   gunicorn app:app -c gunicorn.conf.py

bind = '0.0.0.1:5000'
workers = 4
timeout = 300
loglevel = 'info'
accesslog = 'gunicorn.access.log'
errorlog = 'gunicorn.error.log'
