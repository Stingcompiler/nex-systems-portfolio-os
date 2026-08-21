"""يزرع بيانات تجريبية لملء لوحة التحكم وواجهات CRM والسيرة الذاتية.

يُنفَّذ بعد seed_content وseed_blog لأنه يربط بياناته بالمشاريع والمقالات
والخدمات الموجودة. آمن التكرار (idempotent).
"""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.blog.models import Post
from apps.comments.models import Comment
from apps.core.models.content import Stat
from apps.core.models.settings import SocialLink
from apps.crm.enums import (
    BudgetRange,
    ContactStatus,
    FollowUpStatus,
    InteractionDirection,
    InteractionType,
    LeadSource,
    LeadStatus,
    Priority,
    RequestProjectType,
    RequestStatus,
    Timeline,
)
from apps.crm.models import (
    Client,
    ContactMessage,
    CrmNote,
    FollowUp,
    Interaction,
    Lead,
    ProjectRequest,
)
from apps.portfolio.models import Service, Testimonial
from apps.portfolio.models.resume import Certification, Education, Experience

now = timezone.now
today = timezone.localdate


# ---------------------------------------------------------------  CRM

LEADS = [
    {
        "name": "أحمد محمد علي",
        "company": "شركة النيل للتقنية",
        "email": "ahmed@niletech.sd",
        "phone": "+249912345678",
        "country": "SD",
        "city": "الخرطوم",
        "source": LeadSource.WEBSITE_FORM,
        "status": LeadStatus.NEGOTIATING,
        "priority": Priority.HIGH,
        "expected_budget": "5000$ – 10000$",
        "notes": "يريد نظام إدارة مدرسة مع تطبيق موبايل للأولياء.",
    },
    {
        "name": "فاطمة عبدالله",
        "company": "مركز الإبداع التعليمي",
        "email": "fatima@ibdaa.edu",
        "phone": "+249900112233",
        "country": "SD",
        "city": "أم درمان",
        "source": LeadSource.REFERRAL,
        "status": LeadStatus.PROPOSAL_SENT,
        "priority": Priority.MEDIUM,
        "expected_budget": "2000$ – 5000$",
        "notes": "تحتاج منصة تعليم إلكتروني للدورات القصيرة.",
    },
    {
        "name": "خالد يوسف",
        "company": "صيدليات الشفاء",
        "email": "khalid@alshifa.com",
        "phone": "+249911223344",
        "country": "SD",
        "city": "بحري",
        "source": LeadSource.WHATSAPP,
        "status": LeadStatus.CONTACTED,
        "priority": Priority.MEDIUM,
        "expected_budget": "2000$ – 5000$",
    },
    {
        "name": "سارة حسن",
        "email": "sarah@gmail.com",
        "phone": "+971501234567",
        "country": "AE",
        "city": "دبي",
        "source": LeadSource.SOCIAL,
        "status": LeadStatus.NEW,
        "priority": Priority.LOW,
        "expected_budget": "500$ – 2000$",
    },
    {
        "name": "محمد إبراهيم",
        "company": "مطاعم الخرطوم",
        "email": "ibrahim@krt-restaurants.com",
        "phone": "+249922334455",
        "country": "SD",
        "city": "الخرطوم",
        "source": LeadSource.DIRECT,
        "status": LeadStatus.WAITING,
        "priority": Priority.HIGH,
        "expected_budget": "5000$ – 10000$",
        "notes": "يدير 3 فروع ويحتاج نظام نقاط بيع موحّد.",
    },
]

