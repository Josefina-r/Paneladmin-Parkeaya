from django.shortcuts import render

# Create your views here.
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone
from datetime import timedelta

from .models import Reservation
from .serializers import ReservationSerializer
from parking.models import ParkingLot

class ReservationViewSet(viewsets.ModelViewSet):
    queryset = Reservation.objects.all().order_by('-created_at')
    serializer_class = ReservationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # usuarios ven sus reservas; staff ve todo
        user = self.request.user
        if user.is_superuser or getattr(user, 'rol', None) == 'admin':
            return Reservation.objects.all().order_by('-created_at')
        return Reservation.objects.filter(usuario=user).order_by('-created_at')

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """
        - Recibe vehiculo (id), estacionamiento (id), hora_entrada (ISO), duracion_minutos (int)
        - Verifica plazas con select_for_update para evitar overbooking
        - Calcula hora_salida y costo_estimado
        """
        data = request.data.copy()
        user = request.user

        vehiculo_id = data.get('vehiculo')
        estacionamiento_id = data.get('estacionamiento')
        hora_entrada = data.get('hora_entrada')
        duracion_minutos = int(data.get('duracion_minutos', 60))

        if not (vehiculo_id and estacionamiento_id and hora_entrada):
            return Response({'detail': 'vehiculo, estacionamiento y hora_entrada son requeridos.'},
                            status=status.HTTP_400_BAD_REQUEST)

        # bloqueamos la fila del estacionamiento
        try:
            parking = ParkingLot.objects.select_for_update().get(pk=estacionamiento_id)
        except ParkingLot.DoesNotExist:
            return Response({'detail': 'Estacionamiento no existe.'}, status=status.HTTP_404_NOT_FOUND)

        if parking.plazas_disponibles <= 0:
            return Response({'detail': 'No hay plazas disponibles.'}, status=status.HTTP_400_BAD_REQUEST)

        # decrementar plazas
        parking.plazas_disponibles -= 1
        parking.save()

        # calcular hora_salida y costo estimado
        try:
            # parse hora_entrada en ISO; DRF ya validaría en serializer, aquí asumimos es ISO string
            from django.utils.dateparse import parse_datetime
            entrada_dt = parse_datetime(hora_entrada)
            if entrada_dt is None:
                raise ValueError
        except Exception:
            return Response({'detail': 'hora_entrada debe ser datetime ISO'}, status=status.HTTP_400_BAD_REQUEST)

        salida_dt = entrada_dt + timedelta(minutes=duracion_minutos)
        # coste en base a horas (fracción de hora -> proporcional)
        precio_por_minuto = float(parking.precio_hora) / 60.0
        costo_estimado = round(precio_por_minuto * duracion_minutos, 2)

        # construir objeto y serializar
        create_payload = {
            'vehiculo': vehiculo_id,
            'estacionamiento': estacionamiento_id,
            'hora_entrada': entrada_dt,
            'hora_salida': salida_dt,
            'duracion_minutos': duracion_minutos,
            'costo_estimado': costo_estimado
        }

        serializer = self.get_serializer(data=create_payload)
        serializer.is_valid(raise_exception=True)
        serializer.save(usuario=user)

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
