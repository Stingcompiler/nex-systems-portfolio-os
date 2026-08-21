"""يزرع محتوى المدونة الأولي.

المقالات هنا حقيقية وموضوعية تعكس خبرة صاحب المنصة الفعلية (تحليل النظم،
Django، Next.js)، لا نصوصًا ملفَّقة. تتجاوز الحد الأدنى للنشر عمدًا.
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.blog.models import Category, Post, Tag

CATEGORIES = [
    ("systems-analysis", "تحليل وتصميم النظم", "Systems Analysis & Design",
     "مقالات عن تحليل المتطلبات وتصميم قواعد البيانات ومعمارية الأنظمة.", "#2563EB"),
    ("web-development", "تطوير الويب", "Web Development",
     "Django وNext.js وبناء تطبيقات ويب قابلة للتوسع.", "#06B6D4"),
    ("mobile", "تطبيقات الموبايل", "Mobile Development",
     "React Native وExpo وبناء تطبيقات عبر المنصات.", "#10B981"),
]

TAGS = [
    ("django", "Django"), ("nextjs", "Next.js"), ("database", "قواعد البيانات"),
    ("erd", "ERD"), ("api", "REST API"), ("arabic", "دعم العربية"),
    ("performance", "الأداء"), ("architecture", "المعمارية"),
]

POSTS = [
    {
        "slug": "why-analysis-before-code",
        "category": "systems-analysis",
        "tags": ["erd", "database", "architecture"],
        "title_ar": "لماذا يبدأ المشروع الناجح بالتحليل لا بالكود؟",
        "title_en": "Why a Successful Project Starts with Analysis, Not Code",
        "excerpt_ar": (
            "أكثر ما يُفشل المشاريع البرمجية ليس ضعف البرمجة، بل البدء بالتنفيذ "
            "قبل فهم المشكلة. في هذا المقال أشرح لماذا تسبق جلسة التحليل أول سطر كود."
        ),
        "excerpt_en": (
            "What sinks software projects is rarely weak coding — it is building "
            "before understanding the problem."
        ),
        "content_ar": (
            "حين يطلب عميل نظامًا لإدارة مدرسته، تكون رغبته الأولى أن يرى شاشات "
            "تعمل بأسرع وقت. وهذا مفهوم، لكنه بالضبط ما يقود كثيرًا من المشاريع إلى "
            "الفشل. الكود الذي يُكتب قبل فهم المشكلة يُعاد كتابته لاحقًا بتكلفة "
            "أضعاف ما كان سيكلفه لو بدأنا بالتحليل.\n\n"
            "التحليل ليس رفاهية ولا تأخيرًا. هو الخطوة التي نحدد فيها من هم "
            "المستخدمون الفعليون وأدوارهم، وما العمليات التي يقوم بها كل دور، وما "
            "البيانات التي يحتاجها النظام لتنفيذها. من هذه الإجابات يُولد مخطط قاعدة "
            "البيانات (ERD) وخريطة الشاشات، وهما العقد الحقيقي بيني وبين العميل قبل "
            "أن أكتب حرفًا واحدًا من الكود.\n\n"
            "خذ مثالًا بسيطًا: نظام مدرسة. سؤال واحد مثل «هل تُدفع الرسوم دفعة واحدة "
            "أم على أقساط؟» يغيّر تصميم قاعدة البيانات كليًا. لو بنيت الجدول على "
            "افتراض الدفعة الواحدة ثم اكتشفت لاحقًا حاجة الأقساط، فأنا أمام إعادة "
            "هيكلة مؤلمة تمسّ كل تقرير مالي في النظام. جلسة تحليل من ساعتين كانت "
            "ستكشف هذا مقدمًا.\n\n"
            "لهذا أقدّم التحليل كخدمة مستقلة يمكن أن يبدأ بها العميل وحده. المخرج "
            "وثيقة متطلبات ومخططات UML وERD يملكها العميل، وينفذها معي أو مع أي "
            "فريق آخر. كثيرون يبدؤون بها ليعرفوا الحجم الحقيقي لمشروعهم قبل أن "
            "يلتزموا بأي ميزانية — وهذا قرار حكيم يوفّر عليهم كثيرًا لاحقًا."
        ),
        "content_en": (
            "When a client asks for a system to run their school, their first wish "
            "is to see working screens as fast as possible. That is understandable "
            "— and it is exactly what drives many projects into failure. Code "
            "written before the problem is understood gets rewritten later at "
            "several times the original cost.\n\n"
            "Analysis is not a luxury or a delay. It is the step where we define who "
            "the real users are, what each does, and what data the system needs. "
            "From those answers come the database ERD and the screen map — the real "
            "contract between me and the client before a single line of code.\n\n"
            "The deliverable is a requirements document with UML and ERD diagrams "
            "the client owns. Many start with this alone, to learn the true size of "
            "their project before committing a budget."
        ),
        "featured": True,
    },
    {
        "slug": "arabic-search-that-actually-works",
        "category": "web-development",
        "tags": ["database", "arabic", "django", "performance"],
        "title_ar": "بحث عربي يعمل فعلًا: التطبيع قبل الفهرسة",
        "title_en": "Arabic Search That Actually Works: Normalize Before You Index",
        "excerpt_ar": (
            "لماذا لا يجد البحث عن «الامارات» كلمة «الإمارات»؟ وكيف نبني بحثًا عربيًا "
            "يتجاهل الهمزات والتشكيل ويعمل على أي قاعدة بيانات؟"
        ),
        "excerpt_en": (
            "Why doesn't searching for 'Alamarat' find 'Al-Imarat'? And how do we "
            "build Arabic search that ignores hamzas and diacritics?"
        ),
        "content_ar": (
            "من أكثر الشكاوى تكرارًا في المواقع العربية أن البحث «لا يجد شيئًا». "
            "المستخدم يكتب «الامارات» بألف عادية، بينما المحتوى مخزَّن بـ «الإمارات» "
            "بهمزة قطع، فلا يتطابقان. المشكلة ليست في المستخدم بل في أننا نطلب من "
            "قاعدة البيانات مطابقة حرفية لنص كتبه بشر لا يميّزون بين أشكال الهمزة.\n\n"
            "الحل الذي أعتمده لا يعتمد على أي محلل لغوي خاص بمحرك قاعدة بيانات بعينه، "
            "فيعمل بنفس النتيجة على SQLite وPostgreSQL. الفكرة بسيطة: نطبّع النص قبل "
            "تخزينه وقبل البحث فيه. التطبيع يوحّد أشكال الهمزة (أ، إ، آ، ا) إلى ألف "
            "واحدة، ويحوّل التاء المربوطة إلى هاء، والألف المقصورة إلى ياء، ويحذف "
            "التشكيل والتطويل، ويوحّد الأرقام.\n\n"
            "عمليًا: عند حفظ أي مقال أو مشروع، نمرّر عنوانه ومحتواه على دالة تطبيع "
            "ونخزّن الناتج في عمود مخصص للبحث. وعند بحث المستخدم، نمرّر كلمته على "
            "نفس الدالة قبل الاستعلام. النتيجة أن «الامارات» و«الإمارات» و«الأمارات» "
            "تتحول جميعها إلى نص واحد، فيتطابق البحث بغض النظر عن شكل الهمزة التي "
            "كتبها المستخدم.\n\n"
            "هذه الدالة لا تتجاوز بضعة أسطر، لكنها الفرق بين بحث يبدو معطّلًا وبحث "
            "يبدو ذكيًا. وهي مثال على قاعدة أتبعها دائمًا: لا تعتمد على ميزة خاصة "
            "بمحرك واحد ما دام حلّ بسيط ومحايد يؤدي الغرض."
        ),
        "content_en": (
            "A common complaint on Arabic sites is that search 'finds nothing'. The "
            "user types one hamza form while the content is stored with another, so "
            "they never match. The problem is not the user — it is asking the "
            "database for a literal match on text written by humans who do not "
            "distinguish hamza shapes.\n\n"
            "My approach relies on no engine-specific analyzer, so it works "
            "identically on SQLite and PostgreSQL. We normalize text before storing "
            "and before searching: unify hamza forms, convert taa marbuta to haa, "
            "strip diacritics and tatweel. The result: all spellings collapse to one "
            "searchable form, and the match works regardless of how the user typed it."
        ),
        "featured": True,
    },
]


class Command(BaseCommand):
    help = "زرع محتوى المدونة الأولي (متكرر التنفيذ بأمان)"

    @transaction.atomic
    def handle(self, *args, **options):
        categories = {}
        for order, (slug, name_ar, name_en, desc, color) in enumerate(CATEGORIES):
            category, _ = Category.objects.update_or_create(
                slug=slug,
                defaults={
                    "name_ar": name_ar, "name_en": name_en,
                    "description_ar": desc, "color": color,
                    "display_order": order, "is_active": True,
                },
            )
            categories[slug] = category
        self.stdout.write(f"  التصنيفات: {len(categories)}")

        tags = {}
        for slug, name_ar in TAGS:
            tag, _ = Tag.objects.update_or_create(
                slug=slug, defaults={"name_ar": name_ar}
            )
            tags[slug] = tag
        self.stdout.write(f"  الوسوم: {len(tags)}")

        for order, data in enumerate(POSTS):
            post, _ = Post.objects.update_or_create(
                slug=data["slug"],
                defaults={
                    "title_ar": data["title_ar"], "title_en": data["title_en"],
                    "excerpt_ar": data["excerpt_ar"], "excerpt_en": data["excerpt_en"],
                    "content_ar": data["content_ar"], "content_en": data["content_en"],
                    "category": categories[data["category"]],
                    "status": Post.Status.PUBLISHED,
                    "published_at": timezone.now(),
                    "is_featured": data.get("featured", False),
                },
            )
            post.tags.set([tags[slug] for slug in data["tags"] if slug in tags])
        self.stdout.write(f"  المقالات المنشورة: {len(POSTS)}")

        # تحقق: كل منشور يستوفي الحد الأدنى
        from apps.blog.serializers import _publication_blockers

        for post in Post.objects.filter(status=Post.Status.PUBLISHED):
            problems = _publication_blockers(post)
            if problems:
                self.stdout.write(self.style.ERROR(f"  ✗ {post.slug}: {problems[0]}"))
                raise SystemExit(1)

        self.stdout.write(self.style.SUCCESS("اكتمل زرع محتوى المدونة."))
