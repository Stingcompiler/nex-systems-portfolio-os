"""إدارة المستخدمين والأدوار — للمدير العام وحده."""

from django.contrib.auth.models import Group
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.roles import GROUP_NAMES, STAFF_ROLES, Role
from apps.core.mixins import AuditLogMixin
from apps.core.pagination import LargePagination
from apps.core.permissions import IsSuperAdmin


class UserAdminSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    is_dashboard_user = serializers.BooleanField(read_only=True)
    groups = serializers.SerializerMethodField()
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            "id", "email", "full_name", "phone", "role", "role_display",
            "preferred_language", "is_email_verified", "is_active", "is_staff",
            "is_dashboard_user", "groups", "date_joined", "last_login", "password",
        ]
        read_only_fields = ["id", "is_staff", "date_joined", "last_login"]

    def get_groups(self, user: User) -> list[str]:
        return list(user.groups.values_list("name", flat=True))

    def validate_email(self, value: str) -> str:
        email = value.lower().strip()
        queryset = User.objects.filter(email__iexact=email)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("هذا البريد مستخدم بالفعل")
        return email

    def create(self, validated_data: dict) -> User:
        password = validated_data.pop("password", "") or None
        return User.objects.create_user(password=password, **validated_data)

    def update(self, instance: User, validated_data: dict) -> User:
        password = validated_data.pop("password", "")
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class SetRoleSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=Role.choices)


class RoleSerializer(serializers.Serializer):
    value = serializers.CharField()
    label = serializers.CharField()
    group = serializers.CharField()
    is_staff_role = serializers.BooleanField()
    permission_count = serializers.IntegerField()


@extend_schema_view(
    list=extend_schema(summary="المستخدمون"),
    create=extend_schema(summary="إنشاء مستخدم"),
    retrieve=extend_schema(summary="تفاصيل مستخدم"),
    partial_update=extend_schema(summary="تعديل مستخدم"),
    destroy=extend_schema(summary="حذف مستخدم"),
)
class UserAdminViewSet(AuditLogMixin, viewsets.ModelViewSet):
    queryset = User.objects.prefetch_related("groups").all()
    serializer_class = UserAdminSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    pagination_class = LargePagination
    filterset_fields = ["role", "is_active", "is_email_verified"]
    search_fields = ["email", "full_name"]
    ordering_fields = ["date_joined", "email", "full_name"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    audit_exclude_fields = ("password",)

    def perform_destroy(self, instance):
        if instance.pk == self.request.user.pk:
            raise serializers.ValidationError({"detail": "لا يمكنك حذف حسابك من هنا"})
        if instance.is_superuser and User.objects.filter(is_superuser=True).count() == 1:
            raise serializers.ValidationError(
                {"detail": "لا يمكن حذف المدير العام الوحيد"}
            )
        super().perform_destroy(instance)

    @extend_schema(summary="تغيير دور المستخدم", request=SetRoleSerializer)
    @action(detail=True, methods=["post"], url_path="set-role")
    def set_role(self, request, pk=None):
        user = self.get_object()
        serializer = SetRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if user.pk == request.user.pk:
            return Response(
                {"detail": "لا يمكنك تغيير دورك بنفسك", "code": "self_role_change",
                 "errors": {}},
                status=400,
            )

        user.role = serializer.validated_data["role"]
        user.save()  # الإشارة تزامن المجموعة تلقائيًا
        return Response(UserAdminSerializer(user, context={"request": request}).data)


class RolesView(APIView):
    """قائمة الأدوار وعدد صلاحيات كل دور."""

    permission_classes = [IsAuthenticated, IsSuperAdmin]

    @extend_schema(summary="الأدوار والصلاحيات", responses={200: RoleSerializer(many=True)})
    def get(self, request):
        counts = {
            group.name: group.permissions.count()
            for group in Group.objects.prefetch_related("permissions")
        }
        payload = [
            {
                "value": value,
                "label": label,
                "group": GROUP_NAMES.get(value, ""),
                "is_staff_role": value in STAFF_ROLES,
                "permission_count": counts.get(GROUP_NAMES.get(value, ""), 0),
            }
            for value, label in Role.choices
        ]
        return Response(payload)
