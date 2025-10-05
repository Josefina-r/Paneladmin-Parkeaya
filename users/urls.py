# tu_app/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RegisterView, MyTokenObtainPairView, UserViewSet, CarViewSet
from rest_framework_simplejwt.views import TokenRefreshView

# URLs específicas PRIMERO (tienen prioridad)
urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]

# Router DESPUÉS
router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user') 
router.register(r'cars', CarViewSet, basename='car')

urlpatterns += router.urls