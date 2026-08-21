# النشر

المنصة **وحدة نشر واحدة**: أمر واحد يشغّلها، وأمر واحد يوقفها، وكتلة Nginx واحدة أمام العالم. عمليتان خلف الكواليس (Django وNext.js) وعامل مهام، تُدار كلها بـ `stingdev.target`.

بلا Docker.

## المتطلبات على الخادم

Ubuntu 22.04+ · Python 3.12+ · Node.js 20+ · Nginx · Git
و`postgresql-client` أو `sqlite3` حسب قاعدة البيانات المختارة.

## التركيب لأول مرة

```bash
sudo adduser --system --group --home /srv/stingdev stingdev
sudo git clone <repo> /srv/stingdev
cd /srv/stingdev
sudo chown -R stingdev:stingdev /srv/stingdev

sudo -u stingdev cp .env.example .env
sudo -u stingdev nano .env          # SECRET_KEY و ALLOWED_HOSTS و البريد وقاعدة البيانات

sudo -u stingdev python3 run.py setup --production
sudo -u stingdev python3 run.py manage createsuperuser
sudo -u stingdev python3 run.py build
```

### خدمات systemd

```bash
sudo cp deploy/systemd/*.service deploy/systemd/*.target /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now stingdev.target
sudo systemctl status 'stingdev-*'
```

### Nginx وشهادة SSL

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/stingdev
sudo ln -s /etc/nginx/sites-available/stingdev /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d stingdev.com -d www.stingdev.com
```

### النسخ الاحتياطي

```bash
sudo chmod +x deploy/*.sh
sudo crontab -e
# 0 3 * * * /srv/stingdev/deploy/backup.sh >> /var/log/stingdev-backup.log 2>&1
```

## التحديثات اللاحقة

```bash
cd /srv/stingdev && ./deploy/deploy.sh
```

يسحب التغييرات، ويأخذ نسخة احتياطية، ويرحّل، ويبني، ويعيد التشغيل، ثم يتحقق من الصحة.

## التشغيل والمراقبة

| الغرض | الأمر |
|---|---|
| تشغيل الكل | `sudo systemctl start stingdev.target` |
| إيقاف الكل | `sudo systemctl stop stingdev.target` |
| إعادة تشغيل الكل | `sudo systemctl restart stingdev.target` |
| الحالة | `sudo systemctl status 'stingdev-*'` |
| السجلات الحية | `sudo journalctl -u 'stingdev-*' -f` |
| فحص الصحة | `curl -fsS https://stingdev.com/api/v1/health/` |

## توزيع المسارات

```
stingdev.com/              →  Next.js   (127.0.0.1:3000)
stingdev.com/api/          →  Django    (127.0.0.1:8000)
stingdev.com/django-admin/ →  Django    (للطوارئ فقط)
stingdev.com/static/       →  ملفات على القرص
stingdev.com/media/        →  ملفات على القرص
```

المتصفح يرى نطاقًا واحدًا: لا CORS، ولا نطاق فرعي، والكوكيز HttpOnly تعمل بـ `SameSite=Lax` بلا استثناءات.

## قبل أول نشر حقيقي

- [ ] `SECRET_KEY` جديد وطويل — لا القيمة الافتراضية.
- [ ] `DEBUG=False` و`ALLOWED_HOSTS` بالنطاق الحقيقي.
- [ ] `COOKIE_SECURE=True` و`CSRF_TRUSTED_ORIGINS` بنطاق HTTPS.
- [ ] `NEXT_PUBLIC_SITE_URL` و`FRONTEND_URL` بالنطاق الحقيقي.
- [ ] SPF و DKIM و DMARC مضبوطة قبل تفعيل النشرة البريدية.
- [ ] النسخ الاحتياطي **مُختبَر بالاسترجاع** لا بالإنشاء فقط.
- [ ] عند اعتماد SQLite: عمّال Gunicorn ≤ 3 وعامل مهام واحد.
