from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ParkingLotViewSet, ParkingReviewViewSet, dashboard_stats, recent_reservations

router = DefaultRouter()
router.register(r'parking', ParkingLotViewSet, basename='parking')
router.register(r'reviews', ParkingReviewViewSet, basename='review')

urlpatterns = [
    path('', include(router.urls)),
    # Rutas para el panel administrativo
    path('admin/dashboard-stats/', dashboard_stats, name='dashboard-stats'),
    path('admin/recent-reservations/', recent_reservations, name='recent-reservations'),
]
