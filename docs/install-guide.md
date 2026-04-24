# Guía de instalación

## Prerrequisitos

- **Server:** hardware con al menos 2 CPU, 4 GB RAM, 20 GB disco. Cualquier x86_64 moderno alcanza.
- **Sistema operativo:** Ubuntu Server 24.04 LTS (noble).
- **Red:** IP fija en la LAN corporativa, DNS interno apuntando a un nombre como `carteleria.empresa.local`.
- **Acceso:** SSH con clave pública configurada (el script deshabilita auth por contraseña).

---

## Instalación rápida (servidor)

```bash
# 1. Ubuntu recién instalado, entrá por SSH
ssh usuario@carteleria.empresa.local

# 2. Clone + script automático
sudo apt-get update && sudo apt-get install -y git
git clone https://github.com/AresE87/cartelera-planta.git /tmp/cartelera
sudo bash /tmp/cartelera/scripts/install-ubuntu.sh
```

El script hace todo:

1. Actualiza el sistema
2. Instala UFW, fail2ban, Docker, unattended-upgrades
3. Endurece SSH
4. Crea el usuario `cartelera`
5. Clona el repo a `/opt/cartelera`
6. Genera `.env` con JWT secret aleatorio
7. Levanta los containers con `docker compose up -d`
8. Crea un servicio systemd para auto-start
9. Programa backup nocturno a las 03:00

### Verificar

```bash
# Status de containers
docker compose -f /opt/cartelera/docker-compose.yml ps

# Health check
bash /opt/cartelera/scripts/health-check.sh

# Abrir el admin en el browser:
# http://<IP-del-server>:8080/admin
# user: admin@cartelera.local
# pass: admin1234   ← cambialo YA
```

---

## Instalación manual (si preferís control total)

```bash
# 1. Paquetes base
sudo apt-get update
sudo apt-get install -y curl git ufw fail2ban

# 2. Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# relogin para que tome el grupo

# 3. Firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# 4. Clone
sudo mkdir -p /opt/cartelera && sudo chown $USER /opt/cartelera
git clone https://github.com/AresE87/cartelera-planta.git /opt/cartelera
cd /opt/cartelera

# 5. .env
cp .env.example .env
# Generá secret fuerte:
SECRET=$(openssl rand -hex 32)
sed -i "s|change-me-to-a-long-random-string-at-least-32-chars|$SECRET|" .env
vim .env  # ajustá ADMIN_EMAIL, CORS_ORIGIN, PUBLIC_URL

# 6. Levantar
docker compose up -d --build

# 7. Logs
docker compose logs -f
```

---

## Cambio de URL / HTTPS

Por defecto corre en `http://host:8080`. Para usar HTTPS con cert interno de Caddy:

1. Edit `Caddyfile`:
   ```
   carteleria.empresa.local {
     tls internal
     # ... rutas como en la versión :80
   }
   ```
2. Agregá `carteleria.empresa.local` al DNS interno apuntando al server.
3. `docker compose restart caddy`.
4. La primera vez que cada browser acceda, aceptá el cert auto-firmado (o importá el root CA de Caddy: `docker exec cartelera-caddy caddy root-certs`).

---

## Setup de un player (Raspberry Pi)

### Hardware

- Raspberry Pi 4 (2GB+) o Pi 5
- microSD 32GB+ clase A2
- Fuente oficial
- Cable HDMI
- Cable de red (preferible a WiFi para estabilidad)

### Software

1. Flashear **Raspberry Pi OS Lite 64-bit (Bookworm)** con Raspberry Pi Imager
2. En el wizard del Imager, configurá:
   - User: `pi` (o el que prefieras)
   - Hostname: ej. `tv-comedor`
   - WiFi (si aplica)
   - Habilitar SSH con clave pública
3. Arrancar el Pi, conectar por SSH.
4. Correr el script:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/AresE87/cartelera-planta/main/scripts/player-setup.sh | \
     SERVER_URL=http://carteleria.empresa.local:8080 bash
   ```
5. `sudo reboot`
6. Al volver, el Pi abre Chromium en kiosk directo a la pantalla de pairing.

### Emparejar el display

1. En el admin web: Pantallas → + Nueva pantalla → poné nombre y zona → Crear.
2. Va a mostrar un código de 6 caracteres (válido 30 min).
3. En el Pi (con un teclado USB momentáneo), escribí el código y Enter.
4. Listo: el display queda vinculado.

Para desvincular: `Ctrl+Shift+U` en el display.

### Opción Android TV

- Instalar Fully Kiosk Browser desde Play Store
- Config → URL de inicio: `http://carteleria.empresa.local:8080/display/`
- Activar "Load on boot" y modo kiosk
- Si no está autorizado el root: usar "Autostart" de Fully Kiosk + auto-launch on reboot

---

## Siguiente paso

Ver [user-manual.md](user-manual.md) para aprender a usar el panel de administración.
