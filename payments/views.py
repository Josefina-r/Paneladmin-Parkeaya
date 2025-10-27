# payments/views.py
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone

from .models import Payment
from .serializers import PaymentSerializer, CreatePaymentSerializer, RefundPaymentSerializer
from .tasks import enviar_comprobante_pago, notificar_pago_propietario

class PaymentViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.is_staff or getattr(user, 'rol', None) == 'admin':
            return Payment.objects.all().select_related('reserva', 'usuario')
        elif getattr(user, 'rol', None) == 'owner':
            # Dueños ven pagos de sus estacionamientos
            return Payment.objects.filter(
                reserva__estacionamiento__owner=user
            ).select_related('reserva', 'usuario')
        return Payment.objects.filter(usuario=user).select_related('reserva')

    def get_serializer_class(self):
        if self.action == 'create':
            return CreatePaymentSerializer
        elif self.action == 'refund':
            return RefundPaymentSerializer
        return PaymentSerializer

    def perform_create(self, serializer):
        """Sobrescribir para manejar la creación con transaction.atomic"""
        with transaction.atomic():
            payment = serializer.save()
            
            # Para Yape/Plin, el pago queda pendiente hasta confirmación
            if payment.metodo in ['yape', 'plin']:
                payment.estado = 'pendiente'
                payment.save()
                
                # Programar verificación periódica
                from .tasks import verificar_pago_pendiente
                verificar_pago_pendiente.apply_async(
                    args=[payment.id], 
                    countdown=300  # 5 minutos
                )

    @action(detail=True, methods=['post'])
    def process(self, request, pk=None):
        """Procesar pago pendiente (para Yape/Plin manual)"""
        payment = self.get_object()
        
        if payment.estado != 'pendiente':
            return Response(
                {'detail': 'El pago ya ha sido procesado.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            with transaction.atomic():
                success = payment.procesar_pago()
                
                if success:
                    return Response(
                        {'detail': 'Pago procesado exitosamente.', 'payment': PaymentSerializer(payment).data},
                        status=status.HTTP_200_OK
                    )
                else:
                    return Response(
                        {'detail': 'Error al procesar el pago.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                    
        except Exception as e:
            return Response(
                {'detail': f'Error: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def refund(self, request, pk=None):
        """Solicitar reembolso"""
        payment = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Verificar permisos
        user = request.user
        if payment.usuario != user and not (user.is_staff or payment.reserva.estacionamiento.owner == user):
            return Response(
                {'detail': 'No tiene permisos para reembolsar este pago.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if not payment.puede_reembolsar:
            return Response(
                {'detail': 'Este pago no puede ser reembolsado.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            with transaction.atomic():
                monto_parcial = serializer.validated_data.get('monto_parcial')
                success = payment.reembolsar(monto_parcial)
                
                if success:
                    return Response(
                        {'detail': 'Reembolso procesado exitosamente.'},
                        status=status.HTTP_200_OK
                    )
                else:
                    return Response(
                        {'detail': 'Error al procesar el reembolso.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                    
        except Exception as e:
            return Response(
                {'detail': f'Error: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Obtener pagos pendientes del usuario"""
        payments = self.get_queryset().filter(
            usuario=request.user,
            estado='pendiente'
        )
        serializer = self.get_serializer(payments, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_parking(self, request, parking_id=None):
        """Obtener pagos por estacionamiento (para dueños)"""
        if not request.user.is_staff and getattr(request.user, 'rol', None) != 'owner':
            return Response(
                {'detail': 'No autorizado.'},
                status=status.HTTP_403_FORBIDDEN
            )

        payments = self.get_queryset().filter(
            reserva__estacionamiento_id=parking_id
        )
        
        # Filtros
        estado = request.GET.get('estado')
        fecha_desde = request.GET.get('fecha_desde')
        fecha_hasta = request.GET.get('fecha_hasta')
        
        if estado:
            payments = payments.filter(estado=estado)
        if fecha_desde:
            payments = payments.filter(fecha_creacion__date__gte=fecha_desde)
        if fecha_hasta:
            payments = payments.filter(fecha_creacion__date__lte=fecha_hasta)
            
        serializer = self.get_serializer(payments, many=True)
        return Response(serializer.data)