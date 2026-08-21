#!/usr/bin/env python
"""مشغّل المنصة الموحّد.

الواجهة والخلفية عمليتان تقنيًا، لكنهما وحدة واحدة من منظور التشغيل
والنشر والإعدادات. هذا الملف هو المدخل الوحيد لكل أمر:

    python run.py setup     تهيئة كاملة من الصفر
    python run.py dev       تشغيل كل شيء للتطوير
    python run.py check     كل الفحوصات والاختبارات
    python run.py build     بناء الإنتاج
    python run.py serve     تشغيل نسخة الإنتاج محليًا
    python run.py manage …  تمرير أمر إلى Django

لا يعتمد على أي حزمة خارجية — مكتبة بايثون القياسية فقط.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import threading
import time
from pathlib import Path

try:  # يمنع تشويه العربية في طرفية ويندوز
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:  # pragma: no cover
    pass

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
VENV = BACKEND / ".venv"
IS_WINDOWS = os.name == "nt"

API_PORT = int(os.environ.get("API_PORT", "8000"))
WEB_PORT = int(os.environ.get("WEB_PORT", "3000"))


# ---------------------------------------------------------------- أدوات

def venv_python() -> Path:
    return VENV / ("Scripts/python.exe" if IS_WINDOWS else "bin/python")


def npm_bin() -> str:
    found = shutil.which("npm")
    if not found:
        fail("لم يُعثر على npm في PATH. ثبّت Node.js أولًا.")
    return found


def info(message: str) -> None:
    print(f"\n▸ {message}", flush=True)


def api_is_up(port: int = API_PORT) -> bool:
    import socket

    with socket.socket() as probe:
        probe.settimeout(0.5)
        return probe.connect_ex(("127.0.0.1", port)) == 0


def wait_for_api(timeout: float = 45.0) -> bool:
    import urllib.error
    import urllib.request

    url = f"http://127.0.0.1:{API_PORT}/api/v1/health/"
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                if response.status == 200:
                    return True
        except (urllib.error.URLError, OSError):
            time.sleep(0.5)
    return False


def fail(message: str, code: int = 1) -> None:
    print(f"\n✖ {message}", file=sys.stderr, flush=True)
    raise SystemExit(code)


def ensure_venv() -> None:
    if not venv_python().exists():
        fail("البيئة الافتراضية غير موجودة. شغّل: python run.py setup")


def ensure_node_modules() -> None:
    if not (FRONTEND / "node_modules").exists():
        fail("اعتماديات الواجهة غير مثبّتة. شغّل: python run.py setup")


# ---------------------------------------------------------------- تنفيذ أمر واحد

def run(cmd: list[str], cwd: Path, label: str = "", check: bool = True) -> int:
    """ينفّذ أمرًا واحدًا ويعرض مخرجاته مباشرة."""
    if label:
        info(label)
    result = subprocess.run(cmd, cwd=str(cwd))
    if check and result.returncode != 0:
        fail(f"فشل الأمر: {' '.join(cmd)}", result.returncode)
    return result.returncode


# ---------------------------------------------------------------- تشغيل متوازٍ

class Managed:
    """عملية فرعية بمخرجات موسومة، تُنهى مع مجموعتها بالكامل."""

    def __init__(self, name: str, cmd: list[str], cwd: Path, env: dict | None = None):
        self.name = name
        self.cmd = cmd
        self.cwd = cwd
        self.env = env
        self.process: subprocess.Popen | None = None
        self.thread: threading.Thread | None = None

    def start(self) -> None:
        kwargs: dict = {
            "cwd": str(self.cwd),
            "stdout": subprocess.PIPE,
            "stderr": subprocess.STDOUT,
            "text": True,
            "bufsize": 1,
            "encoding": "utf-8",
            "errors": "replace",
            "env": {**os.environ, **(self.env or {})},
        }
        if IS_WINDOWS:
            kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
        else:
            kwargs["start_new_session"] = True

        self.process = subprocess.Popen(self.cmd, **kwargs)
        self.thread = threading.Thread(target=self._pump, daemon=True)
        self.thread.start()

    def _pump(self) -> None:
        assert self.process and self.process.stdout
        for line in self.process.stdout:
            print(f"[{self.name}] {line.rstrip()}", flush=True)

    def stop(self) -> None:
        """ينهي العملية وكل ذريتها.

        إنهاء `npm` وحده على ويندوز يترك Node يعمل يتيمًا، ولهذا نستخدم
        taskkill بشجرة العمليات كاملة.
        """
        if not self.process or self.process.poll() is not None:
            return
        try:
            if IS_WINDOWS:
                subprocess.run(
                    ["taskkill", "/PID", str(self.process.pid), "/T", "/F"],
                    capture_output=True,
                )
            else:
                os.killpg(os.getpgid(self.process.pid), 15)
        except Exception:
            self.process.kill()

    @property
    def alive(self) -> bool:
        return self.process is not None and self.process.poll() is None


def run_together(processes: list[Managed]) -> int:
    """يشغّل عدة عمليات معًا؛ سقوط إحداها يُنهي الباقي."""
    for managed in processes:
        managed.start()
        print(f"[{managed.name}] بدأ التشغيل", flush=True)

    exit_code = 0
    try:
        while True:
            time.sleep(0.4)
            for managed in processes:
                if not managed.alive:
                    code = managed.process.returncode if managed.process else 1
                    print(f"\n[{managed.name}] توقفت (رمز {code})", flush=True)
                    exit_code = code or 1
                    raise KeyboardInterrupt
    except KeyboardInterrupt:
        print("\n▸ إيقاف كل العمليات…", flush=True)
    finally:
        for managed in processes:
            managed.stop()
        for managed in processes:
            if managed.process:
                try:
                    managed.process.wait(timeout=8)
                except subprocess.TimeoutExpired:
                    managed.process.kill()
    return exit_code


# ---------------------------------------------------------------- الأوامر

def cmd_setup(args: argparse.Namespace) -> int:
    """تهيئة المشروع كاملًا من الصفر."""
    env_file = ROOT / ".env"
    if not env_file.exists():
        shutil.copyfile(ROOT / ".env.example", env_file)
        info("أُنشئ ملف .env من القالب — راجع قيمه قبل الإنتاج")

    if not venv_python().exists():
        run([sys.executable, "-m", "venv", str(VENV)], ROOT, "إنشاء البيئة الافتراضية")

    python = str(venv_python())
    run([python, "-m", "pip", "install", "--upgrade", "pip", "--quiet"], BACKEND,
        "تحديث pip")
    requirements = "requirements/prod.txt" if args.production else "requirements/dev.txt"
    run([python, "-m", "pip", "install", "-r", requirements], BACKEND,
        "تثبيت اعتماديات الخلفية")

    run([npm_bin(), "install", "--no-audit", "--no-fund"], FRONTEND,
        "تثبيت اعتماديات الواجهة")

    run([python, "manage.py", "migrate"], BACKEND, "تهيئة قاعدة البيانات")
    run([python, "manage.py", "seed_groups"], BACKEND, "إنشاء مجموعات الصلاحيات")
    if not args.no_seed:
        run([python, "manage.py", "seed_content"], BACKEND, "زرع المحتوى الأولي")

    print(
        "\n✔ اكتملت التهيئة."
        "\n  أنشئ حسابك:  python run.py manage createsuperuser"
        "\n  ثم شغّل:      python run.py dev\n"
    )
    return 0


def cmd_dev(args: argparse.Namespace) -> int:
    """تشغيل الخلفية والواجهة معًا بمخرجات موحّدة."""
    ensure_venv()
    ensure_node_modules()

    processes = [
        Managed(
            "api",
            # run.py يدير الواجهة بنفسه، فنمنع runserver المخصّص من تشغيلها مرة ثانية
            [str(venv_python()), "manage.py", "runserver", str(API_PORT),
             "--no-frontend", "--no-browser"],
            BACKEND,
            {"PYTHONUNBUFFERED": "1"},
        ),
        Managed("web", [npm_bin(), "run", "dev"], FRONTEND),
    ]

    # في التطوير تُنفَّذ المهام فورًا (Q_SYNC=True)، فلا حاجة للعامل
    # إلا عند اختبار السلوك الحقيقي للطابور.
    if args.worker:
        processes.append(
            Managed("worker", [str(venv_python()), "manage.py", "qcluster"], BACKEND,
                    {"Q_SYNC": "False"})
        )

    print(
        f"\n  الموقع            http://localhost:{WEB_PORT}"
        f"\n  توثيق الـ API     http://localhost:{WEB_PORT}/api/schema/swagger-ui/"
        f"\n  لوحة Django       http://localhost:{WEB_PORT}/admin/"
        f"\n  Django مباشرة     http://127.0.0.1:{API_PORT}/  (لوحة الإدارة على /admin/)"
        "\n  للإيقاف: Ctrl+C\n"
    )
    return run_together(processes)


def cmd_check(args: argparse.Namespace) -> int:
    """كل فحوصات الجودة في أمر واحد."""
    ensure_venv()
    ensure_node_modules()
    python = str(venv_python())
    schema_out = str(ROOT / "schema.yml")

    steps: list[tuple[str, list[str], Path]] = [
        ("فحوصات Django", [python, "manage.py", "check"], BACKEND),
        ("ترحيلات معلّقة", [python, "manage.py", "makemigrations", "--check", "--dry-run"], BACKEND),
        ("اختبارات الخلفية", [python, "-m", "pytest", "-q"], BACKEND),
        ("مخطط OpenAPI", [python, "manage.py", "spectacular", "--fail-on-warn",
                          "--file", schema_out], BACKEND),
        ("أنواع الواجهة", [npm_bin(), "run", "typecheck"], FRONTEND),
    ]

    results: list[tuple[str, bool]] = []
    for label, cmd, cwd in steps:
        code = run(cmd, cwd, label, check=False)
        results.append((label, code == 0))
        if code != 0 and args.fail_fast:
            break

    print("\n" + "─" * 46)
    for label, ok in results:
        print(f"  {'✔' if ok else '✖'}  {label}")
    print("─" * 46)

    failed = [label for label, ok in results if not ok]
    if failed:
        print(f"\n✖ فشل: {len(failed)} من {len(results)}\n")
        return 1
    print("\n✔ كل الفحوصات نجحت\n")
    return 0


def cmd_build(args: argparse.Namespace) -> int:
    """بناء نسخة الإنتاج من الطرفين.

    بناء الواجهة يستدعي الـ API فعليًا (توليد المسارات الثابتة والبيانات)،
    فيُشغَّل Django مؤقتًا إن لم يكن يعمل. بدون ذلك يخرج بناء صامت بصفحات
    فارغة، وهو أسوأ من فشل صريح.
    """
    ensure_venv()
    ensure_node_modules()

    run([str(venv_python()), "manage.py", "collectstatic", "--noinput"], BACKEND,
        "تجميع ملفات Django الثابتة")

    temporary_api: Managed | None = None
    if api_is_up():
        info(f"الـ API يعمل على المنفذ {API_PORT} — سيُستخدم كما هو")
    else:
        info("تشغيل الـ API مؤقتًا من أجل البناء")
        temporary_api = Managed(
            "api",
            [str(venv_python()), "manage.py", "runserver", str(API_PORT), "--noreload"],
            BACKEND,
            {"PYTHONUNBUFFERED": "1"},
        )
        temporary_api.start()
        if not wait_for_api():
            temporary_api.stop()
            fail("تعذّر تشغيل الـ API — لا يمكن بناء الواجهة بلا بيانات")

    try:
        code = run([npm_bin(), "run", "build"], FRONTEND, "بناء الواجهة", check=False)
    finally:
        if temporary_api is not None:
            temporary_api.stop()
            info("أُوقف الـ API المؤقت")

    if code != 0:
        fail("فشل بناء الواجهة", code)

    print("\n✔ اكتمل البناء\n")
    return 0


def cmd_serve(args: argparse.Namespace) -> int:
    """تشغيل نسخة الإنتاج محليًا للتحقق قبل النشر."""
    ensure_venv()
    if not (FRONTEND / ".next").exists():
        fail("لا يوجد بناء للواجهة. شغّل: python run.py build")

    python = str(venv_python())
    if IS_WINDOWS:
        # gunicorn لا يعمل على ويندوز؛ خادم التطوير كافٍ لمعاينة البناء محليًا.
        # --no-frontend مهم: serve يشغّل next start بنفسه، فنمنع runserver
        # المخصّص من تشغيل نسخة تطوير ثانية على المنفذ نفسه.
        api_cmd = [python, "manage.py", "runserver", str(API_PORT),
                   "--noreload", "--no-frontend", "--no-browser"]
        print("\n⚠ ويندوز: يُستخدم خادم Django التطويري للمعاينة فقط."
              " الإنتاج الحقيقي يعمل على Linux عبر gunicorn.\n")
    else:
        api_cmd = [
            str(VENV / "bin/gunicorn"), "config.wsgi:application",
            "--bind", f"127.0.0.1:{API_PORT}", "--workers", "3",
        ]

    processes = [
        Managed("api", api_cmd, BACKEND),
        Managed("web", [npm_bin(), "run", "start"], FRONTEND),
        Managed("worker", [python, "manage.py", "qcluster"], BACKEND, {"Q_SYNC": "False"}),
    ]
    print(f"\n  الموقع: http://localhost:{WEB_PORT}   (Ctrl+C للإيقاف)\n")
    return run_together(processes)


def cmd_manage(args: argparse.Namespace) -> int:
    """تمرير أمر مباشر إلى Django."""
    ensure_venv()
    return run([str(venv_python()), "manage.py", *args.args], BACKEND, check=False)


def cmd_test(args: argparse.Namespace) -> int:
    ensure_venv()
    return run([str(venv_python()), "-m", "pytest", *args.args], BACKEND, check=False)


# ---------------------------------------------------------------- المدخل

def main() -> int:
    parser = argparse.ArgumentParser(
        prog="run.py",
        description="مشغّل منصة stingdev الموحّد",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    setup = subparsers.add_parser("setup", help="تهيئة كاملة من الصفر")
    setup.add_argument("--production", action="store_true", help="تثبيت اعتماديات الإنتاج")
    setup.add_argument("--no-seed", action="store_true", help="تخطي زرع المحتوى")
    setup.set_defaults(func=cmd_setup)

    dev = subparsers.add_parser("dev", help="تشغيل كل شيء للتطوير")
    dev.add_argument("--worker", action="store_true", help="تشغيل عامل المهام الخلفية أيضًا")
    dev.set_defaults(func=cmd_dev)

    check = subparsers.add_parser("check", help="كل الفحوصات والاختبارات")
    check.add_argument("--fail-fast", action="store_true", help="التوقف عند أول فشل")
    check.set_defaults(func=cmd_check)

    build = subparsers.add_parser("build", help="بناء الإنتاج")
    build.set_defaults(func=cmd_build)

    serve = subparsers.add_parser("serve", help="تشغيل نسخة الإنتاج محليًا")
    serve.set_defaults(func=cmd_serve)

    manage = subparsers.add_parser("manage", help="تمرير أمر إلى Django")
    manage.add_argument("args", nargs=argparse.REMAINDER)
    manage.set_defaults(func=cmd_manage)

    test = subparsers.add_parser("test", help="اختبارات الخلفية")
    test.add_argument("args", nargs=argparse.REMAINDER)
    test.set_defaults(func=cmd_test)

    parsed = parser.parse_args()
    return parsed.func(parsed)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        raise SystemExit(130)
