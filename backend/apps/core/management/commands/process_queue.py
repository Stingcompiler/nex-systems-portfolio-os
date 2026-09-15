"""يشغّل المُجدوِل ويُصفّي طابور django-q ثم يخرج — لتشغيله كـ Cron Job.

بديل لعملية `qcluster` الدائمة (~70MB) في بيئة لا تتحمّلها. يُستدعى كل
بضع دقائق: يُدرج المهام الدورية التي حان موعدها، يعالج كل ما في الطابور،
وينهي نفسه عندما يفرغ.

`qcluster --run-once` الجاهز لا يفي بالغرض: يوقف الكتلة فور بدئها، بينما
المُجدوِل لا يعمل إلا بعد 30 ثانية من التشغيل، فتبقى المهام الدورية بلا تنفيذ.
"""

import time

from django.core.management.base import BaseCommand
from django_q.brokers import get_broker
from django_q.cluster import Cluster, scheduler

#: ثوانٍ متتالية يكون فيها الطابور فارغًا قبل الخروج — تسمح للعامل بأخذ
#: آخر مهمة وتنفيذها، وللمهام التي تُدرج مهامًا أخرى بأن تلحق بالدورة نفسها
IDLE_SECONDS = 3


class Command(BaseCommand):
    help = "تشغيل المُجدوِل ومعالجة طابور المهام ثم الخروج (لـ Cron)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--max-seconds", type=int, default=240,
            help="سقف زمن التشغيل — أقل من فاصل الـ Cron كي لا تتراكب الدورات",
        )

    def handle(self, *args, **options):
        broker = get_broker()
        # المهام الدورية التي حان موعدها تُدرج في الطابور أولًا
        scheduler(broker=broker)

        cluster = Cluster()
        cluster.start()
        started = time.monotonic()
        idle = 0
        processed_hint = broker.queue_size()
        try:
            while time.monotonic() - started < options["max_seconds"]:
                if broker.queue_size() == 0:
                    idle += 1
                    if idle >= IDLE_SECONDS:
                        break
                else:
                    idle = 0
                time.sleep(1)
        finally:
            # الإيقاف ينتظر العامل حتى ينهي ما بيده، فلا تُقطع مهمة في منتصفها
            cluster.stop()

        self.stdout.write(
            f"اكتملت الدورة في {time.monotonic() - started:.0f} ثانية "
            f"(كان في الطابور {processed_hint} مهمة عند البدء)"
        )
