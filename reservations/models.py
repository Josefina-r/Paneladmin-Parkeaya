from django.db import models
from django.conf import settings
import uuid

User = settings.AUTH_USER_MODEL

class Reservation(models.Model):
    ESTADO_CHOICES = (
        ('activa','Activa'),
        ('finalizada','Finalizada'),
        ('cancelada','Cancelada'),
    )

    usuario = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reservations')
    vehiculo = models.ForeignKey('users.Car', on_delete=models.CASCADE, related_name='reservations')
    estacionamiento = models.ForeignKey('parking.ParkingLot', on_delete=models.CASCADE, related_name='reservations')
    hora_entrada = models.DateTimeField()
    hora_salida = models.DateTimeField(blank=True, null=True)
    duracion_minutos = models.PositiveIntegerField(blank=True, null=True)
    costo_estimado = models.DecimalField(max_digits=8, decimal_places=2, blank=True, null=True)
    codigo_reserva = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='activa')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Reserva {self.codigo_reserva}"
