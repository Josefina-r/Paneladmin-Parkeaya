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
from tickets.views import TicketViewSet, TicketValidationAPIView
from users import views


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
    path('api/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    
    # JWT endpoints
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Autenticación de cuenta
    path("auth/", include("dj_rest_auth.urls")), 
    path("api/register/", views.register_owner, name="register_owner"),
    path('api/simple-login/', views.simple_login, name='simple_login'),
    path('api/admin-login/', views.admin_login, name='admin_login'),

    #reservations app urls
    path('api/auth/', include('users.urls')),
    path('api/parking/', include('parking.urls')),
    path('api/reservations/', include('reservations.urls')),
    path('api/payments/', include('payments.urls')),
    # Ticket-specific extra endpoints (validation and by-parking)
    path('api/tickets/validate/', TicketValidationAPIView.as_view(), name='validate-ticket'),
    path('api/tickets/parking/<int:parking_id>/', TicketViewSet.as_view({'get': 'by_parking'}), name='tickets-by-parking'),
    
    # Complaints app urls
    path('api/', include('complaints.urls')),

]