from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from django.db.models import Q, Avg, Count, Sum, Value, FloatField
from django.db.models.functions import Coalesce
from django_filters.rest_framework import DjangoFilterBackend
import math
from django.utils import timezone
from datetime import timedelta

from django.contrib.auth import get_user_model
from .models import ParkingLot, ParkingReview
from .serializers import ParkingLotSerializer, ParkingLotListSerializer, ParkingReviewSerializer
from reservations.models import Reservation
from payments.models import Payment

User = get_user_model()


class ParkingLotViewSet(viewsets.ModelViewSet):
    queryset = ParkingLot.objects.all().select_related('dueno').prefetch_related('imagenes', 'reseñas')
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['nombre', 'direccion', 'descripcion']
    ordering_fields = ['precio_hora', 'rating_promedio', 'nivel_seguridad', 'creado_en']
    ordering = ['-creado_en']
    
    filterset_fields = {
        'precio_hora': ['lte', 'gte'],
        'nivel_seguridad': ['exact', 'gte'],
        'plazas_disponibles': ['gte'],
        'tiene_camaras': ['exact'],
        'tiene_vigilancia_24h': ['exact'],
        'acepta_reservas': ['exact'],
    }

    def get_serializer_class(self):
        if self.action == 'list':
            return ParkingLotListSerializer
        return ParkingLotSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        
        # Filtro por disponibilidad
        if self.request.query_params.get('available') == 'true':
            qs = qs.filter(plazas_disponibles__gt=0)
        
        # Filtro por coordenadas y radio
        lat = self.request.query_params.get('lat')
        lng = self.request.query_params.get('lng')
        radius = self.request.query_params.get('radius')
        
        if lat and lng and radius:
            try:
                user_lat = float(lat)
                user_lng = float(lng)
                radius_km = float(radius)
                
                parkings_con_distancia = []
                for parking in qs.filter(latitud__isnull=False, longitud__isnull=False):
                    distancia = self.calculate_distance(
                        user_lat, user_lng,
                        float(parking.latitud), float(parking.longitud)
                    )
                    if distancia <= radius_km:
                        parking.distancia_km = distancia
                        parkings_con_distancia.append(parking)
                
                return sorted(parkings_con_distancia, key=lambda x: x.distancia_km)
                
            except (ValueError, TypeError):
                pass
        
        # Filtro por horario 
        if self.request.query_params.get('open_now') == 'true':
            ahora = timezone.now().time()
            qs = qs.filter(
                Q(horario_apertura__isnull=True) | 
                Q(horario_apertura__lte=ahora, horario_cierre__gte=ahora)
            )
        
       
        min_rating = self.request.query_params.get('min_rating')
        if min_rating:
            try:
                qs = qs.filter(rating_promedio__gte=float(min_rating))
            except ValueError:
                pass
        
        return qs

    def calculate_distance(self, lat1, lon1, lat2, lon2):
       
        from math import radians, sin, cos, sqrt, atan2
        
        R = 6371  
        
        try:
            lat1, lon1, lat2, lon2 = map(float, [lat1, lon1, lat2, lon2])
            lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
            
            dlat = lat2 - lat1
            dlon = lon2 - lon1
            
            a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
            c = 2 * atan2(sqrt(a), sqrt(1-a))
            
            return R * c
        except (TypeError, ValueError):
            return float('inf')

    @action(detail=False, methods=['get'])
    def mapa(self, request):
        
        parkings = self.get_queryset().filter(latitud__isnull=False, longitud__isnull=False)
        
        data = [{
            'id': p.id,
            'nombre': p.nombre,
            'latitud': float(p.latitud),
            'longitud': float(p.longitud),
            'precio_hora': str(p.precio_hora),
            'plazas_disponibles': p.plazas_disponibles,
            'nivel_seguridad': p.nivel_seguridad,
            'esta_abierto': p.esta_abierto,
            'rating_promedio': float(p.rating_promedio),
        } for p in parkings]
        
        return Response({'count': len(data), 'results': data})

    @action(detail=False, methods=['get'])
    def estadisticas(self, request):
        
        stats = ParkingLot.objects.aggregate(
            total_parkings=Count('id'),
            total_plazas=Coalesce(Sum('total_plazas'), Value(0)),
            plazas_disponibles=Coalesce(Sum('plazas_disponibles'), Value(0)),
            precio_promedio=Coalesce(Avg('precio_hora'), Value(0)),
            rating_promedio=Coalesce(Avg('rating_promedio'), Value(0))
        )
        return Response(stats)

    @action(detail=True, methods=['get'])
    def estadisticas_detalle(self, request, pk=None):
        
        parking = self.get_object()
        stats = {
            'id': parking.id,
            'nombre': parking.nombre,
            'porcentaje_ocupacion': parking.porcentaje_ocupacion,
            'total_reseñas': parking.total_reseñas,
            'rating_promedio': float(parking.rating_promedio),
            'esta_abierto': parking.esta_abierto,
            'horario_actual': f"{parking.horario_apertura} - {parking.horario_cierre}" if parking.horario_apertura else "24/7",
        }
        return Response(stats)

    @action(detail=True, methods=['post'])
    def agregar_resena(self, request, pk=None):
        
        parking = self.get_object()
        serializer = ParkingReviewSerializer(data=request.data)
        
        if serializer.is_valid():
            existing_review = ParkingReview.objects.filter(parking_lot=parking, usuario=request.user).first()
            if existing_review:
                return Response({'error': 'Ya hiciste una reseña para este parking'}, status=400)
            
            serializer.save(parking_lot=parking, usuario=request.user)
            return Response(serializer.data, status=201)
        
        return Response(serializer.errors, status=400)

    @action(detail=True, methods=['get'])
    def reseñas(self, request, pk=None):
        """Obtener reseñas de un parking"""
        parking = self.get_object()
        reseñas = parking.reseñas.select_related('usuario').all()
        serializer = ParkingReviewSerializer(reseñas, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def mejores_calificados(self, request):
        """Top 10 parkings mejor calificados"""
        mejores = self.get_queryset().filter(rating_promedio__gt=0, total_reseñas__gte=1).order_by('-rating_promedio', '-total_reseñas')[:10]
        serializer = self.get_serializer(mejores, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def mas_economicos(self, request):
        """Top 10 parkings más económicos"""
        economicos = self.get_queryset().filter(precio_hora__gt=0).order_by('precio_hora')[:10]
        serializer = self.get_serializer(economicos, many=True)
        return Response(serializer.data)


class ParkingReviewViewSet(viewsets.ModelViewSet):
    queryset = ParkingReview.objects.all().select_related('usuario', 'parking_lot')
    serializer_class = ParkingReviewSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
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
