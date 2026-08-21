import django_filters as filters

from apps.blog.models import Post


class PostFilter(filters.FilterSet):
    category = filters.CharFilter(field_name="category__slug", lookup_expr="iexact")
    tag = filters.CharFilter(field_name="tags__slug", lookup_expr="iexact")

    class Meta:
        model = Post
        fields = ["is_featured"]
