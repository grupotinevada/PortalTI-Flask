# 🚀 Deploy PortalTI con Python 3.13.5, Ghostscript y Nginx + Cloudflare
## 📁 Paso 1: Copiar carpeta del proyecto
```markdown
Ubícate en la ruta:
```bash
cd /var/www/
```

Copia y pega la carpeta del portal dentro de este directorio.

---

## 🐍 Paso 2: Verificar versión de Python

Asegúrate de tener Python 3.13.5 (o variante 3.13.x):
```bash
/usr/local/bin/python3.13 --version
```

---

## 🧪 Paso 3: Crear entorno virtual

Dentro de la carpeta del proyecto:
```bash
/usr/local/bin/python3.13 -m venv env
```

Activar entorno:
```bash
source env/bin/activate
```

Deberías ver algo como:
```bash
(env) usuario@servidor:~$
```

---

## 📦 Paso 4: Instalar dependencias

Dentro del entorno:
```bash
pip install -r requirements.txt
```

> ⚠️ Si aparece error con algún módulo, instálalo manualmente:
```bash
pip install nombre_modulo
```

Salir del entorno:
```bash
deactivate
```

---

## 📦 Paso 5: Instalar Ghostscript desde archivo `.tgz`

Mover el archivo `gs_10.05.1_amd64_snap.tgz` a una carpeta externa:
```bash
sudo tar -xvzf gs_10.05.1_amd64_snap.tgz
cd gs_10.05.1_amd64_snap/
```

Instalar Snap (si no está instalado):
```bash
sudo apt install snapd
```

Instalar Ghostscript con Snap:
```bash
sudo snap install --dangerous --devmode gs_10.05.1_amd64.snap
```

Verificar instalación:
```bash
snap list | grep gs
```

Deberías ver:
```
gs    10.05.1  x1    -    devmode
```

Reinicia el servidor para aplicar Ghostscript al entorno:
```bash
sudo reboot
```

---

## 🖥️ Paso 6: Ejecutar el portal en segundo plano (screen)

Después de reiniciar:

1. Crear screen:
    ```bash
    screen -S PortalTI
    ```

2. Ir a la carpeta del portal:
    ```bash
    cd /var/www/nombre_proyecto
    source env/bin/activate
    ```

3. Ejecutar app:
    ```bash
    python3.13 app.py
    ```

Saldrá algo como:
```
Running on all addresses (0.0.0.0)
Running on http://127.0.0.1:5000
Running on http://192.168.195.147:5000
```

Presiona `Ctrl + A + D` para dejar la screen en segundo plano.

---

## 🌐 Paso 7: Configurar Nginx

Crear archivo de configuración:
```bash
sudo nano /etc/nginx/sites-available/portalti2.inevada.cl
```

Contenido del archivo:
```nginx
server {
    listen 80;
    server_name portalti2.inevada.cl;

    location / {
        proxy_pass http://192.168.195.147:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Activar el sitio:
```bash
sudo ln -s /etc/nginx/sites-available/portalti2.inevada.cl /etc/nginx/sites-enabled/
```

Probar configuración:
```bash
sudo nginx -t
```

Recargar Nginx:
```bash
sudo systemctl reload nginx
```

---

## ☁️ Paso 8: Configurar túneles Cloudflare

En Cloudflare, crea un túnel que apunte el subdominio:
```
http://portalti.inevada.cl
```
A la dirección local:
```
http://192.168.195.147:5000
```

> Esta IP puede variar según el entorno o servidor utilizado.

---

## ✅ ¡Listo!

Tu portal está funcionando en segundo plano, Ghostscript instalado y el proxy activo vía Nginx + Cloudflare.  