"""`runserver` مخصّص: يشغّل Django وNext.js معًا بأمر واحد.

الهدف: `python manage.py runserver` وحده يكفي لتشغيل المشروع كاملًا:
- Django على 8000، وNext.js على 3000 تلقائيًا (بلا `npm run dev` يدوي).
- فتح الصفحة الرئيسية في المتصفح بعد جاهزية الخادمين.
- إيقاف Next.js تلقائيًا عند إيقاف Django (Ctrl+C) — بلا عمليات Node يتيمة.

يرث من أمر staticfiles كي يحافظ على تقديم الملفات الثابتة في التطوير.

آلية التشغيل مع إعادة التحميل التلقائية في Django:
- عملية «الأصل» (المراقِب) تعيش طوال الجلسة ولا يُعاد تشغيلها عند تعديل الكود.
- تُعيد إنشاء عملية «الخادم» (RUN_MAIN=true) عند كل تغيير.
لذلك نُشغّل Next.js ونفتح المتصفح في «الأصل» فقط (RUN_MAIN غير مضبوط)، فلا
تتكرر عمليات Node ولا تُعاد فتح الصفحة عند كل إعادة تحميل.
"""

import atexit
import os
import shutil
import socket
import subprocess
import threading
import time
import webbrowser
from pathlib import Path

from django.conf import settings
from django.contrib.staticfiles.management.commands.runserver import (
    Command as StaticfilesRunserverCommand,
)

WEB_PORT = int(os.environ.get("WEB_PORT", "3000"))
API_PORT_DEFAULT = int(os.environ.get("API_PORT", "8000"))
WEB_URL = f"http://localhost:{WEB_PORT}"

FRONTEND_DIR = Path(settings.BASE_DIR).parent / "frontend"


