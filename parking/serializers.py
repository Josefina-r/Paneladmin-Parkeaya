from rest_framework import serializers
from django.core.validators import RegexValidator
from .models import ParkingLot

class ParkingLotSerializer(serializers.ModelSerializer):
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
        fields = '__all__'
        read_only_fields = ['creado_en']
