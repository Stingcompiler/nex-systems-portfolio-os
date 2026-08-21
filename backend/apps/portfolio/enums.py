"""قوائم ثابتة مشتركة بين نماذج الأعمال."""

from django.db import models


class Sector(models.TextChoices):
    EDUCATION = "education", "التعليم"
    RETAIL = "retail", "التجارة والبقالات"
    RESTAURANTS = "restaurants", "المطاعم"
    ACCOUNTING = "accounting", "المحاسبة"
    HR = "hr", "الموارد البشرية"
    REAL_ESTATE = "real_estate", "العقارات"
    PHARMACY = "pharmacy", "الصيدليات"
    HEALTHCARE = "healthcare", "الرعاية الصحية"
    NGO = "ngo", "المنظمات"
    LOGISTICS = "logistics", "المخزون والتوزيع"
    GENERAL = "general", "عام"


class ProjectType(models.TextChoices):
    WEB = "web", "موقع أو تطبيق ويب"
    MOBILE = "mobile", "تطبيق موبايل"
    DESKTOP = "desktop", "تطبيق سطح مكتب"
    API = "api", "واجهة برمجية"
    SYSTEM = "system", "نظام إداري متكامل"
    OTHER = "other", "أخرى"


class ProjectStatus(models.TextChoices):
    PLANNING = "planning", "قيد التخطيط"
    IN_PROGRESS = "in_progress", "قيد التنفيذ"
    COMPLETED = "completed", "مكتمل"
    MAINTAINED = "maintained", "مكتمل وتحت الصيانة"
    ARCHIVED = "archived", "مؤرشف"


class TechnologyCategory(models.TextChoices):
    LANGUAGE = "language", "لغة برمجة"
    FRONTEND = "frontend", "واجهة أمامية"
    BACKEND = "backend", "واجهة خلفية"
    MOBILE = "mobile", "موبايل"
    DESKTOP = "desktop", "سطح مكتب"
    DATABASE = "database", "قواعد بيانات"
    TOOL = "tool", "أدوات"
