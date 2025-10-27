from rest_framework import viewsets, filters, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Count, Avg, Sum
from django.db.models.functions import TruncDate
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from django.contrib.auth import get_user_model
from datetime import timedelta

from .models import ParkingLot, ParkingReview
from .serializers import ParkingLotSerializer, ParkingReviewSerializer
from reservations.models import Reservation
from payments.models import Payment

User = get_user_model()
try:
    from .permissions import IsOwnerOrReadOnly  
except Exception:
    from rest_framework import permissions as _permissions

    class IsOwnerOrReadOnly(_permissions.BasePermission):
       

        def has_object_permission(self, request, view, obj):
            # lecturas permitidas para cualquier request
            if request.method in _permissions.SAFE_METHODS:
                return True
            # si el objeto tiene 'dueno' o 'owner' o 'usuario', comparar
            user = request.user
            if not user or not user.is_authenticated:
                return False
            if getattr(user, 'is_staff', False) or getattr(user, 'is_superuser', False):
                return True
            owner = getattr(obj, 'dueno', None) or getattr(obj, 'owner', None) or getattr(obj, 'usuario', None)
            return owner == user


class ParkingLotViewSet(viewsets.ModelViewSet):
    queryset = ParkingLot.objects.all().select_related('dueno').prefetch_related('imagenes')
    serializer_class = ParkingLotSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['nombre', 'direccion', 'nivel_seguridad']
    ordering_fields = ['precio_hora', 'rating_promedio']
    permission_classes = [IsOwnerOrReadOnly]  

    def get_queryset(self):
        qs = super().get_queryset()
        seguridad = self.request.query_params.getlist('nivel_seguridad')  
        if seguridad:
            qs = qs.filter(nivel_seguridad__in=seguridad)
        # filtro por disponibilidad rápido
        if self.request.query_params.get('available') == 'true':
            qs = qs.filter(plazas_disponibles__gt=0)
        return qs

    @method_decorator(cache_page(60 * 10)) 
    @action(detail=False, methods=['get'])
    def mejores_calificados(self, request):
        qs = self.get_queryset().filter(rating_promedio__gte=4.0)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @method_decorator(cache_page(60 * 5))  
    @action(detail=False, methods=['get'])
    def dashboard_stats(self, request):
        ahora = timezone.now()
        semana_pasada = ahora - timedelta(days=7)

        stats = {
            'total_estacionamientos': ParkingLot.objects.count(),
            'activos': ParkingLot.objects.filter(activo=True).count(),
            'mejor_rating': (ParkingLot.objects.order_by('-rating_promedio').first().nombre if ParkingLot.objects.exists() else None),
            'reseñas_totales': ParkingReview.objects.count(),
            'reservas_por_dia': list(
                ParkingReview.objects.filter(fecha__gte=semana_pasada)
                .annotate(day=TruncDate('fecha'))
                .values('day')
                .annotate(count=Count('id'))
            )
        }
        return Response(stats)

    @action(detail=False, methods=['get'])
    def cerca(self, request):
        lat = request.query_params.get('lat')
        lng = request.query_params.get('lng')
        if not (lat and lng):
            return Response({'error': 'Coordenadas requeridas'}, status=status.HTTP_400_BAD_REQUEST)
        parkings = self.get_queryset()[:30]  
        serializer = self.get_serializer(parkings, many=True)
        return Response(serializer.data)


class ParkingReviewViewSet(viewsets.ModelViewSet):
    queryset = ParkingReview.objects.select_related('usuario', 'parking_lot')
    serializer_class = ParkingReviewSerializer
    permission_classes = [IsOwnerOrReadOnly]  

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated and (user.is_staff or getattr(user, 'is_superuser', False)):
            return self.queryset
        return self.queryset.filter(usuario=self.request.user)

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)
#vista para el panel administrativo

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def dashboard_stats(request):
    """Estadísticas del panel administrativo"""
    if not request.user.is_staff:
        return Response({'error': 'Solo administradores pueden acceder'}, status=403)

    total_users = User.objects.count()
    available_parkings = ParkingLot.objects.filter(plazas_disponibles__gt=0).count()
    total_revenue = Payment.objects.aggregate(total=Sum('monto'))['total'] or 0
    today = timezone.now().date()
    active_reservations = Reservation.objects.filter(fecha_reserva=today, estado__in=['activa', 'confirmada']).count()

    vehicle_distribution = {'cars': 100}
    last_7_days = timezone.now().date() - timedelta(days=7)
    weekly_reservations = [
        {'day': (last_7_days + timedelta(days=i)).strftime('%a'),
         'count': Reservation.objects.filter(fecha_reserva=last_7_days + timedelta(days=i)).count()}
        for i in range(7)
    ]

    return Response({
        'totalUsers': total_users,
        'availableParkings': available_parkings,
        'totalRevenue': total_revenue,
        'activeReservations': active_reservations,
        'vehicleDistribution': vehicle_distribution,
        'weeklyReservations': weekly_reservations
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def recent_reservations(request):
    
    if not request.user.is_staff:
        return Response({'error': 'Solo administradores pueden acceder'}, status=403)

    reservations = Reservation.objects.select_related('usuario', 'estacionamiento').order_by('-fecha_creacion')[:6]

    reservations_data = [{
        'id': r.id,
        'usuario': {'id': r.usuario.id, 'username': r.usuario.username},
        'estacionamiento': {'id': r.estacionamiento.id, 'nombre': r.estacionamiento.nombre},
        'fecha_reserva': r.fecha_reserva,
        'estado': r.estado
    } for r in reservations]

    return Response(reservations_data)
