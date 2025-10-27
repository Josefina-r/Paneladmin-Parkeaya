from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TicketViewSet, TicketValidationAPIView

router = DefaultRouter()
router.register(r'tickets', TicketViewSet, basename='ticket')

urlpatterns = [
    path('', include(router.urls)),
    
    # Endpoints adicionales
    path('tickets/validate/', TicketValidationAPIView.as_view(), name='validate-ticket'),
    path('tickets/parking/<int:parking_id>/', 
         TicketViewSet.as_view({'get': 'by_parking'}), 
         name='tickets-by-parking'),
]