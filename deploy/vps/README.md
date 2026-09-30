# النشر على الخادم الخاص (OVHcloud VPS)

الخادم يستضيف عدة مواقع، فكل موقع يتبع النمط نفسه:

```
/srv/apps/<app>/              المستودع + deploy/vps/.env
/srv/backups/<app>/           النسخ الليلية
/etc/caddy/Caddyfile          سطر واحد: import sites/*.caddy
/etc/caddy/sites/<app>.caddy  النطاق → 127.0.0.1:<منفذ>
/srv/apps/PORTS.md            سجل المنافذ — منفذ لكل موقع
```

**لا بناء على الخادم.** GitHub Actions (`.github/workflows/image.yml`) يبني
الصورة مع كل دمج في main ويدفعها إلى
`ghcr.io/stingcompiler/nex-systems-portfolio-os`. الخادم يسحبها فقط، فلا
يسرق البناء المعالج من المواقع الأخرى، ولا دقائق بناء مدفوعة.

| الخدمة | الدور | حد الذاكرة |
|---|---|---|
| app | Next.js + Django (الصورة نفسها التي على Render) | 900MB |
| worker | django-q دائم: البريد وإشعارات PWA فورًا | 350MB |
| db | PostgreSQL 18 | 300MB |

## التركيب لأول مرة

```bash
sudo mkdir -p /srv/apps/stingdev /srv/backups/stingdev && sudo chown ubuntu: /srv/apps/stingdev
git clone https://github.com/Stingcompiler/nex-systems-portfolio-os.git /srv/apps/stingdev
cd /srv/apps/stingdev/deploy/vps
cp .env.example .env && chmod 600 .env && nano .env      # القيم من بيئة Render
sudo docker compose pull
sudo docker compose up -d db
```

### نقل قاعدة البيانات من Render

رابط القاعدة من لوحة Render (قاعدة البيانات ← Connections ← External
Database URL). يُكتب في الطرفية مباشرة لا في ملف:

```bash
read -rsp "Render DB URL: " RENDER_DB_URL; echo
sudo docker compose exec -T db pg_dump "$RENDER_DB_URL" -Fc --no-owner --no-acl > /srv/backups/stingdev/from-render.dump
sudo docker compose exec -T db pg_restore -U stingdev -d stingdev --no-owner --no-acl < /srv/backups/stingdev/from-render.dump
unset RENDER_DB_URL
sudo docker compose up -d
```

### نقل الملفات المرفوعة

```bash
sudo docker compose exec app python /app/deploy/vps/pull_media.py https://stingdev.pro
```

### Caddy

```bash
sudo cp stingdev.caddy /etc/caddy/sites/
sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
```

جرّب على `https://stingdev.57-129-162-57.sslip.io` قبل تحويل DNS.

### النسخ الليلية

```bash
sudo cp stingdev-backup.service stingdev-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now stingdev-backup.timer
sudo systemctl start stingdev-backup.service && ls -lh /srv/backups/stingdev
```

## التحويل من Render

1. خفّض TTL سجلات DNS لـ stingdev.pro إلى 300 ثانية قبل يوم.
2. أعد نقل قاعدة البيانات والملفات (الخطوتان أعلاه) لالتقاط آخر التغييرات.
3. أضف `stingdev.pro, www.stingdev.pro` إلى سطر النطاق في
   `/etc/caddy/sites/stingdev.caddy` وأعد تحميل Caddy، واضبط `COOKIE_DOMAIN`
   في `.env` كما كان على Render ثم `sudo docker compose up -d`.
4. وجّه سجلَّي A لـ stingdev.pro وwww إلى `57.129.162.57`.
5. بعد يومين بلا مشاكل: أوقف خدمة Render وCron Job الخاص بها.

## التحديثات

**آليًا:** كل دمج في main → GitHub يبني الصورة `sha-<commit>` → يتصل بالخادم
بمفتاح نشر لا يشغّل إلا `/usr/local/bin/stingdev-deploy` → يسحب تلك الصورة
بالضبط ويعيد التشغيل وينتظر فحص الصحة (≈10 ثوانٍ) → يتحقق من stingdev.pro.
فشل أي خطوة يُفشل المهمة في GitHub Actions، والنسخة السابقة تبقى إن لم تصح الجديدة.

التفعيل مرة واحدة من جهازك (يولّد المفتاح ويقيّده ويضبط أسرار المستودع):

```bash
bash deploy/vps/setup-auto-deploy.sh ~/.ssh/ovh_vps_ed25519
```

الإيقاف: `gh variable set VPS_DEPLOY --body false`. سحب المفتاح: احذف سطر
`github-actions-stingdev-deploy` من `~/.ssh/authorized_keys` على الخادم.

**ما لا ينشره الآلي عمدًا:** تغييرات `compose.yml` و`stingdev-deploy` نفسه —
يعملان بـ sudo، فيبقى تحديثهما خطوة يدوية لا يملكها كل من يدمج في main:

```bash
cd /srv/apps/stingdev && git pull
sudo install -m 755 deploy/vps/stingdev-deploy /usr/local/bin/   # إن تغيّر
cd deploy/vps && sudo docker compose up -d
```

**الرجوع إلى نسخة سابقة:** `stingdev-deploy <sha الالتزام>` على الخادم.

## النسخ خارج الخادم

النسخ في `/srv/backups` لا تنجو من فقدان الخادم. انسخها دوريًا إلى
OVH Object Storage أو Backblaze B2 (مثلًا `rclone sync /srv/backups remote:vps-backups`).