PROJECT_REQUESTS = [
    {
        "project_type": RequestProjectType.SYSTEM,
        "sector": "education",
        "name": "أحمد محمد علي",
        "email": "ahmed@niletech.sd",
        "phone": "+249912345678",
        "company": "شركة النيل للتقنية",
        "country": "SD",
        "description": "نحتاج نظام متكامل لإدارة مدرسة ابتدائية: تسجيل، حضور، درجات، رسوم.",
        "budget_range": BudgetRange.R_5K_10K,
        "timeline": Timeline.MEDIUM,
        "requirements": {
            "marketing_site": True,
            "dashboard": True,
            "members": True,
            "blog": False,
            "store": False,
            "pwa": True,
        },
        "status": RequestStatus.REVIEWED,
    },
    {
        "project_type": RequestProjectType.WEBSITE,
        "sector": "general",
        "name": "فاطمة عبدالله",
        "email": "fatima@ibdaa.edu",
        "phone": "+249900112233",
        "company": "مركز الإبداع التعليمي",
        "country": "SD",
        "description": "موقع تعريفي للمركز مع صفحة تسجيل في الدورات.",
        "budget_range": BudgetRange.R_2K_5K,
        "timeline": Timeline.SHORT,
        "requirements": {
            "marketing_site": True,
            "dashboard": True,
            "members": False,
            "blog": True,
        },
        "status": RequestStatus.PROPOSAL_SENT,
    },
    {
        "project_type": RequestProjectType.SYSTEM,
        "sector": "restaurants",
        "name": "محمد إبراهيم",
        "email": "ibrahim@krt-restaurants.com",
        "phone": "+249922334455",
        "company": "مطاعم الخرطوم",
        "country": "SD",
        "description": "نظام نقاط بيع لثلاثة فروع مع لوحة مركزية للإدارة.",
        "budget_range": BudgetRange.R_5K_10K,
        "timeline": Timeline.MEDIUM,
        "requirements": {
            "dashboard": True,
            "store": True,
            "pwa": True,
        },
        "status": RequestStatus.NEW,
    },
    {
        "project_type": RequestProjectType.MOBILE,
        "sector": "general",
        "name": "سارة حسن",
        "email": "sarah@gmail.com",
        "phone": "+971501234567",
        "country": "AE",
        "description": "تطبيق توصيل طلبات بسيط مع خريطة ودفع إلكتروني.",
        "budget_range": BudgetRange.OVER_10K,
        "timeline": Timeline.FLEXIBLE,
        "status": RequestStatus.NEW,
    },
]

CONTACT_MESSAGES = [
    {
        "name": "عمر عثمان",
        "email": "omar@example.com",
        "phone": "+249933445566",
        "subject": "استفسار عن أسعار تطوير المواقع",
        "message": "السلام عليكم، أريد معرفة تكلفة تطوير موقع تعريفي لشركتي مع لوحة تحكم للمحتوى. شكرًا.",
        "status": ContactStatus.READ,
    },
    {
        "name": "ليلى أحمد",
        "email": "layla@example.com",
        "subject": "طلب عرض سعر",
        "message": "مرحبًا، نحتاج عرض سعر لنظام إدارة مخزون. هل يمكن ترتيب اجتماع؟",
        "status": ContactStatus.REPLIED,
    },
    {
        "name": "يوسف حامد",
        "email": "yusuf@example.com",
        "phone": "+249901122334",
        "subject": "سؤال تقني عن REST API",
        "message": "هل تدعمون ربط أنظمتنا الحالية بواجهة برمجية جديدة دون إعادة بناء النظام القديم؟",
        "status": ContactStatus.NEW,
    },
    {
        "name": "مريم خالد",
        "email": "mariam@example.com",
        "subject": "شكر وتقدير",
        "message": "أحببت المنصة وطريقة عرض الخدمات. عمل ممتاز!",
        "status": ContactStatus.READ,
    },
]

# ---------------------------------------------------------------  السيرة الذاتية

EXPERIENCES = [
    {
        "title_ar": "مطور برمجيات أول",
        "title_en": "Senior Software Developer",
        "organization_ar": "عمل حر",
        "organization_en": "Freelance",
        "location_ar": "السودان",
        "location_en": "Sudan",
        "start_date": "2021-01-01",
        "is_current": True,
        "description_ar": "تحليل وتصميم وبناء أنظمة ويب وموبايل متكاملة للعملاء في قطاعات التعليم والتجارة.",
        "description_en": "Analysis, design, and development of complete web and mobile systems for clients in education and commerce.",
    },
    {
        "title_ar": "مطور ويب",
        "title_en": "Web Developer",
        "organization_ar": "شركة حلول تقنية",
        "organization_en": "Tech Solutions Co.",
        "location_ar": "الخرطوم",
        "location_en": "Khartoum",
        "start_date": "2019-06-01",
        "end_date": "2020-12-31",
        "description_ar": "تطوير تطبيقات ويب باستخدام Django وReact وتصميم قواعد بيانات PostgreSQL.",
        "description_en": "Web application development using Django and React with PostgreSQL database design.",
    },
]

