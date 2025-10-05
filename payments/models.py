from django.db import models
from reservations.models import Reservation

class Payment(models.Model):
    METODO_CHOICES = (
        ('tarjeta','Tarjeta'),
        ('yape','Yape'),
        ('plin','Plin'),
        ('efectivo','Efectivo'),
    )
    ESTADO_CHOICES = (
        ('pendiente','Pendiente'),
        ('pagado','Pagado'),
        ('fallido','Fallido'),
        ('reembolsado','Reembolsado'),
    )
    reserva = models.OneToOneField(Reservation, on_delete=models.CASCADE, related_name='payment')
    monto = models.DecimalField(max_digits=8, decimal_places=2)
    metodo = models.CharField(max_length=20, choices=METODO_CHOICES)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='pendiente')
    fecha_pago = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Pago {self.id} - {self.metodo} - {self.estado}"
