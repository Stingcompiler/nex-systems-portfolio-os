from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.newsletter import views

app_name = "newsletter"

router = DefaultRouter()
router.register("subscribers", views.SubscriberViewSet, basename="subscriber")
router.register("campaigns", views.CampaignViewSet, basename="campaign")
router.register("email-templates", views.EmailTemplateViewSet, basename="email-template")
router.register("interests/manage", views.InterestAdminViewSet, basename="interest-admin")

urlpatterns = [
    # عام — قبل الموجّه كي لا تلتقطها مسارات `subscribers/{pk}/`
    path("subscribers/subscribe/", views.SubscribeView.as_view(), name="subscribe"),
    path("subscribers/confirm/", views.ConfirmView.as_view(), name="confirm"),
    path("subscribers/unsubscribe/", views.UnsubscribeView.as_view(), name="unsubscribe"),
    path("subscribers/me/", views.MySubscriptionView.as_view(), name="my-subscription"),
    path(
        "subscribers/preferences/<str:token>/",
        views.PreferencesView.as_view(),
        name="preferences",
    ),
    path("interests/", views.InterestListView.as_view(), name="interests"),
    path("newsletter/track/open/<str:token>.gif", views.TrackOpenView.as_view(), name="track-open"),
    path("newsletter/track/click/<str:token>/", views.TrackClickView.as_view(), name="track-click"),
    path("", include(router.urls)),
]
