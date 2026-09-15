from django.db import migrations

DEFAULT_INTERESTS = [
    ("new_projects", "مشاريع جديدة", "New projects",
     "عند نشر مشروع جديد في المعرض", "When a new project is published"),
    ("new_services", "خدمات جديدة", "New services",
     "عند إضافة خدمة أو حل جديد", "When a new service or solution is added"),
    ("articles", "المقالات", "Articles",
     "أحدث مقالات المدونة", "The latest blog articles"),
    ("offers", "العروض", "Offers",
     "عروض وخصومات موسمية", "Seasonal offers and discounts"),
    ("product_updates", "تحديثات المنتجات", "Product updates",
     "تحديثات الأنظمة والمنتجات", "System and product updates"),
]


def seed(apps, schema_editor):
    Interest = apps.get_model("newsletter", "Interest")
    for order, (key, name_ar, name_en, desc_ar, desc_en) in enumerate(DEFAULT_INTERESTS):
        Interest.objects.get_or_create(
            key=key,
            defaults={
                "name_ar": name_ar, "name_en": name_en,
                "description_ar": desc_ar, "description_en": desc_en,
                "display_order": order,
            },
        )


class Migration(migrations.Migration):
    dependencies = [("newsletter", "0001_initial")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
