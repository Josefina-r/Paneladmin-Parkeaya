from django.shortcuts import render

# Create your views here.
from rest_framework import viewsets, permissions
from .models import Ticket
from .serializers import TicketSerializer

class TicketViewSet(viewsets.ModelViewSet):
    queryset = Ticket.objects.all().order_by('-fecha_emision')
    serializer_class = TicketSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or getattr(user, 'rol', None) == 'admin':
            return Ticket.objects.all()
        # tickets del usuario (vía reserva.usuario)
        return Ticket.objects.filter(reserva__usuario=user).order_by('-fecha_emision')
