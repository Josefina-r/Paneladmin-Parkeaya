from rest_framework import serializers
from django.core.validators import RegexValidator
from .models import ParkingLot, ParkingImage, ParkingReview

class ParkingImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParkingImage
        fields = ['id', 'imagen', 'es_principal', 'creado_en']

class ParkingReviewSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source='usuario.username', read_only=True)
    
    class Meta:
        model = ParkingReview
        fields = ['id', 'usuario', 'usuario_nombre', 'rating', 'comentario', 'creado_en']
        read_only_fields = ['usuario', 'creado_en']

class ParkingLotSerializer(serializers.ModelSerializer):
    # Campos calculados
    esta_abierto = serializers.BooleanField(read_only=True)
    porcentaje_ocupacion = serializers.FloatField(read_only=True)
    distancia_km = serializers.FloatField(read_only=True, required=False)
    
    # Relaciones
    imagenes = ParkingImageSerializer(many=True, read_only=True)
    reseñas = ParkingReviewSerializer(many=True, read_only=True)
    dueno_nombre = serializers.CharField(source='dueno.username', read_only=True)
    
    # Campos para filtros
    nivel_seguridad_display = serializers.CharField(source='get_nivel_seguridad_display', read_only=True)
    
    telefono = serializers.CharField(
        max_length=9,
        validators=[
            RegexValidator(
                regex=r'^9\d{8}$',
                message="El número debe comenzar con 9 y tener 9 dígitos."
            )
        ]
    )

    class Meta:
        model = ParkingLot
        fields = [
            'id', 'dueno', 'dueno_nombre', 'nombre', 'direccion', 'precio_hora',
            'total_plazas', 'plazas_disponibles', 'nivel_seguridad', 'nivel_seguridad_display',
            'descripcion', 'latitud', 'longitud', 'horario_apertura', 'horario_cierre',
            'telefono', 'tiene_camaras', 'tiene_vigilancia_24h', 'acepta_reservas',
            'rating_promedio', 'total_reseñas', 'esta_abierto', 'porcentaje_ocupacion',
            'distancia_km', 'imagenes', 'reseñas', 'creado_en', 'actualizado_en'
        ]
        read_only_fields = ['creado_en', 'actualizado_en', 'rating_promedio', 'total_reseñas']

class ParkingLotListSerializer(serializers.ModelSerializer):
    """Serializer optimizado para listas (menos datos)"""
    esta_abierto = serializers.BooleanField(read_only=True)
    imagen_principal = serializers.SerializerMethodField()
    
    class Meta:
        model = ParkingLot
        fields = [
            'id', 'nombre', 'direccion', 'precio_hora', 'plazas_disponibles',
            'nivel_seguridad', 'latitud', 'longitud', 'esta_abierto',
            'rating_promedio', 'imagen_principal', 'distancia_km'
        ]
    
    def get_imagen_principal(self, obj):
        imagen_principal = obj.imagenes.filter(es_principal=True).first()
        if imagen_principal:
            return imagen_principal.imagen.url
        return None