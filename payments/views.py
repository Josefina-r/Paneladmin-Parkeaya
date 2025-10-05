from django.shortcuts import render

# Create your views here.
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from .models import Payment
from .serializers import PaymentSerializer

# para crear ticket cuando se confirme el pago
class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all().order_by('-fecha_pago')
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        payment = serializer.save()
        # Si el pago se crea con estado 'pagado', podrías generar el ticket aquí
        if payment.estado == 'pagado':
            try:
                from tickets.models import Ticket
                Ticket.objects.create(reserva=payment.reserva)
            except Exception:
                # evita fallo si tickets app no está listo
                pass
