from rest_framework import serializers
from django.core.validators import RegexValidator
from .models import ParkingLot, ParkingImage, ParkingReview, ParkingApprovalRequest
from django.contrib.auth import get_user_model

User = get_user_model()

# ----------------------------
# Parking Images & Reviews
# ----------------------------
class ParkingImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParkingImage
        fields = ['id', 'imagen', 'descripcion', 'creado_en']

class ParkingReviewSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source='usuario.username', read_only=True)

    class Meta:
        model = ParkingReview
        fields = ['id', 'usuario', 'usuario_nombre', 'calificacion', 'comentario', 'fecha']
        read_only_fields = ['usuario', 'fecha']

# ----------------------------
# Parking Lots
# ----------------------------
class ParkingLotSerializer(serializers.ModelSerializer):
    esta_abierto = serializers.BooleanField(read_only=True)
    porcentaje_ocupacion = serializers.SerializerMethodField()
    distancia_km = serializers.FloatField(read_only=True, required=False)
    imagenes = ParkingImageSerializer(many=True, read_only=True)
    reseñas = ParkingReviewSerializer(many=True, read_only=True)
    dueno_nombre = serializers.CharField(source='dueno.username', read_only=True)

    telefono = serializers.CharField(
        validators=[
            RegexValidator(
                regex=r'^\+?1?\d{9,15}$',
                message="Número de teléfono inválido."
            )
        ]
    )

    class Meta:
        model = ParkingLot
        fields = [
            'id', 'dueno', 'dueno_nombre', 'nombre', 'direccion',
            'tarifa_hora', 'total_plazas', 'plazas_disponibles',
            'nivel_seguridad', 'descripcion', 'coordenadas',
            'horario_apertura', 'horario_cierre', 'telefono',
            'rating_promedio', 'total_reseñas', 'esta_abierto',
            'porcentaje_ocupacion', 'distancia_km', 'imagenes',
            'reseñas', 'aprobado', 'activo'
        ]
        read_only_fields = ['rating_promedio', 'total_reseñas']

    def get_porcentaje_ocupacion(self, obj):
        if obj.total_plazas > 0:
            return ((obj.total_plazas - obj.plazas_disponibles) / obj.total_plazas) * 100
        return 0

class ParkingLotListSerializer(serializers.ModelSerializer):
    esta_abierto = serializers.BooleanField(read_only=True)
    imagen_principal = serializers.SerializerMethodField()
    porcentaje_ocupacion = serializers.SerializerMethodField()

    class Meta:
        model = ParkingLot
        fields = [
            'id', 'nombre', 'direccion', 'tarifa_hora', 'plazas_disponibles',
            'nivel_seguridad', 'coordenadas', 'esta_abierto',
            'rating_promedio', 'imagen_principal', 'distancia_km',
            'porcentaje_ocupacion', 'aprobado', 'activo'
        ]

    def get_imagen_principal(self, obj):
        imagen_principal = obj.imagenes.first()
        if imagen_principal:
            return imagen_principal.imagen.url
        return None

    def get_porcentaje_ocupacion(self, obj):
        if obj.total_plazas > 0:
            return ((obj.total_plazas - obj.plazas_disponibles) / obj.total_plazas) * 100
        return 0

# ----------------------------
# Parking Approval System
# ----------------------------
class ParkingApprovalRequestSerializer(serializers.ModelSerializer):
    solicitado_por_nombre = serializers.CharField(source='solicitado_por.username', read_only=True)
    revisado_por_nombre = serializers.CharField(source='revisado_por.username', read_only=True)
    dias_pendiente = serializers.ReadOnlyField()
    estacionamiento_creado_id = serializers.IntegerField(source='estacionamiento_creado.id', read_only=True)

    class Meta:
        model = ParkingApprovalRequest
        fields = [
            'id', 'nombre', 'direccion', 'coordenadas', 'telefono', 'descripcion',
            'horario_apertura', 'horario_cierre', 'nivel_seguridad', 'tarifa_hora',
            'total_plazas', 'plazas_disponibles', 'servicios', 'panel_local_id',
            'notas_aprobacion', 'motivo_rechazo', 'status', 'solicitado_por',
            'solicitado_por_nombre', 'revisado_por', 'revisado_por_nombre',
            'fecha_solicitud', 'fecha_revision', 'estacionamiento_creado',
            'estacionamiento_creado_id', 'dias_pendiente'
        ]
        read_only_fields = ['solicitado_por', 'fecha_solicitud', 'fecha_revision', 'estacionamiento_creado']