EDUCATION_ITEMS = [
    {
        "degree_ar": "بكالوريوس",
        "degree_en": "Bachelor's Degree",
        "institution_ar": "جامعة السودان للعلوم والتكنولوجيا",
        "institution_en": "Sudan University of Science and Technology",
        "field_ar": "تقنية المعلومات",
        "field_en": "Information Technology",
        "start_date": "2016-09-01",
        "end_date": "2021-06-01",
        "description_ar": "تخصص في هندسة البرمجيات وتحليل النظم وقواعد البيانات.",
        "description_en": "Specialization in software engineering, systems analysis, and databases.",
    },
]

CERTIFICATIONS_DATA = [
    {
        "name_ar": "Python للمطورين المتقدمين",
        "name_en": "Advanced Python for Developers",
        "issuer_ar": "Udemy",
        "issuer_en": "Udemy",
        "issue_date": "2022-03-15",
    },
    {
        "name_ar": "Django REST Framework",
        "name_en": "Django REST Framework",
        "issuer_ar": "Udemy",
        "issuer_en": "Udemy",
        "issue_date": "2022-07-20",
    },
    {
        "name_ar": "React و Next.js",
        "name_en": "React & Next.js",
        "issuer_ar": "Udemy",
        "issuer_en": "Udemy",
        "issue_date": "2023-01-10",
    },
]

# ---------------------------------------------------------------  شهادات العملاء

TESTIMONIALS = [
    {
        "client_name_ar": "د. عادل محمد",
        "client_name_en": "Dr. Adel Mohammed",
        "client_title_ar": "عميد الكلية",
        "client_title_en": "College Dean",
        "company_ar": "الكلية الإماراتية للعلوم والتكنولوجيا",
        "company_en": "Emirates College for Science and Technology",
        "content_ar": "المنصة غيّرت طريقة عملنا بالكامل. التسجيل الذي كان يستغرق أسبوعًا أصبح يتم في ساعات، والطلاب يتابعون درجاتهم مباشرة.",
        "content_en": "The platform completely changed how we work. Registration that used to take a week now happens in hours, and students track their grades directly.",
        "rating": 5,
        "is_featured": True,
    },
    {
        "client_name_ar": "أ. هالة عبدالرحمن",
        "client_name_en": "Hala Abdelrahman",
        "client_title_ar": "مديرة المدارس",
        "client_title_en": "Schools Director",
        "company_ar": "مدارس ومعاهد نمبر ون",
        "company_en": "Number One Schools & Institutes",
        "content_ar": "الموقع رفع من صورة المدرسة بشكل كبير. نموذج التسجيل الإلكتروني وفّر علينا إدخال البيانات يدويًا وقلّل الأخطاء.",
        "content_en": "The website significantly improved the school's image. The online enrollment form saved us from manual data entry and reduced errors.",
        "rating": 5,
        "is_featured": True,
    },
    {
        "client_name_ar": "م. طارق حسين",
        "client_name_en": "Eng. Tariq Hussein",
        "client_title_ar": "مدير تقنية المعلومات",
        "client_title_en": "IT Manager",
        "company_ar": "شركة البناء الحديث",
        "company_en": "Modern Construction Co.",
        "content_ar": "التحليل الذي قدّمه قبل التنفيذ كان قيمة بحد ذاته. وثيقة المتطلبات وضّحت لنا حجم المشروع الحقيقي قبل أن نلتزم بأي ميزانية.",
        "content_en": "The analysis provided before implementation was valuable in itself. The requirements document clarified the true project size before any budget commitment.",
        "rating": 4,
        "is_featured": False,
    },
]

# ---------------------------------------------------------------  إحصائيات

STATS = [
    {"label_ar": "سنوات خبرة", "label_en": "Years Experience", "value": "+5", "icon": "calendar"},
    {"label_ar": "مشروع مُنجز", "label_en": "Projects Completed", "value": "+15", "icon": "folder-check"},
    {"label_ar": "قطاع مخدوم", "label_en": "Sectors Served", "value": "6", "icon": "building-2"},
    {"label_ar": "عميل راضٍ", "label_en": "Happy Clients", "value": "+10", "icon": "users"},
]

# ---------------------------------------------------------------  روابط التواصل

SOCIAL_LINKS = [
    (SocialLink.Platform.GITHUB, "GitHub", "https://github.com/nexasystems"),
    (SocialLink.Platform.LINKEDIN, "LinkedIn", "https://linkedin.com/company/nexasystems"),
    (SocialLink.Platform.X, "X", "https://x.com/nexasystems"),
    (SocialLink.Platform.WHATSAPP, "WhatsApp", "https://wa.me/249900000000"),
    (SocialLink.Platform.EMAIL, "البريد", "mailto:musabsting277@gmail.com"),
]

