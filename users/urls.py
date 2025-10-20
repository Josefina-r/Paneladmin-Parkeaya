# tu_app/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RegisterView, MyTokenObtainPairView, UserViewSet, CarViewSet
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

# URLs específicas PRIMERO (tienen prioridad)
urlpatterns = [
    
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
     path('admin-login/', views.admin_login, name='admin-login'),
    path('simple-login/', views.simple_login, name='simple-login'),
    path('profile/', views.get_user_profile, name='user-profile'),
    path('check-admin/', views.check_admin_permission, name='check-admin'),
]

# Router DESPUÉS
router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user') 
router.register(r'cars', CarViewSet, basename='car')

urlpatterns += router.urls