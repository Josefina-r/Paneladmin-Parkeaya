from rest_framework import serializers
from .models import Reservation
from users.serializers import CarSerializer, UserSerializer
from parking.serializers import ParkingLotSerializer

class ReservationSerializer(serializers.ModelSerializer):
    usuario = UserSerializer(read_only=True)
    from users.models import Car
    from parking.models import ParkingLot
    vehiculo = serializers.PrimaryKeyRelatedField(queryset=Car.objects.none())
    estacionamiento = serializers.PrimaryKeyRelatedField(queryset=ParkingLot.objects.none())

    class Meta:
        model = Reservation
        fields = [
            'id','codigo_reserva','usuario','vehiculo','estacionamiento',
            'hora_entrada','hora_salida','duracion_minutos','costo_estimado',
            'estado','created_at'
        ]
        read_only_fields = ['codigo_reserva','created_at','estado','costo_estimado']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # set queryset dynamically to avoid circular imports at import-time
        from users.models import Car
        from parking.models import ParkingLot
        self.fields['vehiculo'].queryset = Car.objects.all()
        self.fields['estacionamiento'].queryset = ParkingLot.objects.all()
