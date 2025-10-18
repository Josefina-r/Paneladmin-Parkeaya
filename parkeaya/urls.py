"""
URL configuration for parkeaya project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

"""
URL configuration for parkeaya project.
"""

from django.contrib import admin
from django.urls import path, include
from rest_framework import routers
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

# IMPORTAR LAS VISTAS DEL DASHBOARD ← AGREGAR ESTO
from parking.views import dashboard_stats, recent_reservations

from users.views import UserViewSet, CarViewSet
from parking.views import ParkingLotViewSet
from reservations.views import ReservationViewSet
from payments.views import PaymentViewSet
from tickets.views import TicketViewSet

router = routers.DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'cars', CarViewSet, basename='car')
router.register(r'parking', ParkingLotViewSet, basename='parking')
router.register(r'reservations', ReservationViewSet, basename='reservation')
router.register(r'payments', PaymentViewSet, basename='payment')
router.register(r'tickets', TicketViewSet, basename='ticket')

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # URLs específicas PRIMERO
    path('api/users/', include('users.urls')),
    
   
    path('api/dashboard/stats/', dashboard_stats, name='dashboard_stats'),
    path('api/dashboard/recent-reservations/', recent_reservations, name='recent_reservations'),
    
    # Router DESPUÉS
    path('api/', include(router.urls)),
    
    # JWT endpoints
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Autenticación de cuenta gmail
    path("auth/", include("dj_rest_auth.urls")), 
]