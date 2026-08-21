from rest_framework.routers import DefaultRouter

from apps.portfolio import views

app_name = "portfolio"

router = DefaultRouter()
router.register("technologies", views.TechnologyViewSet, basename="technology")
router.register("services", views.ServiceViewSet, basename="service")
router.register("solutions", views.SolutionViewSet, basename="solution")
router.register("projects", views.ProjectViewSet, basename="project")
router.register("case-studies", views.CaseStudyViewSet, basename="case-study")
router.register("testimonials", views.TestimonialViewSet, basename="testimonial")
router.register("experiences", views.ExperienceViewSet, basename="experience")
router.register("education", views.EducationViewSet, basename="education")
router.register("certifications", views.CertificationViewSet, basename="certification")
router.register("resources", views.ResourceViewSet, basename="resource")

urlpatterns = router.urls
