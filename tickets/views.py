# tickets/views.py
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.utils import timezone

from .models import Ticket, TicketHistory
from .serializers import (
    TicketSerializer, ValidateTicketSerializer, 
    TicketValidationResponseSerializer
)
from .tasks import enviar_ticket_usuario, notificar_validacion_propietario

class TicketViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.is_staff or getattr(user, 'rol', None) == 'admin':
            return Ticket.objects.all().select_related(
                'reserva', 'reserva__usuario', 'reserva__estacionamiento'
            )
        elif getattr(user, 'rol', None) == 'owner':
            # Dueños ven tickets de sus estacionamientos
            return Ticket.objects.filter(
                reserva__estacionamiento__owner=user
            ).select_related('reserva', 'reserva__usuario')
        else:
            # Usuarios ven sus propios tickets
            return Ticket.objects.filter(
                reserva__usuario=user
            ).select_related('reserva', 'reserva__estacionamiento')

    def get_serializer_class(self):
        return TicketSerializer

    def perform_create(self, serializer):
        """Sobrescribir para agregar lógica personalizada"""
        ticket = serializer.save()
        
        # Enviar ticket por email
        enviar_ticket_usuario.delay(ticket.id)

    @action(detail=True, methods=['post'])
    def validate_ticket(self, request, pk=None):
        """Validar ticket (check-in)"""
        ticket = self.get_object()
        user = request.user
        
        # Verificar permisos (solo dueños o admin pueden validar)
        if not (user.is_staff or 
                getattr(user, 'rol', None) in ['admin', 'owner'] or
                ticket.reserva.estacionamiento.owner == user):
            return Response(
                {'detail': 'No tiene permisos para validar tickets.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Validar ticket
        success, mensaje = ticket.validar_ticket(user)
        
        if success:
            # Notificar al propietario y usuario
            notificar_validacion_propietario.delay(ticket.id)
            
            return Response(
                TicketValidationResponseSerializer({
                    'valido': True,
                    'mensaje': mensaje,
                    'ticket': ticket,
                    'reserva': ticket.reserva
                }).data,
                status=status.HTTP_200_OK
            )
        else:
            return Response(
                TicketValidationResponseSerializer({
                    'valido': False,
                    'mensaje': mensaje
                }).data,
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancelar ticket"""
        ticket = self.get_object()
        user = request.user
        
        # Verificar permisos
        if ticket.reserva.usuario != user and not user.is_staff:
            return Response(
                {'detail': 'No tiene permisos para cancelar este ticket.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        motivo = request.data.get('motivo', 'Cancelado por el usuario')
        ticket.cancelar_ticket(motivo)
        
        return Response(
            {'detail': 'Ticket cancelado exitosamente.'},
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['get'])
    def validos(self, request):
        """Obtener tickets válidos del usuario"""
        tickets = self.get_queryset().filter(
            estado='valido',
            fecha_validez_hasta__gt=timezone.now()
        )
        serializer = self.get_serializer(tickets, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_parking(self, request, parking_id=None):
        """Obtener tickets por estacionamiento (para dueños)"""
        if not request.user.is_staff and getattr(request.user, 'rol', None) != 'owner':
            return Response(
                {'detail': 'No autorizado.'},
                status=status.HTTP_403_FORBIDDEN
            )

        tickets = self.get_queryset().filter(
            reserva__estacionamiento_id=parking_id
        )
        
        # Filtros
        estado = request.GET.get('estado')
        fecha = request.GET.get('fecha')
        
        if estado:
            tickets = tickets.filter(estado=estado)
        if fecha:
            tickets = tickets.filter(fecha_emision__date=fecha)
            
        serializer = self.get_serializer(tickets, many=True)
        return Response(serializer.data)


class TicketValidationAPIView(APIView):
    """API pública para validación de tickets via QR"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        """Validar ticket usando código o QR data"""
        serializer = ValidateTicketSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        codigo_ticket = serializer.validated_data.get('codigo_ticket')
        qr_data = serializer.validated_data.get('qr_data')
        
        # Buscar ticket
        try:
            if codigo_ticket:
                ticket = Ticket.objects.get(codigo_ticket=codigo_ticket)
            else:
                # Parsear QR data
                import json
                qr_json = json.loads(qr_data)
                ticket_id = qr_json.get('ticket_id')
                ticket = Ticket.objects.get(id=ticket_id)
                
        except Ticket.DoesNotExist:
            return Response(
                {'valido': False, 'mensaje': 'Ticket no encontrado.'},
                status=status.HTTP_404_NOT_FOUND
            )
        except (json.JSONDecodeError, KeyError):
            return Response(
                {'valido': False, 'mensaje': 'Datos QR inválidos.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verificar que el usuario tenga permisos para validar este ticket
        user = request.user
        if not (user.is_staff or 
                getattr(user, 'rol', None) in ['admin', 'owner'] or
                ticket.reserva.estacionamiento.owner == user):
            return Response(
                {'valido': False, 'mensaje': 'No autorizado para validar este ticket.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Validar ticket
        success, mensaje = ticket.validar_ticket(user)
        
        response_data = {
            'valido': success,
            'mensaje': mensaje,
            'ticket': TicketSerializer(ticket).data if success else None
        }
        
        status_code = status.HTTP_200_OK if success else status.HTTP_400_BAD_REQUEST
        return Response(response_data, status=status_code)