# ---------------------------------------------------------------  تعليقات

COMMENTS = [
    {
        "slug": "why-analysis-before-code",
        "guest_name": "أمير عبدالله",
        "guest_email": "amir@example.com",
        "content": "مقال ممتاز! فعلًا التحليل قبل التنفيذ يوفر وقتًا وجهدًا كبيرين.",
        "status": Comment.Status.APPROVED,
    },
    {
        "slug": "why-analysis-before-code",
        "guest_name": "نورا سعيد",
        "guest_email": "noura@example.com",
        "content": "هل يمكن تطبيق نفس المنهجية على المشاريع الصغيرة أم تناسب المشاريع الكبيرة فقط؟",
        "status": Comment.Status.APPROVED,
    },
    {
        "slug": "arabic-search-that-actually-works",
        "guest_name": "طارق نور",
        "guest_email": "tariq@example.com",
        "content": "واجهتنا نفس المشكلة بالضبط! شكرًا على الحل العملي.",
        "status": Comment.Status.APPROVED,
    },
    {
        "slug": "arabic-search-that-actually-works",
        "guest_name": "ريم حسن",
        "guest_email": "reem@example.com",
        "content": "هل يمكن مشاركة كود دالة التطبيع؟",
        "status": Comment.Status.PENDING,
    },
]


