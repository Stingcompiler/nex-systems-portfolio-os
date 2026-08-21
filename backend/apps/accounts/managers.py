from django.contrib.auth.models import BaseUserManager


class UserManager(BaseUserManager):
    """مدير مستخدمين يعتمد البريد الإلكتروني بدل اسم المستخدم."""

    use_in_migrations = True

    def _create_user(self, email: str, password: str | None, **extra_fields):
        if not email:
            raise ValueError("البريد الإلكتروني مطلوب")
        email = self.normalize_email(email).lower().strip()
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.full_clean(exclude=["password"], validate_unique=False)
        user.save(using=self._db)
        return user

    def create_user(self, email: str, password: str | None = None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        extra_fields.setdefault("role", "member")
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email: str, password: str | None = None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", "super_admin")
        extra_fields.setdefault("is_email_verified", True)
        extra_fields.setdefault("full_name", "مدير النظام")

        if extra_fields.get("is_staff") is not True:
            raise ValueError("المدير العام يجب أن يملك is_staff=True")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("المدير العام يجب أن يملك is_superuser=True")

        return self._create_user(email, password, **extra_fields)

    def get_by_natural_key(self, username):
        return self.get(email__iexact=username)
