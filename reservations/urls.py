from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ReservationViewSet, CheckInView, CheckOutView, UserActiveReservationsView, ParkingReservationsView

router = DefaultRouter()
router.register(r'reservations', ReservationViewSet, basename='reservation')

urlpatterns = [
    path('', include(router.urls)),
    
    # Endpoints específicos
    path('reservations/user/active/', UserActiveReservationsView.as_view(), name='user-active-reservations'),
    path('reservations/parking/<int:parking_id>/', ParkingReservationsView.as_view(), name='parking-reservations'),
    path('reservations/<uuid:codigo_reserva>/checkin/', CheckInView.as_view(), name='checkin'),
    path('reservations/<uuid:codigo_reserva>/checkout/', CheckOutView.as_view(), name='checkout'),
    path('reservations/<uuid:codigo_reserva>/cancel/', ReservationViewSet.as_view({'post': 'cancel'}), name='cancel-reservation'),
    path('reservations/<uuid:codigo_reserva>/extend/', ReservationViewSet.as_view({'post': 'extend'}), name='extend-reservation'),
]