class ParkingApprovalActionSerializer(serializers.Serializer):
    motivo = serializers.CharField(required=False, allow_blank=True)

class ParkingApprovalCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParkingApprovalRequest
        fields = [
            'nombre', 'direccion', 'coordenadas', 'telefono', 'descripcion',
            'horario_apertura', 'horario_cierre', 'nivel_seguridad', 'tarifa_hora',
            'total_plazas', 'plazas_disponibles', 'servicios', 'panel_local_id',
            'notas_aprobacion'
        ]

class ParkingApprovalDashboardSerializer(serializers.ModelSerializer):
    solicitado_por_nombre = serializers.CharField(source='solicitado_por.username', read_only=True)
    dias_pendiente = serializers.ReadOnlyField()

    class Meta:
        model = ParkingApprovalRequest
        fields = [
            'id', 'nombre', 'direccion', 'tarifa_hora', 'total_plazas',
            'nivel_seguridad', 'fecha_solicitud', 'status', 'solicitado_por_nombre',
            'dias_pendiente', 'panel_local_id'
        ]

# ----------------------------
# Dashboard Serializers
# ----------------------------
class DashboardStatsSerializer(serializers.Serializer):
    total_parkings = serializers.IntegerField()
    active_parkings = serializers.IntegerField()
    approved_parkings = serializers.IntegerField()
    total_users = serializers.IntegerField()
    total_spaces = serializers.IntegerField()
    occupied_spaces = serializers.IntegerField()
    available_spaces = serializers.IntegerField()
    active_reservations = serializers.IntegerField()
    today_revenue = serializers.DecimalField(max_digits=10, decimal_places=2)

class OccupationStatsSerializer(serializers.Serializer):
    total_spaces = serializers.IntegerField()
    occupied_spaces = serializers.IntegerField()
    available_spaces = serializers.IntegerField()
    reserved_spaces = serializers.IntegerField()

class UpcomingReservationSerializer(serializers.Serializer):
    time = serializers.CharField()
    user = serializers.CharField()
    parking = serializers.CharField(required=False)

class ReservationStatsSerializer(serializers.Serializer):
    active_today = serializers.IntegerField()
    change_from_yesterday = serializers.CharField()
    upcoming = UpcomingReservationSerializer(many=True)

class UserInfoSerializer(serializers.Serializer):
    name = serializers.CharField()
    role = serializers.CharField()

class ParkingInfoSerializer(serializers.Serializer):
    name = serializers.CharField()
    total_spaces = serializers.IntegerField()
    address = serializers.CharField()
    hourly_rate = serializers.DecimalField(max_digits=6, decimal_places=2)
    aprobado = serializers.BooleanField()
    activo = serializers.BooleanField()

class SystemInfoSerializer(serializers.Serializer):
    total_parkings = serializers.IntegerField()
    total_users = serializers.IntegerField()

class AdminDashboardSerializer(serializers.Serializer):
    user = UserInfoSerializer()
    stats = DashboardStatsSerializer()
    occupation = OccupationStatsSerializer()
    reservations = ReservationStatsSerializer()
    system_info = SystemInfoSerializer()
    pending_requests = serializers.ListField(child=serializers.DictField())

class OwnerDashboardSerializer(serializers.Serializer):
    user = UserInfoSerializer()
    stats = DashboardStatsSerializer()
    occupation = OccupationStatsSerializer()
    reservations = ReservationStatsSerializer()
    parking_info = ParkingInfoSerializer()

class ApprovalStatisticsSerializer(serializers.Serializer):
    total_solicitudes = serializers.IntegerField()
    pendientes = serializers.IntegerField()
    aprobadas = serializers.IntegerField()
    rechazadas = serializers.IntegerField()
    tasa_aprobacion = serializers.FloatField()
