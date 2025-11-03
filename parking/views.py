# views.py - COMPLETO Y CORREGIDO
from rest_framework import viewsets, filters, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Count, Avg, Sum, F, Q
from django.db.models.functions import TruncDate
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from django.contrib.auth import get_user_model
from datetime import timedelta
import logging

# Permisos DRF
from rest_framework.permissions import IsAuthenticated, IsAdminUser

from .models import ParkingLot, ParkingReview, ParkingApprovalRequest
from .serializers import (
    ParkingLotSerializer, ParkingReviewSerializer,
    ParkingApprovalRequestSerializer, ParkingApprovalActionSerializer,
    ParkingApprovalCreateSerializer, ParkingApprovalDashboardSerializer,
    ApprovalStatisticsSerializer
)
from reservations.models import Reservation
from payments.models import Payment

User = get_user_model()
logger = logging.getLogger(__name__)

# -----------------------------
# Permiso: propietario o lectura
# -----------------------------
try:
    from .permissions import IsOwnerOrReadOnly  
except Exception:
    from rest_framework import permissions as _permissions

    class IsOwnerOrReadOnly(_permissions.BasePermission):
        """Permite editar solo al propietario del objeto."""
        def has_object_permission(self, request, view, obj):
            if request.method in _permissions.SAFE_METHODS:
                return True
            user = request.user
            if not user or not user.is_authenticated:
                return False
            if getattr(user, 'is_staff', False) or getattr(user, 'is_superuser', False):
                return True
            owner = getattr(obj, 'dueno', None) or getattr(obj, 'owner', None) or getattr(obj, 'usuario', None)
            return owner == user

# -----------------------------
# Parking Lots
# -----------------------------
class ParkingLotViewSet(viewsets.ModelViewSet):
    queryset = ParkingLot.objects.all().select_related('dueno').prefetch_related('imagenes')
    serializer_class = ParkingLotSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['nombre', 'direccion', 'nivel_seguridad']
    ordering_fields = ['tarifa_hora', 'rating_promedio']
    permission_classes = [IsOwnerOrReadOnly]  

    def get_queryset(self):
        qs = super().get_queryset()
        seguridad = self.request.query_params.getlist('nivel_seguridad')  
        if seguridad:
            qs = qs.filter(nivel_seguridad__in=seguridad)
        if self.request.query_params.get('available') == 'true':
            qs = qs.filter(plazas_disponibles__gt=0)
        if self.request.query_params.get('aprobado') == 'true':
            qs = qs.filter(aprobado=True)
        return qs

    @method_decorator(cache_page(60 * 10)) 
    @action(detail=False, methods=['get'])
    def mejores_calificados(self, request):
        qs = self.get_queryset().filter(rating_promedio__gte=4.0, aprobado=True)
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
            'aprobados': ParkingLot.objects.filter(aprobado=True).count(),
            'mejor_rating': (
                ParkingLot.objects.order_by('-rating_promedio').first().nombre
                if ParkingLot.objects.exists() else None
            ),
            'reseñas_totales': ParkingReview.objects.count(),
            'reservas_por_dia': list(
                Reservation.objects.filter(hora_entrada__gte=semana_pasada)
                .annotate(day=TruncDate('hora_entrada'))
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
        parkings = self.get_queryset().filter(aprobado=True)[:30]  
        serializer = self.get_serializer(parkings, many=True)
        return Response(serializer.data)

# -----------------------------
# Parking Reviews
# -----------------------------
class ParkingReviewViewSet(viewsets.ModelViewSet):
    queryset = ParkingReview.objects.select_related('usuario', 'estacionamiento')
    serializer_class = ParkingReviewSerializer
    permission_classes = [IsOwnerOrReadOnly]  

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated and (user.is_staff or getattr(user, 'is_superuser', False)):
            return self.queryset
        return self.queryset.filter(usuario=self.request.user)

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)

