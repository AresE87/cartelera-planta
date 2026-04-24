#!/usr/bin/env bash
# -------------------------------------------------------------------
# Cartelera Planta — setup script for a Raspberry Pi player
#
# Supported: Raspberry Pi OS (64-bit) Bookworm
# Run as user 'pi' (or any regular user) — will sudo when needed.
#
# What it does:
#   1. Updates system
#   2. Installs Chromium + minimal X display
#   3. Configures auto-login + autostart of Chromium in kiosk mode
#   4. Points browser to the Cartelera display URL
#   5. Disables screensaver, power management, and mouse cursor
# -------------------------------------------------------------------
set -euo pipefail

SERVER_URL="${SERVER_URL:-http://cartelera.local:8080}"
DISPLAY_PATH="${DISPLAY_PATH:-/display/}"
FULL_URL="${SERVER_URL}${DISPLAY_PATH}"

KIOSK_USER="${KIOSK_USER:-$USER}"

echo "→ Cartelera player setup"
echo "  User:   $KIOSK_USER"
echo "  URL:    $FULL_URL"
echo ""

# Ensure we are not root (kiosk runs as user)
if [[ $EUID -eq 0 ]]; then
  echo "Run as a regular user (not root). Script will sudo when needed."
  exit 1
fi

# ---- 1. Updates & packages ----
echo "→ Updating system..."
sudo apt-get update -y
sudo apt-get install -y --no-install-recommends \
  xserver-xorg xinit openbox chromium-browser unclutter x11-xserver-utils

# ---- 2. Autostart for openbox ----
mkdir -p /home/$KIOSK_USER/.config/openbox
cat > /home/$KIOSK_USER/.config/openbox/autostart <<EOF
# Cartelera kiosk autostart
xset s off
xset -dpms
xset s noblank
unclutter -idle 0 -root &

# Clear crashed-session flags (Chromium shows a nag otherwise)
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' ~/.config/chromium/Default/Preferences || true
sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' ~/.config/chromium/Default/Preferences || true

chromium-browser \\
  --kiosk \\
  --noerrdialogs \\
  --disable-infobars \\
  --disable-session-crashed-bubble \\
  --disable-features=TranslateUI \\
  --check-for-update-interval=604800 \\
  --overscroll-history-navigation=0 \\
  --app=$FULL_URL
EOF

# ---- 3. .xinitrc to start openbox ----
cat > /home/$KIOSK_USER/.xinitrc <<'EOF'
#!/bin/sh
exec openbox-session
EOF
chmod +x /home/$KIOSK_USER/.xinitrc

# ---- 4. Auto-login via raspi-config (safe way for rpi) ----
echo "→ Enabling console auto-login for $KIOSK_USER..."
sudo raspi-config nonint do_boot_behaviour B2 || {
  # Fallback for non-rpi debians
  sudo systemctl set-default multi-user.target
  sudo mkdir -p /etc/systemd/system/getty@tty1.service.d
  sudo tee /etc/systemd/system/getty@tty1.service.d/override.conf >/dev/null <<EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $KIOSK_USER --noclear %I \$TERM
EOF
}

# ---- 5. Start X automatically on login ----
if ! grep -q "startx" /home/$KIOSK_USER/.bash_profile 2>/dev/null; then
  cat >> /home/$KIOSK_USER/.bash_profile <<'EOF'

# Cartelera kiosk: start X on tty1 login
if [ -z "$DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
  startx -- -nocursor
fi
EOF
fi

echo ""
echo "✅ Player setup complete."
echo ""
echo "→ Reboot to start kiosk mode:"
echo "    sudo reboot"
echo ""
echo "→ Once running, open admin dashboard, create a display and copy the"
echo "   6-character pairing code. Enter it on the physical TV."
echo ""
echo "→ Exit kiosk (for debug): ssh in and 'killall chromium-browser'"
