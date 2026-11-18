#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 22.04/24.04 server (e.g. a GoDaddy VPS) for ProjectFlow.
# Run from the cloned repo as root:   sudo bash deploy/setup-server.sh
#
# What it does: installs Docker + Nginx + Certbot, opens only ports 22/80/443, adds swap
# on small servers, writes .env (asks for domain + admin; generates every secret), builds
# and starts the stack, configures Nginx + free HTTPS, and schedules a daily backup.
set -euo pipefail

if [[ $EUID -ne 0 ]]; then echo "Run as root: sudo bash deploy/setup-server.sh"; exit 1; fi
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

echo "==> ProjectFlow server setup in $REPO_DIR"

# ---------- questions ----------
read -rp "Domain for the app (e.g. projectflow.mycompany.com): " DOMAIN
read -rp "Administrator email (your login): " ADMIN_EMAIL
read -rp "Administrator full name: " ADMIN_NAME
while true; do
  read -rsp "Administrator password (min 8 chars): " ADMIN_PASSWORD; echo
  [[ ${#ADMIN_PASSWORD} -ge 8 ]] && break
  echo "Too short."
done
read -rp "Email for Let's Encrypt certificate notices: " LE_EMAIL

# ---------- packages ----------
echo "==> Installing Docker, Nginx, Certbot, firewall"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl gnupg ufw nginx certbot python3-certbot-nginx openssl
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

# ---------- firewall ----------
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# ---------- swap (building the web app needs ~3GB RAM) ----------
MEM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
if [[ $MEM_MB -lt 3800 ]] && ! swapon --show | grep -q /swapfile; then
  echo "==> ${MEM_MB}MB RAM — adding a 4GB swap file so the build doesn't run out of memory"
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ---------- .env ----------
if [[ -f .env ]]; then
  echo "==> .env already exists — keeping it (delete it to regenerate)"
else
  echo "==> Writing .env with generated secrets"
  cp deploy/.env.production.example .env
  set_env() { # key value — replaces KEY=... in .env
    local key="$1" value="$2"
    value="${value//\\/\\\\}"; value="${value//&/\\&}"; value="${value//|/\\|}"
    sed -i "s|^${key}=.*|${key}=${value}|" .env
  }
  set_env WEB_ORIGIN "https://${DOMAIN}"
  set_env MOBILE_ORIGIN "https://${DOMAIN}"
  set_env POSTGRES_PASSWORD "$(openssl rand -hex 24)"
  set_env JWT_SECRET "$(openssl rand -base64 48 | tr -d '\n')"
  set_env ENCRYPTION_KEY "$(openssl rand -base64 32 | tr -d '\n')"
  set_env ADMIN_EMAIL "$ADMIN_EMAIL"
  set_env ADMIN_PASSWORD "$ADMIN_PASSWORD"
  set_env ADMIN_NAME "$ADMIN_NAME"
  set_env SMTP_FROM "ProjectFlow <no-reply@${DOMAIN}>"
  chmod 600 .env
fi

# ---------- build + start ----------
echo "==> Building and starting ProjectFlow (first build takes 5-15 minutes)"
docker compose -f docker-compose.prod.yml up -d --build

echo "==> Waiting for the API to become healthy"
for i in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:4000/health >/dev/null 2>&1; then echo "API is up"; break; fi
  sleep 5
done

# ---------- nginx ----------
echo "==> Configuring Nginx for ${DOMAIN}"
sed "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" deploy/nginx/projectflow.conf > /etc/nginx/sites-available/projectflow
ln -sf /etc/nginx/sites-available/projectflow /etc/nginx/sites-enabled/projectflow
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ---------- HTTPS ----------
echo "==> Requesting a free HTTPS certificate (the domain's DNS A record must already point here)"
if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$LE_EMAIL" --redirect; then
  echo "HTTPS enabled"
else
  echo "!! Certificate request failed — usually DNS isn't pointing at this server yet."
  echo "   Fix DNS, then run:  certbot --nginx -d ${DOMAIN} -m ${LE_EMAIL} --agree-tos --redirect"
fi

# ---------- daily backup ----------
chmod +x deploy/backup.sh deploy/update.sh
CRON_LINE="30 2 * * * ${REPO_DIR}/deploy/backup.sh >> /var/log/projectflow-backup.log 2>&1"
( crontab -l 2>/dev/null | grep -v 'projectflow.*backup.sh' ; echo "$CRON_LINE" ) | crontab -
echo "==> Daily backup scheduled at 02:30 (kept 14 days in /var/backups/projectflow)"

echo
echo "=============================================================="
echo " ProjectFlow is running:  https://${DOMAIN}"
echo " Log in as:               ${ADMIN_EMAIL}"
echo " Next: Admin → Notifications to set up and test Email/WhatsApp"
echo "       (fill SMTP_* / WHATSAPP_* in ${REPO_DIR}/.env, then run deploy/update.sh)"
echo "=============================================================="
