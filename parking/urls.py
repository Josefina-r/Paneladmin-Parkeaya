from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ParkingLotViewSet, ParkingReviewViewSet

router = DefaultRouter()
router.register(r'parking', ParkingLotViewSet, basename='parking')
router.register(r'reviews', ParkingReviewViewSet, basename='review')

urlpatterns = [
    path('', include(router.urls)),
]