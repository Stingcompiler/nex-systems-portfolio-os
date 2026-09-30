#!/usr/bin/env bash
# يفعّل النشر الآلي مرة واحدة. يُشغَّل من جهازك (لا من الخادم) في جذر المستودع:
#
#   bash deploy/vps/setup-auto-deploy.sh ~/.ssh/ovh_vps_ed25519
#
# 1. يولّد مفتاح نشر جديدًا خاصًا بـ GitHub Actions
# 2. يثبّت على الخادم /usr/local/bin/stingdev-deploy (root) ويضيف المفتاح إلى
#    authorized_keys مقيّدًا بهذا الأمر وحده (restrict,command=…): لا طرفية،
#    ولا تمرير منافذ، ولا أي أمر آخر — حتى لو تسرّب المفتاح
# 3. يضع المفتاح وبصمة الخادم في أسرار المستودع ويفعّل VPS_DEPLOY
# 4. يحذف نسخة المفتاح الخاص من جهازك — تبقى في GitHub فقط
set -euo pipefail

ADMIN_KEY="${1:?usage: setup-auto-deploy.sh <your admin ssh key>}"
HOST=57.129.162.57
REPO=Stingcompiler/nex-systems-portfolio-os
cd "$(git rev-parse --show-toplevel)"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
ssh-keygen -q -t ed25519 -N "" -C "github-actions-stingdev-deploy" -f "$TMP/deploy"

echo "» installing the deploy command and restricted key on $HOST"
scp -q -i "$ADMIN_KEY" deploy/vps/stingdev-deploy "ubuntu@$HOST:/tmp/stingdev-deploy"
ssh -i "$ADMIN_KEY" "ubuntu@$HOST" "set -e
  sudo install -o root -g root -m 755 /tmp/stingdev-deploy /usr/local/bin/stingdev-deploy
  rm /tmp/stingdev-deploy
  cp -a ~/.ssh/authorized_keys ~/.ssh/authorized_keys.bak-\$(date -u +%Y%m%dT%H%M%SZ)
  sed -i '/github-actions-stingdev-deploy/d' ~/.ssh/authorized_keys
  echo 'restrict,command=\"/usr/local/bin/stingdev-deploy\" $(cat "$TMP/deploy.pub")' >> ~/.ssh/authorized_keys"

echo "» checking the key can only run the deploy command"
if ssh -i "$TMP/deploy" -o IdentitiesOnly=yes -o BatchMode=yes "ubuntu@$HOST" "whoami" 2>&1 | grep -q "usage: stingdev-deploy"; then
  echo "  ok: arbitrary commands are refused"
else
  echo "  ✗ the key is not restricted — stopping" >&2; exit 1
fi

echo "» saving GitHub secrets and enabling auto deploy"
gh secret set VPS_SSH_KEY --repo "$REPO" < "$TMP/deploy"
ssh-keyscan -t ed25519,ecdsa,rsa "$HOST" 2>/dev/null | gh secret set VPS_KNOWN_HOSTS --repo "$REPO"
gh variable set VPS_DEPLOY --repo "$REPO" --body true

echo "✓ done — every merge to main now builds and deploys to stingdev.pro"
