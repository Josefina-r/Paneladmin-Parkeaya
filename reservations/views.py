# reservations/views.py
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
from django.shortcuts import get_object_or_404

from .models import Reservation
from .serializers import ReservationSerializer, ReservationDetailSerializer
from parking.models import ParkingLot
from users.models import Car

class ReservationViewSet(viewsets.ModelViewSet):
    queryset = Reservation.objects.all().order_by('-created_at')
    serializer_class = ReservationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['retrieve', 'list']:
            return ReservationDetailSerializer
        return ReservationSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or getattr(user, 'rol', None) == 'admin':
            return Reservation.objects.all().order_by('-created_at')
        elif getattr(user, 'rol', None) == 'owner':
            # Dueños ven reservas de sus estacionamientos
            return Reservation.objects.filter(
                estacionamiento__owner=user
            ).order_by('-created_at')
        return Reservation.objects.filter(usuario=user).order_by('-created_at')

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """
        Crear reserva con verificación de disponibilidad
        """
        data = request.data.copy()
        user = request.user

        vehiculo_id = data.get('vehiculo')
        estacionamiento_id = data.get('estacionamiento')
        hora_entrada = data.get('hora_entrada')
        duracion_minutos = int(data.get('duracion_minutos', 60))

        # Validaciones básicas
        if not all([vehiculo_id, estacionamiento_id, hora_entrada]):
            return Response(
                {'detail': 'vehiculo, estacionamiento y hora_entrada son requeridos.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verificar que el vehículo pertenece al usuario
        try:
            vehiculo = Car.objects.get(id=vehiculo_id, usuario=user)
        except Car.DoesNotExist:
            return Response(
                {'detail': 'Vehículo no encontrado o no pertenece al usuario.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Bloquear estacionamiento para evitar overbooking
        try:
            parking = ParkingLot.objects.select_for_update().get(
                pk=estacionamiento_id, 
                is_approved=True, 
                is_active=True
            )
        except ParkingLot.DoesNotExist:
            return Response(
                {'detail': 'Estacionamiento no disponible.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Verificar disponibilidad
        if parking.plazas_disponibles <= 0:
            return Response(
                {'detail': 'No hay plazas disponibles en este momento.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Parsear hora de entrada
        try:
            from django.utils.dateparse import parse_datetime
            entrada_dt = parse_datetime(hora_entrada)
            if entrada_dt is None:
                raise ValueError
                
            # Verificar que la reserva no sea en el pasado
            if entrada_dt < timezone.now():
                return Response(
                    {'detail': 'No se pueden hacer reservas en el pasado.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
        except Exception:
            return Response(
                {'detail': 'Formato de hora_entrada inválido. Use formato ISO.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verificar conflictos de reserva para el mismo vehículo
        reservas_conflicto = Reservation.objects.filter(
            vehiculo=vehiculo,
            hora_entrada__lt=entrada_dt + timedelta(minutes=duracion_minutos),
            hora_salida__gt=entrada_dt,
            estado__in=['activa', 'confirmada']
        )
        
        if reservas_conflicto.exists():
            return Response(
                {'detail': 'El vehículo ya tiene una reserva en ese horario.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Calcular hora de salida y costo
        salida_dt = entrada_dt + timedelta(minutes=duracion_minutos)
        precio_por_minuto = float(parking.precio_hora) / 60.0
        costo_estimado = round(precio_por_minuto * duracion_minutos, 2)

        # Reducir plazas disponibles
        parking.plazas_disponibles -= 1
        parking.save()

        # Crear reserva
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
        reservation = serializer.save(usuario=user)

        # Aquí podrías agregar notificación al dueño del estacionamiento
        # send_reservation_notification.delay(reservation.id)

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """
        Cancelar reserva
        """
        reservation = self.get_object()
        user = request.user

        # Verificar permisos
        if reservation.usuario != user and not (user.is_staff or reservation.estacionamiento.owner == user):
            return Response(
                {'detail': 'No tiene permisos para cancelar esta reserva.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Verificar que se pueda cancelar
        if reservation.estado != 'activa':
            return Response(
                {'detail': 'Solo se pueden cancelar reservas activas.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if reservation.hora_entrada <= timezone.now():
            return Response(
                {'detail': 'No se puede cancelar una reserva que ya comenzó.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Cancelar reserva y liberar plaza
        with transaction.atomic():
            parking = ParkingLot.objects.select_for_update().get(pk=reservation.estacionamiento.id)
            parking.plazas_disponibles += 1
            parking.save()
            
            reservation.estado = 'cancelada'
            reservation.save()

        return Response(
            {'detail': 'Reserva cancelada exitosamente.'},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'])
    def extend(self, request, pk=None):
        """
        Extender tiempo de reserva
        """
        reservation = self.get_object()
        minutos_extra = request.data.get('minutos_extra', 0)

        try:
            minutos_extra = int(minutos_extra)
            if minutos_extra <= 0:
                raise ValueError
        except (TypeError, ValueError):
            return Response(
                {'detail': 'minutos_extra debe ser un número positivo.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if reservation.estado != 'activa':
            return Response(
                {'detail': 'Solo se pueden extender reservas activas.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Calcular nuevo costo
        precio_por_minuto = float(reservation.estacionamiento.precio_hora) / 60.0
        costo_extra = round(precio_por_minuto * minutos_extra, 2)

        with transaction.atomic():
            reservation.hora_salida += timedelta(minutes=minutos_extra)
            reservation.duracion_minutos += minutos_extra
            reservation.costo_estimado += costo_extra
            reservation.save()

        serializer = self.get_serializer(reservation)
        return Response(serializer.data, status=status.HTTP_200_OK)

class CheckInView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, codigo_reserva):
        """
        Check-in usando código QR/numérico
        """
        reservation = get_object_or_404(Reservation, codigo_reserva=codigo_reserva)
        
        # Verificar permisos (dueño del estacionamiento o usuario de la reserva)
        user = request.user
        if reservation.usuario != user and reservation.estacionamiento.owner != user:
            return Response(
                {'detail': 'No tiene permisos para realizar check-in.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if reservation.estado != 'activa':
            return Response(
                {'detail': 'La reserva no está activa.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Marcar como check-in (podrías agregar un campo específico para esto)
        reservation.estado = 'activa'  # O crear campo 'checkin_realizado'
        reservation.save()

        return Response({
            'detail': 'Check-in realizado exitosamente.',
            'reserva': ReservationSerializer(reservation).data
        })

class CheckOutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, codigo_reserva):
        """
        Check-out y liberar espacio
        """
        reservation = get_object_or_404(Reservation, codigo_reserva=codigo_reserva)
        user = request.user

        if reservation.usuario != user and reservation.estacionamiento.owner != user:
            return Response(
                {'detail': 'No tiene permisos para realizar check-out.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if reservation.estado != 'activa':
            return Response(
                {'detail': 'La reserva no está activa.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            # Liberar espacio en el estacionamiento
            parking = ParkingLot.objects.select_for_update().get(pk=reservation.estacionamiento.id)
            parking.plazas_disponibles += 1
            parking.save()

            # Calcular tiempo real y costo final
            hora_salida_real = timezone.now()
            tiempo_real_minutos = (hora_salida_real - reservation.hora_entrada).total_seconds() / 60
            
            # Aplicar política de tolerancia (ej: 15 minutos gratis)
            tolerancia_minutos = 15
            if tiempo_real_minutos <= tolerancia_minutos:
                costo_final = 0
            else:
                precio_por_minuto = float(parking.precio_hora) / 60.0
                costo_final = round(precio_por_minuto * tiempo_real_minutos, 2)

            reservation.hora_salida = hora_salida_real
            reservation.duracion_minutos = int(tiempo_real_minutos)
            reservation.costo_estimado = costo_final
            reservation.estado = 'finalizada'
            reservation.save()

        return Response({
            'detail': 'Check-out realizado exitosamente.',
            'costo_final': costo_final,
            'tiempo_estacionado_minutos': tiempo_real_minutos,
            'reserva': ReservationSerializer(reservation).data
        })

class UserActiveReservationsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """
        Obtener reservas activas del usuario
        """
        reservations = Reservation.objects.filter(
            usuario=request.user,
            estado='activa',
            hora_salida__gt=timezone.now()
        ).order_by('hora_entrada')
        
        serializer = ReservationSerializer(reservations, many=True)
        return Response(serializer.data)

class ParkingReservationsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, parking_id):
        """
        Obtener reservas de un estacionamiento (para dueños)
        """
        parking = get_object_or_404(ParkingLot, id=parking_id)
        
        # Verificar que el usuario es el dueño
        if parking.owner != request.user and not request.user.is_staff:
            return Response(
                {'detail': 'No tiene permisos para ver estas reservas.'},
                status=status.HTTP_403_FORBIDDEN
            )

        estado = request.GET.get('estado', 'activa')
        fecha = request.GET.get('fecha')
        
        reservations = Reservation.objects.filter(estacionamiento=parking)
        
        if estado:
            reservations = reservations.filter(estado=estado)
        if fecha:
            reservations = reservations.filter(hora_entrada__date=fecha)
            
        reservations = reservations.order_by('-hora_entrada')
        serializer = ReservationSerializer(reservations, many=True)
        
        return Response(serializer.data)