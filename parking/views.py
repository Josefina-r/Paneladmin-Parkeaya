from rest_framework import viewsets, permissions
from .models import ParkingLot
from .serializers import ParkingLotSerializer

# AGREGAR ESTOS IMPORTS
from django.db.models import Count, Sum, Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from reservations.models import Reservation
from payments.models import Payment
from django.utils import timezone
from datetime import timedelta

User = get_user_model()

# =============================================================================
# TU CÓDIGO EXISTENTE (NO MODIFICAR)
# =============================================================================

class ParkingLotViewSet(viewsets.ModelViewSet):
    queryset = ParkingLot.objects.all().order_by('-creado_en')
    serializer_class = ParkingLotSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get('available') == 'true':
            qs = qs.filter(plazas_disponibles__gt=0)
        return qs

# =============================================================================
# NUEVAS VISTAS PARA EL DASHBOARD (AGREGAR AL FINAL)
# =============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    """
    Obtener estadísticas para el panel de administración
    """
    if not request.user.is_staff:
        return Response({'error': 'Solo administradores pueden acceder'}, status=403)
    
    try:
        # Total de usuarios
        total_users = User.objects.count()
        
        # Estacionamientos disponibles (con plazas disponibles)
        available_parkings = ParkingLot.objects.filter(plazas_disponibles__gt=0).count()
        
        # Total de ingresos (suma de todos los pagos)
        total_revenue = Payment.objects.aggregate(total=Sum('monto'))['total'] or 0
        
        # Reservas activas (del día actual)
        today = timezone.now().date()
        active_reservations = Reservation.objects.filter(
            fecha_reserva=today,
            estado__in=['activa', 'confirmada']
        ).count()
        
        # Distribución por tipo de vehículo (solo carros)
        vehicle_distribution = {
            'cars': 100  # Como solo manejas carros
        }
        
        # Reservas de los últimos 7 días
        last_7_days = timezone.now().date() - timedelta(days=7)
        weekly_reservations = []
        
        for i in range(7):
            day = last_7_days + timedelta(days=i)
            count = Reservation.objects.filter(fecha_reserva=day).count()
            weekly_reservations.append({
                'day': day.strftime('%a'),
                'count': count
            })
        
        return Response({
            'totalUsers': total_users,
            'availableParkings': available_parkings,
            'totalRevenue': total_revenue,
            'activeReservations': active_reservations,
            'vehicleDistribution': vehicle_distribution,
            'weeklyReservations': weekly_reservations
        })
        
    except Exception as e:
        return Response({'error': f'Error al cargar estadísticas: {str(e)}'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def recent_reservations(request):
    """
    Obtener las últimas reservas para el panel
    """
    if not request.user.is_staff:
        return Response({'error': 'Solo administradores pueden acceder'}, status=403)
    
    try:
        # Obtener las últimas 6 reservas
        reservations = Reservation.objects.select_related('usuario', 'estacionamiento').order_by('-fecha_creacion')[:6]
        
        reservations_data = []
        for reservation in reservations:
            reservations_data.append({
                'id': reservation.id,
                'usuario': {
                    'id': reservation.usuario.id,
                    'username': reservation.usuario.username
                },
                'estacionamiento': {
                    'id': reservation.estacionamiento.id,
                    'nombre': reservation.estacionamiento.nombre
                },
                'fecha_reserva': reservation.fecha_reserva,
                'estado': reservation.estado
            })
        
        return Response(reservations_data)
        
    except Exception as e:
        return Response({'error': f'Error al cargar reservas: {str(e)}'}, status=500)