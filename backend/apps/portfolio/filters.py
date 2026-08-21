import django_filters as filters

from apps.portfolio.models import CaseStudy, Project, Service, Technology


class ServiceFilter(filters.FilterSet):
    technology = filters.CharFilter(field_name="technologies__slug", lookup_expr="iexact")
    has_price = filters.BooleanFilter(field_name="price_from", lookup_expr="isnull", exclude=True)

    class Meta:
        model = Service
        fields = ["kind", "sector", "is_featured"]


class ProjectFilter(filters.FilterSet):
    technology = filters.CharFilter(field_name="technologies__slug", lookup_expr="iexact")
    service = filters.CharFilter(field_name="services__slug", lookup_expr="iexact")
    year = filters.NumberFilter(field_name="completed_at", lookup_expr="year")

    class Meta:
        model = Project
        fields = ["sector", "project_type", "status", "is_featured"]


class CaseStudyFilter(filters.FilterSet):
    sector = filters.CharFilter(field_name="project__sector", lookup_expr="iexact")
    project = filters.CharFilter(field_name="project__slug", lookup_expr="iexact")

    class Meta:
        model = CaseStudy
        fields = []


class TechnologyFilter(filters.FilterSet):
    class Meta:
        model = Technology
        fields = ["category", "is_featured", "is_active"]
