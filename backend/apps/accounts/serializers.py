from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.accounts.models import MemberProfile, User


class MemberProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = MemberProfile
        fields = [
            "bio_ar",
            "bio_en",
            "website",
            "country",
            "city",
            "newsletter_opt_in",
            "notify_on_comment_reply",
        ]


class UserSerializer(serializers.ModelSerializer):
    """تمثيل المستخدم المُعاد بعد الدخول وفي `GET /auth/me/`."""

    profile = MemberProfileSerializer(source="member_profile", read_only=True)
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    permissions = serializers.SerializerMethodField()
    is_dashboard_user = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "full_name",
            "phone",
            "avatar",
            "role",
            "role_display",
            "preferred_language",
            "is_email_verified",
            "is_dashboard_user",
            "date_joined",
            "permissions",
            "profile",
        ]
        read_only_fields = fields

    def get_permissions(self, user: User) -> list[str]:
        if user.is_superuser:
            return ["*"]
        return sorted(user.get_all_permissions())


class MeUpdateSerializer(serializers.ModelSerializer):
    profile = MemberProfileSerializer(source="member_profile", required=False)

    class Meta:
        model = User
        fields = ["full_name", "phone", "avatar", "preferred_language", "profile"]

    def update(self, instance: User, validated_data: dict):
        profile_data = validated_data.pop("member_profile", None)

        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()

        if profile_data:
            profile, _ = MemberProfile.objects.get_or_create(user=instance)
            for field, value in profile_data.items():
                setattr(profile, field, value)
            profile.save()

        return instance


class PasswordFieldMixin:
    """تحقق موحّد من قوة كلمة المرور وتطابق التأكيد."""

    password_field = "password"
    confirm_field = "password_confirm"

    def _validate_password_pair(self, attrs: dict, user=None) -> dict:
        password = attrs.get(self.password_field)
        confirm = attrs.get(self.confirm_field)

        if password != confirm:
            raise serializers.ValidationError(
                {self.confirm_field: ["كلمتا المرور غير متطابقتين"]}
            )

        try:
            validate_password(password, user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({self.password_field: list(exc.messages)})

        return attrs


class RegisterSerializer(PasswordFieldMixin, serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, style={"input_type": "password"})
    password_confirm = serializers.CharField(
        write_only=True, style={"input_type": "password"}
    )

    class Meta:
        model = User
        fields = ["full_name", "email", "password", "password_confirm", "preferred_language"]

    def validate_email(self, value: str) -> str:
        email = value.lower().strip()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("هذا البريد الإلكتروني مسجل بالفعل")
        return email

    def validate_full_name(self, value: str) -> str:
        # الاسم اختياري — نطبّع الفراغات فقط دون فرض حد أدنى
        return " ".join(value.split())

    def validate(self, attrs: dict) -> dict:
        return self._validate_password_pair(attrs)

    def create(self, validated_data: dict) -> User:
        validated_data.pop("password_confirm", None)
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate_email(self, value: str) -> str:
        return value.lower().strip()


class TokenPairSerializer(serializers.Serializer):
    """شكل الاستجابة لعملاء الموبايل فقط."""

    access = serializers.CharField(read_only=True)
    refresh = serializers.CharField(read_only=True)


class DetailSerializer(serializers.Serializer):
    """استجابة نصية بسيطة."""

    detail = serializers.CharField(read_only=True)


class AuthResponseSerializer(serializers.Serializer):
    """استجابة المصادقة: بيانات المستخدم دائمًا، والرموز للموبايل فقط."""

    user = UserSerializer(read_only=True)
    tokens = TokenPairSerializer(read_only=True, required=False)


class RefreshRequestSerializer(serializers.Serializer):
    """رمز التجديد اختياري: الويب يرسله في الكوكي، والموبايل في الجسم."""

    refresh = serializers.CharField(required=False, allow_blank=True)


class RevokeResponseSerializer(serializers.Serializer):
    detail = serializers.CharField(read_only=True)
    revoked = serializers.IntegerField(read_only=True)


class EmailVerifySerializer(serializers.Serializer):
    token = serializers.CharField(max_length=64)


class PasswordForgotSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value: str) -> str:
        return value.lower().strip()


class PasswordResetSerializer(PasswordFieldMixin, serializers.Serializer):
    password_field = "new_password"
    confirm_field = "new_password_confirm"

    token = serializers.CharField(max_length=64)
    new_password = serializers.CharField(write_only=True, style={"input_type": "password"})
    new_password_confirm = serializers.CharField(
        write_only=True, style={"input_type": "password"}
    )

    def validate(self, attrs: dict) -> dict:
        return self._validate_password_pair(attrs)


class PasswordChangeSerializer(PasswordFieldMixin, serializers.Serializer):
    password_field = "new_password"
    confirm_field = "new_password_confirm"

    current_password = serializers.CharField(
        write_only=True, style={"input_type": "password"}
    )
    new_password = serializers.CharField(write_only=True, style={"input_type": "password"})
    new_password_confirm = serializers.CharField(
        write_only=True, style={"input_type": "password"}
    )

    def validate_current_password(self, value: str) -> str:
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("كلمة المرور الحالية غير صحيحة")
        return value

    def validate(self, attrs: dict) -> dict:
        user = self.context["request"].user
        if attrs.get("current_password") == attrs.get("new_password"):
            raise serializers.ValidationError(
                {"new_password": ["كلمة المرور الجديدة مطابقة للحالية"]}
            )
        return self._validate_password_pair(attrs, user=user)


class AccountDeleteSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, style={"input_type": "password"})
    confirm = serializers.BooleanField()

    def validate_password(self, value: str) -> str:
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("كلمة المرور غير صحيحة")
        return value

    def validate_confirm(self, value: bool) -> bool:
        if not value:
            raise serializers.ValidationError("يلزم تأكيد رغبتك في حذف الحساب")
        return value
