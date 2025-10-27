# reservations/serializers.py
from django.utils import timezone
from rest_framework import serializers

from .models import Reservation
from users.models import Car
from parking.models import ParkingLot
from users.serializers import CarSerializer, UserSerializer
from parking.serializers import ParkingLotSerializer

class ReservationDetailSerializer(serializers.ModelSerializer):
    usuario = UserSerializer(read_only=True)
    vehiculo = CarSerializer(read_only=True)
    estacionamiento = ParkingLotSerializer(read_only=True)
    
    class Meta:
        model = Reservation
        fields = [
            'id', 'codigo_reserva', 'usuario', 'vehiculo', 'estacionamiento',
            'hora_entrada', 'hora_salida', 'duracion_minutos', 'costo_estimado',
            'estado', 'created_at'
        ]
        read_only_fields = fields

class ReservationSerializer(serializers.ModelSerializer):
    usuario = UserSerializer(read_only=True)
    vehiculo = serializers.PrimaryKeyRelatedField(queryset=Car.objects.all())
    estacionamiento = serializers.PrimaryKeyRelatedField(queryset=ParkingLot.objects.all())
    tiempo_restante = serializers.SerializerMethodField()
    puede_cancelar = serializers.SerializerMethodField()

    class Meta:
        model = Reservation
        fields = [
            'id', 'codigo_reserva', 'usuario', 'vehiculo', 'estacionamiento',
            'hora_entrada', 'hora_salida', 'duracion_minutos', 'costo_estimado',
            'estado', 'created_at', 'tiempo_restante', 'puede_cancelar'
        ]
        read_only_fields = ['codigo_reserva', 'created_at', 'estado', 'costo_estimado', 'usuario']

    def get_tiempo_restante(self, obj):
        if obj.estado == 'activa' and obj.hora_entrada:
            now = timezone.now()
            if obj.hora_entrada > now:
                return int((obj.hora_entrada - now).total_seconds() / 60)
        return None

    def get_puede_cancelar(self, obj):
        return (obj.estado == 'activa' and 
                obj.hora_entrada > timezone.now())