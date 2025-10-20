from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q, Avg, Count, Value, FloatField
from django.db.models.functions import Coalesce
from django_filters.rest_framework import DjangoFilterBackend
import math
from .models import ParkingLot, ParkingReview
from .serializers import ParkingLotSerializer, ParkingLotListSerializer, ParkingReviewSerializer

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
                
                # Calcular distancias para cada parking
                parkings_con_distancia = []
                for parking in qs.filter(latitud__isnull=False, longitud__isnull=False):
                    distancia = self.calculate_distance(
                        user_lat, user_lng,
                        float(parking.latitud), float(parking.longitud)
                    )
                    if distancia <= radius_km:
                        parking.distancia_km = distancia
                        parkings_con_distancia.append(parking)
                
                # Ordenar por distancia y retornar
                return sorted(parkings_con_distancia, key=lambda x: x.distancia_km)
                
            except (ValueError, TypeError):
                pass
        
        # Filtro por horario de apertura
        if self.request.query_params.get('open_now') == 'true':
            from django.utils import timezone
            ahora = timezone.now().time()
            qs = qs.filter(
                Q(horario_apertura__isnull=True) | 
                Q(horario_apertura__lte=ahora, horario_cierre__gte=ahora)
            )
        
        # Filtro por rating mínimo
        min_rating = self.request.query_params.get('min_rating')
        if min_rating:
            try:
                qs = qs.filter(rating_promedio__gte=float(min_rating))
            except ValueError:
                pass
        
        return qs

    def calculate_distance(self, lat1, lon1, lat2, lon2):
        """Calcula distancia usando fórmula haversine (precisa)"""
        from math import radians, sin, cos, sqrt, atan2
        
        R = 6371  # Radio de la Tierra en km
        
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
        """
        Endpoint optimizado para el mapa de Kotlin
        Devuelve solo datos esenciales para markers
        """
        parkings = self.get_queryset().filter(
            latitud__isnull=False,
            longitud__isnull=False
        )
        
        # Solo campos esenciales para el mapa
        data = []
        for parking in parkings:
            data.append({
                'id': parking.id,
                'nombre': parking.nombre,
                'latitud': float(parking.latitud),
                'longitud': float(parking.longitud),
                'precio_hora': str(parking.precio_hora),
                'plazas_disponibles': parking.plazas_disponibles,
                'nivel_seguridad': parking.nivel_seguridad,
                'esta_abierto': parking.esta_abierto,
                'rating_promedio': float(parking.rating_promedio),
            })
        
        return Response({
            'count': len(data),
            'results': data
        })

    @action(detail=False, methods=['get'])
    def estadisticas(self, request):
        """
        Estadísticas generales de todos los parkings
        """
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
        """
        Estadísticas detalladas de un parking específico
        """
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
        """
        Agregar reseña a un parking
        """
        parking = self.get_object()
        serializer = ParkingReviewSerializer(data=request.data)
        
        if serializer.is_valid():
            # Verificar si el usuario ya hizo una reseña
            existing_review = ParkingReview.objects.filter(
                parking_lot=parking, 
                usuario=request.user
            ).first()
            
            if existing_review:
                return Response(
                    {'error': 'Ya has realizado una reseña para este parking'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            serializer.save(parking_lot=parking, usuario=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def reseñas(self, request, pk=None):
        """
        Obtener todas las reseñas de un parking
        """
        parking = self.get_object()
        reseñas = parking.reseñas.select_related('usuario').all()
        serializer = ParkingReviewSerializer(reseñas, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def mejores_calificados(self, request):
        """
        Top 10 parkings mejor calificados
        """
        mejores = self.get_queryset().filter(
            rating_promedio__gt=0,
            total_reseñas__gte=1
        ).order_by('-rating_promedio', '-total_reseñas')[:10]
        
        serializer = self.get_serializer(mejores, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def mas_economicos(self, request):
        """
        Top 10 parkings más económicos
        """
        economicos = self.get_queryset().filter(
            precio_hora__gt=0
        ).order_by('precio_hora')[:10]
        
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