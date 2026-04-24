#!/usr/bin/env bash
# -------------------------------------------------------------------
# Cartelera Planta — Ubuntu Server install script
#
# Supported: Ubuntu Server 24.04 LTS (noble)
# Run as root or via sudo: sudo bash install-ubuntu.sh
#
# What it does:
#   1. System updates + hardening (UFW, fail2ban, unattended-upgrades)
#   2. Install Docker + Docker Compose plugin
#   3. Create cartelera system user
#   4. Clone repo + setup .env
#   5. docker compose up -d
# -------------------------------------------------------------------
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "This script must be run as root (try: sudo bash $0)"
  exit 1
fi

log() { echo -e "\033[1;32m[cartelera]\033[0m $*"; }
warn() { echo -e "\033[1;33m[warn]\033[0m $*"; }
err() { echo -e "\033[1;31m[error]\033[0m $*" >&2; }

REPO_URL="${REPO_URL:-https://github.com/AresE87/cartelera-planta.git}"
INSTALL_DIR="${INSTALL_DIR:-/opt/cartelera}"
ADMIN_USER="${ADMIN_USER:-cartelera}"

# ---- 1. System update & essentials ----
log "Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y \
  curl wget git ufw fail2ban unattended-upgrades apt-listchanges \
  ca-certificates gnupg lsb-release htop tmux vim jq \
  sqlite3 tree

# ---- 2. Unattended upgrades ----
log "Configuring unattended security upgrades..."
dpkg-reconfigure -f noninteractive unattended-upgrades
cat > /etc/apt/apt.conf.d/51cartelera-unattended <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

# ---- 3. UFW firewall ----
log "Configuring UFW firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp     comment 'Cartelera HTTP'
ufw allow 443/tcp    comment 'Cartelera HTTPS'
ufw --force enable

# ---- 4. fail2ban ----
log "Enabling fail2ban..."
systemctl enable --now fail2ban

# ---- 5. SSH hardening (only if config not already hardened) ----
if grep -q "^#PermitRootLogin" /etc/ssh/sshd_config; then
  sed -i 's/^#*PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
  sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
  warn "SSH hardened — password auth disabled. Make sure you have SSH keys set up!"
  systemctl restart sshd || true
fi

# ---- 6. Docker ----
if ! command -v docker &>/dev/null; then
  log "Installing Docker..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
else
  log "Docker already installed."
fi

# ---- 7. Create system user ----
if ! id "$ADMIN_USER" &>/dev/null; then
  log "Creating user $ADMIN_USER..."
  useradd -r -m -s /bin/bash -d /home/$ADMIN_USER $ADMIN_USER
fi
usermod -aG docker $ADMIN_USER

# ---- 8. Clone repo ----
if [[ ! -d "$INSTALL_DIR/.git" ]]; then
  log "Cloning repo into $INSTALL_DIR..."
  mkdir -p "$(dirname "$INSTALL_DIR")"
  git clone "$REPO_URL" "$INSTALL_DIR"
else
  log "Repo already cloned. Pulling latest..."
  git -C "$INSTALL_DIR" pull --ff-only
fi
chown -R $ADMIN_USER:$ADMIN_USER "$INSTALL_DIR"

# ---- 9. .env ----
if [[ ! -f "$INSTALL_DIR/.env" ]]; then
  log "Creating .env from template..."
  cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
  # Generate strong JWT secret
  JWT=$(openssl rand -hex 32)
  sed -i "s|change-me-to-a-long-random-string-at-least-32-chars|$JWT|" "$INSTALL_DIR/.env"
  warn "Review $INSTALL_DIR/.env and adjust as needed before starting."
fi

# ---- 10. Backup directory ----
log "Creating backup directory..."
mkdir -p /var/backups/cartelera
chown -R $ADMIN_USER:$ADMIN_USER /var/backups/cartelera

# ---- 11. Cron for nightly backup ----
log "Installing nightly backup cron..."
cat > /etc/cron.d/cartelera-backup <<EOF
# Cartelera Planta — nightly backup at 03:00
0 3 * * * $ADMIN_USER cd $INSTALL_DIR && bash scripts/backup.sh >> /var/log/cartelera-backup.log 2>&1
EOF
chmod 644 /etc/cron.d/cartelera-backup

# ---- 12. Systemd unit for auto-start ----
log "Creating systemd service..."
cat > /etc/systemd/system/cartelera.service <<EOF
[Unit]
Description=Cartelera Planta — digital signage
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$INSTALL_DIR
User=$ADMIN_USER
Group=$ADMIN_USER
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable cartelera.service

# ---- 13. Start ----
log "Building and starting containers (this takes ~2-5 min the first time)..."
cd "$INSTALL_DIR"
sudo -u $ADMIN_USER docker compose pull || true
sudo -u $ADMIN_USER docker compose up -d --build

log ""
log "✅ Cartelera Planta installed."
log ""
log "  Access:      http://$(hostname -I | awk '{print $1}'):8080/admin"
log "  Default:     admin@cartelera.local / admin1234  (change asap)"
log "  Logs:        docker compose logs -f    (from $INSTALL_DIR)"
log "  Backup dir:  /var/backups/cartelera"
log ""
log "Next steps:"
log "  1. Log in and change the default admin password."
log "  2. Review $INSTALL_DIR/.env and restart if changed."
log "  3. Create zones, widgets, layouts, and pair your first display."
log ""