class Command(BaseCommand):
    help = "زرع بيانات تجريبية للـ CRM والسيرة الذاتية والشهادات (متكرر التنفيذ بأمان)"

    @transaction.atomic
    def handle(self, *args, **options):
        self._seed_leads()
        self._seed_requests()
        self._seed_messages()
        self._seed_crm_activity()
        self._seed_experiences()
        self._seed_education()
        self._seed_certifications()
        self._seed_testimonials()
        self._seed_stats()
        self._seed_social_links()
        self._seed_comments()
        self.stdout.write(self.style.SUCCESS("\nاكتمل زرع البيانات التجريبية."))

    def _seed_leads(self):
        for data in LEADS:
            Lead.objects.get_or_create(email=data["email"], defaults=data)
        self.stdout.write(f"  العملاء المحتملون: {len(LEADS)}")

    def _seed_requests(self):
        for data in PROJECT_REQUESTS:
            email = data.get("email", "")
            lead = Lead.objects.filter(email=email).first() if email else None
            ProjectRequest.objects.get_or_create(
                email=data["email"],
                project_type=data["project_type"],
                defaults={**data, "lead": lead, "ip_address": "127.0.0.1"},
            )
        self.stdout.write(f"  طلبات المشاريع: {len(PROJECT_REQUESTS)}")

    def _seed_messages(self):
        for data in CONTACT_MESSAGES:
            ContactMessage.objects.get_or_create(
                email=data["email"],
                subject=data.get("subject", ""),
                defaults={**data, "ip_address": "127.0.0.1"},
            )
        self.stdout.write(f"  رسائل التواصل: {len(CONTACT_MESSAGES)}")

    def _seed_crm_activity(self):
        n = now()
        count = 0

        for lead in Lead.objects.all()[:5]:
            if not CrmNote.objects.filter(lead=lead).exists():
                CrmNote.objects.create(
                    lead=lead,
                    content=f"تم التواصل مع {lead.name} بخصوص متطلبات المشروع.",
                )
                count += 1

            if not Interaction.objects.filter(lead=lead).exists():
                Interaction.objects.create(
                    lead=lead,
                    type=InteractionType.WHATSAPP,
                    direction=InteractionDirection.OUTBOUND,
                    summary=f"مراسلة واتساب مع {lead.name} لمناقشة الاحتياجات.",
                    occurred_at=n - timedelta(days=2),
                )
                lead.touch_contact()
                count += 1

            if not FollowUp.objects.filter(lead=lead).exists():
                FollowUp.objects.create(
                    lead=lead,
                    title=f"متابعة مع {lead.name}",
                    due_at=n + timedelta(days=1),
                    status=FollowUpStatus.PENDING,
                )
                count += 1

        # follow-ups: one overdue, one today, one future
        leads = list(Lead.objects.all()[:3])
        if len(leads) >= 3:
            overdue = FollowUp.objects.filter(lead=leads[0]).first()
            if overdue:
                overdue.due_at = n - timedelta(days=2)
                overdue.save(update_fields=["due_at"])
            today_fu = FollowUp.objects.filter(lead=leads[1]).first()
            if today_fu:
                today_fu.due_at = n.replace(hour=14, minute=0, second=0)
                today_fu.save(update_fields=["due_at"])

        # convert one lead to client
        accepted_lead = Lead.objects.filter(status=LeadStatus.PROPOSAL_SENT).first()
        if accepted_lead and not Client.objects.filter(lead=accepted_lead).exists():
            Client.objects.create(
                lead=accepted_lead,
                name=accepted_lead.name,
                company=accepted_lead.company,
                email=accepted_lead.email,
                phone=accepted_lead.phone,
                country=accepted_lead.country,
                city=accepted_lead.city,
            )
            count += 1

        self.stdout.write(f"  نشاط CRM (ملاحظات، تفاعلات، متابعات): {count}")

    def _seed_experiences(self):
        for order, data in enumerate(EXPERIENCES):
            from datetime import date
            defaults = {**data}
            start = defaults.pop("start_date")
            end = defaults.pop("end_date", None)
            defaults["start_date"] = date.fromisoformat(start)
            if end:
                defaults["end_date"] = date.fromisoformat(end)
            defaults["display_order"] = order
            defaults["is_active"] = True
            Experience.objects.get_or_create(
                title_ar=data["title_ar"],
                organization_ar=data["organization_ar"],
                defaults=defaults,
            )
        self.stdout.write(f"  الخبرات: {len(EXPERIENCES)}")

    def _seed_education(self):
        for order, data in enumerate(EDUCATION_ITEMS):
            from datetime import date
            defaults = {**data}
            start = defaults.pop("start_date")
            end = defaults.pop("end_date", None)
            defaults["start_date"] = date.fromisoformat(start)
            if end:
                defaults["end_date"] = date.fromisoformat(end)
            defaults["display_order"] = order
            defaults["is_active"] = True
            Education.objects.get_or_create(
                degree_ar=data["degree_ar"],
                institution_ar=data["institution_ar"],
                defaults=defaults,
            )
        self.stdout.write(f"  المؤهلات: {len(EDUCATION_ITEMS)}")

    def _seed_certifications(self):
        for order, data in enumerate(CERTIFICATIONS_DATA):
            from datetime import date
            defaults = {**data}
            issue = defaults.pop("issue_date")
            defaults["issue_date"] = date.fromisoformat(issue)
            defaults["display_order"] = order
            defaults["is_active"] = True
            Certification.objects.get_or_create(
                name_ar=data["name_ar"],
                defaults=defaults,
            )
        self.stdout.write(f"  الشهادات المهنية: {len(CERTIFICATIONS_DATA)}")

    def _seed_testimonials(self):
        projects = {p.slug: p for p in __import__("apps.portfolio.models", fromlist=["Project"]).Project.objects.all()}
        for order, data in enumerate(TESTIMONIALS):
            defaults = {**data, "display_order": order, "is_published": True, "published_at": now()}
            if order == 0 and "eust-academic-platform" in projects:
                defaults["project"] = projects["eust-academic-platform"]
            elif order == 1 and "number-one-schools" in projects:
                defaults["project"] = projects["number-one-schools"]
            Testimonial.objects.get_or_create(
                client_name_ar=data["client_name_ar"],
                defaults=defaults,
            )
        self.stdout.write(f"  شهادات العملاء: {len(TESTIMONIALS)}")

    def _seed_stats(self):
        for order, data in enumerate(STATS):
            Stat.objects.get_or_create(
                label_ar=data["label_ar"],
                defaults={**data, "display_order": order, "is_active": True},
            )
        self.stdout.write(f"  الإحصائيات: {len(STATS)}")

    def _seed_social_links(self):
        for order, (platform, label, url) in enumerate(SOCIAL_LINKS):
            SocialLink.objects.get_or_create(
                platform=platform,
                defaults={"label": label, "url": url, "display_order": order, "is_active": True},
            )
        self.stdout.write(f"  روابط التواصل: {len(SOCIAL_LINKS)}")

    def _seed_comments(self):
        count = 0
        for data in COMMENTS:
            post = Post.objects.filter(slug=data["slug"]).first()
            if not post:
                continue
            _, created = Comment.objects.get_or_create(
                post=post,
                guest_email=data["guest_email"],
                defaults={
                    "guest_name": data["guest_name"],
                    "content": data["content"],
                    "status": data["status"],
                    "ip_address": "127.0.0.1",
                },
            )
            if created:
                count += 1
        self.stdout.write(f"  التعليقات: {count}")
