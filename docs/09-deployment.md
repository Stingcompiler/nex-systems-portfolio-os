# النشر على الإنتاج

نشر تقليدي على VPS واحد — بلا Docker. المكوّنات: Nginx (عكسي + SSL) →
Gunicorn (Django) + Node/npm (Next.js) + django-q2 (المهام)، وقاعدة بيانات
PostgreSQL أو SQLite.

## المخطط

```
الإنترنت → Nginx :443 (SSL)
             ├── /api/     → Gunicorn 127.0.0.1:8000 (Django)
             ├── /admin/   → Gunicorn (لوحة إدارة Django)
             ├── /static/  → ملفات مباشرة
             ├── /media/   → ملفات مباشرة
             └── /         → Next.js 127.0.0.1:3000
```

## المتطلبات المسبقة

- خادم Ubuntu 22.04+ ونطاق موجّه إليه.
- **حُسم مسار الدفع والاستضافة عبر مصدر خارج السودان** (المخاطرة #12).
- Python 3.12، Node 20، Nginx، وPostgreSQL (إن اختير).

## الخطوات

### 1. المستخدم والمجلدات

```bash
sudo useradd -r -m -d /srv/stingdev stingdev
sudo mkdir -p /srv/stingdev /srv/backups/stingdev
# انسخ المستودع إلى /srv/stingdev، ثم:
sudo chown -R stingdev:stingdev /srv/stingdev
```

### 2. البيئة

```bash
cd /srv/stingdev
cp deploy/.env.prod.example .env
# عبّئ المفاتيح: SECRET_KEY, DB_*, EMAIL_*, REVALIDATE_SECRET
```

مصدر واحد لكل الإعدادات: `/srv/stingdev/.env`. الواجهة تقرأ منه المفاتيح العامة فقط، والأسرار لا تدخل عملية Node.

### 3. الـ Backend

```bash
cd /srv/stingdev/backend
python3.12 -m venv .venv
.venv/bin/pip install -r requirements/prod.txt
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_groups        # المجموعات + المهام الدورية
.venv/bin/python manage.py seed_content        # المحتوى الأولي الحقيقي
.venv/bin/python manage.py seed_blog
.venv/bin/python manage.py collectstatic --noinput
.venv/bin/python manage.py createsuperuser
mkdir -p logs
```

### 4. الواجهة

```bash
cd /srv/stingdev/frontend
npm ci
npm run build     # يحتاج الـ API يعمل لتوليد الصفحات الثابتة
```

> شغّل الـ API مؤقتًا أثناء البناء أول مرة، أو استخدم `python run.py build` الذي يتولّى ذلك.

### 5. الخدمات (systemd)

```bash
sudo cp deploy/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now stingdev-api stingdev-web stingdev-worker
sudo systemctl status stingdev-api
```

### 6. Nginx و SSL

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/stingdev
sudo ln -s /etc/nginx/sites-available/stingdev /etc/nginx/sites-enabled/
sudo certbot --nginx -d stingdev.com -d www.stingdev.com
sudo nginx -t && sudo systemctl reload nginx
```

### 7. النسخ الاحتياطي

```bash
chmod +x deploy/backup.sh
sudo crontab -u stingdev -e
# أضف:  0 3 * * *  /srv/stingdev/deploy/backup.sh
```

اختبر الاسترجاع فعليًا مرة واحدة — نسخة احتياطية غير مُختبَرة ليست نسخة.

## قائمة التحقق بعد النشر

- [ ] `https://stingdev.com` يفتح، وشهادة SSL صالحة.
- [ ] `https://stingdev.com/admin/` تعمل لوحة الإدارة.
- [ ] `https://stingdev.com/api/v1/health/` تُرجع `ok`.
- [ ] تسجيل عضو يصله بريد التحقق (يتطلب SPF/DKIM/DMARC مضبوطة).
- [ ] طلب مشروع يصل لوحة التحكم كـ Lead.
- [ ] `sitemap.xml` و`robots.txt` صحيحان.
- [ ] Lighthouse ≥ 90 على الهاتف.
- [ ] النسخ الاحتياطي يعمل ومُختبَر بالاسترجاع.
- [ ] `django-q2` يعمل (المهام الدورية مجدولة عبر `seed_groups`).

## الأداء والأمان (مطبَّقان)

**الأداء:**
- استعلامات القراءة العامة ثابتة العدد (4–7) بلا N+1.
- `Cache-Control: public, max-age=300` على استجابات القراءة العامة → تخزين المتصفح وNginx.
- توليد ثابت (SSG) + إعادة تحقق موجَّهة (ISR) للصفحات العامة.
- خطوط مستضافة ذاتيًا، صور `next/image` بصيغ WebP/AVIF، تقسيم الحزم.
- gzip في Nginx، وأصول `_next/static` مُبصَّمة بصلاحية طويلة.

**الأمان:**
- HTTPS إلزامي + HSTS، وكوكيز `Secure HttpOnly SameSite=Lax`.
- JWT بالتدوير والقائمة السوداء، وحماية CSRF على الكوكيز.
- تحديد المعدل على الدخول والتسجيل والنماذج العامة.
- تحقق الملفات بالبايتات، وتعقيم SVG، ومنع تنفيذ الوسائط في Nginx.
- ست طبقات مكافحة سبام للتعليقات.
- سجل تدقيق لكل كتابة، وترويسات `nosniff` و`X-Frame-Options: DENY`.
- تحليلات بلا IP خام ولا كوكيز تتبّع.

## التحليلات الخارجية (اختياري)

الإحصائيات الداخلية كافية للبدء. لتحليلات أعمق، اضبط `analytics_provider`
و`analytics_script_url` في إعدادات الموقع (Umami أو Plausible مستضاف ذاتيًا
كحاوية إضافية) — دون التخلي عن الإحصائيات الداخلية.
