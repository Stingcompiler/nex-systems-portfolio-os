"""مرشّحات مشتركة."""

from rest_framework.filters import BaseFilterBackend

from apps.core.utils.text import normalize_arabic


class NormalizedSearchFilter(BaseFilterBackend):
    """بحث يعمل بنفس الجودة على SQLite وPostgreSQL.

    يطبّع نص المستخدم بنفس الدالة التي طُبّع بها `search_text` عند الحفظ،
    فتتطابق «الامارات» مع «الإمارات» و«مدرسه» مع «مدرسة».
    """

    search_param = "search"

    def filter_queryset(self, request, queryset, view):
        term = (request.query_params.get(self.search_param) or "").strip()
        if not term:
            return queryset

        model = getattr(queryset, "model", None)
        if model is None or not hasattr(model, "search_text"):
            return queryset

        normalized = normalize_arabic(term)
        if not normalized:
            return queryset

        # كل كلمة يجب أن ترد في نص البحث — يضيّق النتائج بدل توسيعها
        for word in normalized.split(" "):
            queryset = queryset.filter(search_text__icontains=word)
        return queryset

    def get_schema_operation_parameters(self, view):
        return [
            {
                "name": self.search_param,
                "required": False,
                "in": "query",
                "description": "بحث نصي يتجاهل الهمزات والتشكيل والتاء المربوطة",
                "schema": {"type": "string"},
            }
        ]
