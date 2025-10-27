from rest_framework import serializers
from .models import Ticket, TicketHistory
from reservations.serializers import ReservationDetailSerializer

class TicketHistorySerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source='usuario.username', read_only=True)
    
    class Meta:
        model = TicketHistory
        fields = [
            'accion', 'detalles', 'usuario_nombre', 'fecha_creacion', 
            'ip_address', 'user_agent'
        ]
        read_only_fields = fields

class TicketSerializer(serializers.ModelSerializer):
    reserva = ReservationDetailSerializer(read_only=True)
    codigo_ticket = serializers.CharField(read_only=True)
    historial = TicketHistorySerializer(many=True, read_only=True)
    
    # Campos calculados
    puede_validar = serializers.SerializerMethodField()
    tiempo_restante = serializers.SerializerMethodField()
    qr_data_json = serializers.SerializerMethodField()
    qr_image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Ticket
        fields = [
            'id', 'codigo_ticket', 'reserva', 'qr_image', 'qr_image_url',
            'estado', 'fecha_emision', 'fecha_validez_desde', 'fecha_validez_hasta',
            'fecha_validacion', 'fecha_expiracion', 'validado_por', 
            'intentos_validacion', 'puede_validar', 'tiempo_restante',
            'qr_data_json', 'historial'
        ]
        read_only_fields = [
            'id', 'codigo_ticket', 'qr_image', 'fecha_emision', 
            'fecha_validacion', 'fecha_expiracion', 'validado_por',
            'intentos_validacion', 'historial'
        ]

    def get_puede_validar(self, obj):
        puede, mensaje = obj.puede_validar
        return {
            'puede': puede,
            'mensaje': mensaje
        }

    def get_tiempo_restante(self, obj):
        return obj.tiempo_restante_validez

    def get_qr_data_json(self, obj):
     
        if obj.qr_data:
            import json
            try:
                return json.loads(obj.qr_data)
            except json.JSONDecodeError:
                return {}
        return {}

    def get_qr_image_url(self, obj):
       
        if obj.qr_image:
            return obj.qr_image.url
        return None


class ValidateTicketSerializer(serializers.Serializer):
    """Serializer para validación de tickets"""
    codigo_ticket = serializers.CharField(max_length=50, required=False)
    qr_data = serializers.CharField(required=False)
    
    def validate(self, attrs):
        codigo_ticket = attrs.get('codigo_ticket')
        qr_data = attrs.get('qr_data')
        
        if not codigo_ticket and not qr_data:
            raise serializers.ValidationError(
                "Se requiere código de ticket o datos QR"
            )
        
        return attrs


class TicketValidationResponseSerializer(serializers.Serializer):
    """Serializer para respuesta de validación"""
    valido = serializers.BooleanField()
    mensaje = serializers.CharField()
    ticket = TicketSerializer(read_only=True, required=False)
    reserva = ReservationDetailSerializer(read_only=True, required=False)