def _port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    """هل يوجد شيء يستمع على المنفذ؟"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex((host, port)) == 0


class Command(StaticfilesRunserverCommand):
    help = "تشغيل Django مع تشغيل واجهة Next.js تلقائيًا في الخلفية"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._frontend_proc: subprocess.Popen | None = None

    def add_arguments(self, parser):
        super().add_arguments(parser)
        parser.add_argument(
            "--no-frontend",
            action="store_true",
            help="تشغيل Django وحده دون واجهة Next.js",
        )
        parser.add_argument(
            "--no-browser",
            action="store_true",
            help="عدم فتح المتصفح تلقائيًا",
        )

    def handle(self, *args, **options):
        # نُشغّل الواجهة ونفتح المتصفح في عملية «الأصل» فقط، لا عند كل إعادة تحميل.
        is_reloader_parent = os.environ.get("RUN_MAIN") != "true"

        if is_reloader_parent and not options.get("no_frontend"):
            self._preflight_ports(options)
            self._start_frontend()
            if not options.get("no_browser"):
                self._open_browser_when_ready()

        try:
            super().handle(*args, **options)
        finally:
            # يُنفَّذ عند الخروج (Ctrl+C) — يوقف Next.js وكل عملياته الفرعية.
            self._terminate_frontend()

    # ---------------------------------------------------------------- فحوص

    def _preflight_ports(self, options):
        """يمنع تعارض المنافذ قبل التشغيل برسائل واضحة."""
        # منفذ Django
        addrport = options.get("addrport") or ""
        api_port = API_PORT_DEFAULT
        if ":" in addrport:
            try:
                api_port = int(addrport.rsplit(":", 1)[1])
            except ValueError:
                pass
        elif addrport.isdigit():
            api_port = int(addrport)

        if _port_in_use(api_port):
            self.stderr.write(
                self.style.ERROR(
                    f"\n✖ المنفذ {api_port} (Django) مستخدم مسبقًا.\n"
                    f"  أوقف العملية التي تستخدمه أو شغّل على منفذ آخر:\n"
                    f"    python manage.py runserver {api_port + 1}\n"
                )
            )
            raise SystemExit(1)

    # ---------------------------------------------------------------- الواجهة

    def _start_frontend(self):
        """يشغّل Next.js في الخلفية بعد التحقق من المتطلبات."""
        # 1) مجلد الواجهة موجود وصحيح؟
        if not FRONTEND_DIR.exists() or not (FRONTEND_DIR / "package.json").exists():
            self.stderr.write(
                self.style.WARNING(
                    f"\n⚠ لم يُعثر على مشروع الواجهة في {FRONTEND_DIR}.\n"
                    "  سيعمل Django وحده. تأكد من هيكل المشروع (backend/ و frontend/).\n"
                )
            )
            return

        # 2) Node/npm مثبَّتان؟
        npm = shutil.which("npm") or shutil.which("npm.cmd")
        if not shutil.which("node") or not npm:
            self.stderr.write(
                self.style.WARNING(
                    "\n⚠ لم يُعثر على Node.js أو npm في PATH.\n"
                    "  ثبّت Node 20+ من https://nodejs.org ثم أعد التشغيل.\n"
                    "  سيعمل Django وحده الآن.\n"
                )
            )
            return

        # 3) الاعتماديات مثبَّتة؟
        if not (FRONTEND_DIR / "node_modules").exists():
            self.stderr.write(
                self.style.WARNING(
                    "\n⚠ لم يُعثر على node_modules في مجلد الواجهة.\n"
                    "  شغّل أولًا:\n"
                    f"    cd {FRONTEND_DIR}\n"
                    "    npm install\n"
                    "  سيعمل Django وحده الآن.\n"
                )
            )
            return

        # 4) المنفذ 3000 مستخدم؟ الأرجح أن الواجهة تعمل بالفعل — لا نشغّل نسخة ثانية.
        if _port_in_use(WEB_PORT):
            self.stdout.write(
                self.style.WARNING(
                    f"⚠ المنفذ {WEB_PORT} مستخدم — لن أشغّل نسخة ثانية من الواجهة "
                    "(قد تكون تعمل بالفعل)."
                )
            )
            return

        # على ويندوز npm هو ملف .cmd، ونشغّله في مجموعة عمليات مستقلة كي نتمكن
        # من إنهاء شجرة العمليات كاملة لاحقًا (npm يولّد Node كعملية فرعية).
        creationflags = 0
        if os.name == "nt":
            creationflags = subprocess.CREATE_NEW_PROCESS_GROUP

        try:
            self._frontend_proc = subprocess.Popen(
                [npm, "run", "dev"],
                cwd=str(FRONTEND_DIR),
                env={**os.environ, "PORT": str(WEB_PORT), "FORCE_COLOR": "1"},
                creationflags=creationflags,
            )
        except OSError as error:
            self.stderr.write(
                self.style.WARNING(f"⚠ تعذّر تشغيل الواجهة: {error}. سيعمل Django وحده.")
            )
            return

        atexit.register(self._terminate_frontend)
        self.stdout.write(
            self.style.SUCCESS(f"▸ الواجهة (Next.js) قيد التشغيل على {WEB_URL}")
        )

    def _terminate_frontend(self):
        proc = self._frontend_proc
        if proc is None or proc.poll() is not None:
            return
        self._frontend_proc = None  # تفادي الإنهاء المزدوج

        self.stdout.write("▸ إيقاف الواجهة…")
        try:
            if os.name == "nt":
                # taskkill /T يُنهي npm وكل عمليات Node الفرعية — يمنع اليتامى
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                    capture_output=True,
                )
            else:
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()
        except Exception:  # noqa: BLE001
            pass

    # ---------------------------------------------------------------- المتصفح

    def _open_browser_when_ready(self):
        """يفتح الصفحة الرئيسية بعد أن يصبح الخادمان جاهزين."""

        def wait_and_open():
            # ننتظر جاهزية الواجهة (3000) — هي التي تخدم الصفحة الرئيسية.
            deadline = time.time() + 90
            while time.time() < deadline:
                if _port_in_use(WEB_PORT):
                    # مهلة قصيرة إضافية حتى يكمل Next أول ترجمة
                    time.sleep(1.5)
                    try:
                        webbrowser.open(WEB_URL)
                    except Exception:  # noqa: BLE001
                        pass
                    return
                time.sleep(1)

        threading.Thread(target=wait_and_open, daemon=True).start()