# -----------------------------
# Parking Approval Requests
# -----------------------------
class ParkingApprovalViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]  
    
    def get_queryset(self):
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return ParkingApprovalRequest.objects.all().select_related(
                'solicitado_por', 'revisado_por', 'estacionamiento_creado'
            )
        return ParkingApprovalRequest.objects.filter(solicitado_por=user).select_related(
            'solicitado_por', 'revisado_por', 'estacionamiento_creado'
        )

    def get_serializer_class(self):
        if self.action == 'create':
            return ParkingApprovalCreateSerializer
        elif self.action in ['pendientes', 'estadisticas']:
            return ParkingApprovalDashboardSerializer
        return ParkingApprovalRequestSerializer

    def perform_create(self, serializer):
        serializer.save(solicitado_por=self.request.user)

    @action(detail=False, methods=['get'])
    def pendientes(self, request):
        if not request.user.is_staff and not request.user.is_superuser:
            return Response({'error': 'Solo administradores pueden ver solicitudes pendientes'}, status=403)
        pendientes = self.get_queryset().filter(status='PENDING')
        serializer = self.get_serializer(pendientes, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def aprobar(self, request, pk=None):
        if not request.user.is_staff and not request.user.is_superuser:
            return Response({'error': 'Solo administradores pueden aprobar solicitudes'}, status=403)
        solicitud = self.get_object()
        if solicitud.status != 'PENDING':
            return Response({'error': 'Esta solicitud ya fue procesada'}, status=400)
        solicitud.aprobar(request.user)
        serializer = ParkingApprovalRequestSerializer(solicitud)
        return Response({'message': 'Solicitud aprobada exitosamente', 'solicitud': serializer.data, 'estacionamiento_creado_id': solicitud.estacionamiento_creado.id if solicitud.estacionamiento_creado else None})

    @action(detail=True, methods=['post'])
    def rechazar(self, request, pk=None):
        if not request.user.is_staff and not request.user.is_superuser:
            return Response({'error': 'Solo administradores pueden rechazar solicitudes'}, status=403)
        solicitud = self.get_object()
        if solicitud.status != 'PENDING':
            return Response({'error': 'Esta solicitud ya fue procesada'}, status=400)
        serializer = ParkingApprovalActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        solicitud.rechazar(request.user, serializer.validated_data.get('motivo', ''))
        resp_serializer = ParkingApprovalRequestSerializer(solicitud)
        return Response({'message': 'Solicitud rechazada', 'solicitud': resp_serializer.data})

    @action(detail=False, methods=['get'])
    def estadisticas(self, request):
        if not request.user.is_staff and not request.user.is_superuser:
            return Response({'error': 'Solo administradores pueden ver estadísticas'}, status=403)
        total = ParkingApprovalRequest.objects.count()
        pendientes = ParkingApprovalRequest.objects.filter(status='PENDING').count()
        aprobadas = ParkingApprovalRequest.objects.filter(status='APPROVED').count()
        rechazadas = ParkingApprovalRequest.objects.filter(status='REJECTED').count()
        stats = {'total_solicitudes': total, 'pendientes': pendientes, 'aprobadas': aprobadas, 'rechazadas': rechazadas, 'tasa_aprobacion': (aprobadas / total * 100) if total > 0 else 0}
        serializer = ApprovalStatisticsSerializer(stats)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def por_panel_local(self, request):
        panel_local_id = request.query_params.get('panel_local_id')
        if not panel_local_id:
            return Response({'error': 'Se requiere panel_local_id'}, status=400)
        solicitudes = self.get_queryset().filter(panel_local_id=panel_local_id)
        serializer = self.get_serializer(solicitudes, many=True)
        return Response(serializer.data)

# -----------------------------
# DASHBOARDS
# -----------------------------
def get_admin_dashboard_data(user):
    """Datos completos para admin"""
    try:
        if not user.is_staff and not user.is_superuser:
            return {'error': 'No tienes permisos de administrador', 'user': {'name': user.username, 'role': 'Usuario'}}, 403
        total_parkings = ParkingLot.objects.count()
        active_parkings = ParkingLot.objects.filter(activo=True).count()
        approved_parkings = ParkingLot.objects.filter(aprobado=True).count()
        total_users = User.objects.count()
        approval_stats = ParkingApprovalRequest.objects.aggregate(
            total=Count('id'),
            pendientes=Count('id', filter=Q(status='PENDING')),
            aprobadas=Count('id', filter=Q(status='APPROVED')),
            rechazadas=Count('id', filter=Q(status='REJECTED'))
        )
        spaces_agg = ParkingLot.objects.aggregate(total=Sum('total_plazas'), available=Sum('plazas_disponibles'))
        total_spaces = spaces_agg['total'] or 0
        available_spaces = spaces_agg['available'] or 0
        occupied_spaces = total_spaces - available_spaces
        today = timezone.now().date()
        active_reservations = Reservation.objects.filter(hora_entrada__date=today, estado__in=['activa','confirmada','pendiente']).count()
        today_revenue = Payment.objects.filter(fecha_pago__date=today, estado='completado').aggregate(total=Sum('monto'))['total'] or 0
        data = {
            'user': {'name': user.get_full_name() or user.username, 'role': 'Administrador General'},
            'stats': {
                'total_parkings': total_parkings,
                'active_parkings': active_parkings,
                'approved_parkings': approved_parkings,
                'total_users': total_users,
                'total_spaces': total_spaces,
                'occupied_spaces': occupied_spaces,
                'available_spaces': available_spaces,
                'active_reservations': active_reservations,
                'today_revenue': today_revenue,
                'solicitudes_pendientes': approval_stats['pendientes'],
                'solicitudes_totales': approval_stats['total']
            }
        }
        return data, 200
    except Exception as e:
        logger.error(f"Error get_admin_dashboard_data: {str(e)}")
        return {'error': f'Error al cargar datos: {str(e)}'}, 500

def get_owner_dashboard_data(user):
    """Datos completos para propietario"""
    try:
        user_parking = ParkingLot.objects.filter(dueno=user).first()
        if not user_parking:
            return {'error': 'No tienes un estacionamiento registrado', 'user': {'name': user.username, 'role': 'Usuario'}}, 404
        approval_status = "Aprobado" if user_parking.aprobado else "Pendiente"
        today = timezone.now().date()
        total_spaces = user_parking.total_plazas or 0
        available_spaces = user_parking.plazas_disponibles or 0
        occupied_spaces = total_spaces - available_spaces
        active_reservations = Reservation.objects.filter(estacionamiento=user_parking, hora_entrada__date=today, estado__in=['activa','confirmada','pendiente']).count()
        today_revenue = Payment.objects.filter(reserva__estacionamiento=user_parking, fecha_pago__date=today, estado='completado').aggregate(total=Sum('monto'))['total'] or 0
        data = {
            'user': {'name': user.get_full_name() or user.username, 'role': 'Propietario'},
            'stats': {
                'total_spaces': total_spaces,
                'occupied_spaces': occupied_spaces,
                'available_spaces': available_spaces,
                'active_reservations': active_reservations,
                'today_revenue': today_revenue,
                'approval_status': approval_status
            },
            'parking_info': {
                'name': user_parking.nombre,
                'total_spaces': total_spaces,
                'address': user_parking.direccion,
                'hourly_rate': user_parking.tarifa_hora,
                'aprobado': user_parking.aprobado,
                'activo': user_parking.activo
            }
        }
        return data, 200
    except Exception as e:
        logger.error(f"Error get_owner_dashboard_data: {str(e)}")
        return {'error': f'Error al cargar datos: {str(e)}', 'user': {'name': user.username, 'role': 'Usuario'}}, 500

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_dashboard_data(request):
    data, status_code = get_admin_dashboard_data(request.user)
    return Response(data, status=status_code)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def owner_dashboard_data(request):
    data, status_code = get_owner_dashboard_data(request.user)
    return Response(data, status=status_code)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_data(request):
    user = request.user
    is_admin = user.is_staff or user.is_superuser
    user_parking = ParkingLot.objects.filter(dueno=user).first()
    is_owner = user_parking is not None
    if is_admin:
        data, status_code = get_admin_dashboard_data(user)
        return Response(data, status=status_code)
    elif is_owner:
        data, status_code = get_owner_dashboard_data(user)
        return Response(data, status=status_code)
    else:
        return Response({'user': {'name': user.get_full_name() or user.username, 'role': 'Usuario'}, 'message': 'Bienvenido al sistema ParkeYa. No tienes un estacionamiento asignado.'})

# -----------------------------
# Estadísticas del panel
# -----------------------------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    if not request.user.is_staff:
        return Response({'error': 'Solo administradores pueden acceder'}, status=403)
    total_users = User.objects.count()
    available_parkings = ParkingLot.objects.filter(plazas_disponibles__gt=0).count()
    approved_parkings = ParkingLot.objects.filter(aprobado=True).count()
    total_revenue = Payment.objects.aggregate(total=Sum('monto'))['total'] or 0
    today = timezone.now().date()
    active_reservations = Reservation.objects.filter(hora_entrada__date=today, estado__in=['activa','confirmada']).count()
    approval_stats = ParkingApprovalRequest.objects.aggregate(pendientes=Count('id', filter=Q(status='PENDING')))
    last_7_days = today - timedelta(days=7)
    weekly_reservations = [{'day': (last_7_days + timedelta(days=i)).strftime('%a'), 'count': Reservation.objects.filter(hora_entrada__date=last_7_days + timedelta(days=i)).count()} for i in range(7)]
    return Response({'totalUsers': total_users, 'availableParkings': available_parkings, 'approvedParkings': approved_parkings, 'totalRevenue': total_revenue, 'activeReservations': active_reservations, 'pendingApprovals': approval_stats['pendientes'], 'weeklyReservations': weekly_reservations})

# -----------------------------
# Últimas reservas
# -----------------------------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def recent_reservations(request):
    if not request.user.is_staff:
        return Response({'error': 'Solo administradores pueden acceder'}, status=403)
    reservations = Reservation.objects.select_related('usuario','estacionamiento').order_by('-created_at')[:6]
    data = [{'id': r.id, 'usuario': {'id': r.usuario.id,'username': r.usuario.username} if r.usuario else None, 'estacionamiento': {'id': r.estacionamiento.id,'nombre': r.estacionamiento.nombre} if r.estacionamiento else None, 'fecha_reserva': r.hora_entrada, 'estado': r.estado} for r in reservations]
    return Response(data)

# -----------------------------
# Registrar parking (solicitud)
# -----------------------------
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def register_parking(request, pk):
    from .models import ParkingRegistration  # Asegúrate de tener este modelo
    try:
        parking = ParkingLot.objects.get(pk=pk)
        registration = ParkingRegistration.objects.create(parking=parking, status='PENDING', submitted_by=request.user)
        return Response({'id': registration.id, 'status': 'PENDING', 'message': 'Solicitud de registro creada'}, status=201)
    except ParkingLot.DoesNotExist:
        return Response({'error': 'Estacionamiento no encontrado'}, status=404)
