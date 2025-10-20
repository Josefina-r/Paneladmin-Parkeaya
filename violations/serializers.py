from rest_framework import serializers
from .models import Violation
from users.serializers import UserSerializer
from parking.serializers import ParkingLotSerializer

class ViolationSerializer(serializers.ModelSerializer):
    reported_by_user_details = UserSerializer(source='reported_by_user', read_only=True)
    reported_by_parking_details = ParkingLotSerializer(source='reported_by_parking', read_only=True)
    parking_lot_details = ParkingLotSerializer(source='parking_lot', read_only=True)
    
    class Meta:
        model = Violation
        fields = [
            'id',
            'ticket_number',
            'license_plate',
            'violation_type',
            'description',
            'location',
            'severity',
            'status',
            'reported_by_user',
            'reported_by_parking',
            'parking_lot',
            'reservation',
            'fine_amount',
            'evidence',
            'notes',
            'resolution_notes',
            'created_at',
            'updated_at',
            'resolved_at',
            'reported_by_user_details',
            'reported_by_parking_details',
            'parking_lot_details',
        ]
        read_only_fields = ['ticket_number', 'created_at', 'updated_at']

    def validate(self, data):
        # Validar que al menos un reportante esté especificado
        reported_by_user = data.get('reported_by_user')
        reported_by_parking = data.get('reported_by_parking')
        
        if not reported_by_user and not reported_by_parking:
            raise serializers.ValidationError(
                "Debe especificar al menos un reportante (usuario o estacionamiento)."
            )
        
        return data