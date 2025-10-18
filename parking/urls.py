from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'parking', views.ParkingLotViewSet, basename='parking')

urlpatterns = [
    path('', include(router.urls)),
    # AGREGAR ESTAS NUEVAS RUTAS
    path('admin/dashboard-stats/', views.dashboard_stats, name='dashboard-stats'),
    path('admin/recent-reservations/', views.recent_reservations, name='recent-reservations'),
]