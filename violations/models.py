from django.db import models
from django.contrib.auth import get_user_model
from parking.models import ParkingLot
from reservations.models import Reservation

User = get_user_model()

class Violation(models.Model):
    VIOLATION_TYPES = (
        ('estacionamiento_prohibido', 'Estacionamiento Prohibido'),
        ('tiempo_excedido', 'Tiempo Excedido'),
        ('plaza_incorrecta', 'Plaza Incorrecta'),
        ('obstruccion', 'Obstrucción de Vía'),
        ('sin_pago', 'Estacionamiento sin Pago'),
        ('reserva_incumplida', 'Reserva Incumplida'),
        ('danio_vehiculo', 'Daño a Vehículo'),
        ('servicio_deficiente', 'Servicio Deficiente'),
        ('conducta_inapropiada', 'Conducta Inapropiada'),
        ('falta_limpieza', 'Falta de Limpieza'),
        ('otros', 'Otros'),
    )
    
    SEVERITY_LEVELS = (
        ('baja', 'Baja'),
        ('media', 'Media'),
        ('alta', 'Alta'),
    )
    
    STATUS_CHOICES = (
        ('pendiente', 'Pendiente'),
        ('en_revision', 'En Revisión'),
        ('resuelta', 'Resuelta'),
        ('rechazada', 'Rechazada'),
    )
    
    # Información básica
    ticket_number = models.CharField(max_length=20, unique=True, blank=True)
    license_plate = models.CharField(max_length=10)
    violation_type = models.CharField(max_length=50, choices=VIOLATION_TYPES)
    description = models.TextField()
    location = models.CharField(max_length=200, blank=True)
    severity = models.CharField(max_length=10, choices=SEVERITY_LEVELS, default='media')
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='pendiente')
    
    # Relaciones
    reported_by_user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='reported_violations'
    )
    reported_by_parking = models.ForeignKey(
        ParkingLot, 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='reported_violations'
    )
    parking_lot = models.ForeignKey(
        ParkingLot, 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True,
        related_name='violations'
    )
    reservation = models.ForeignKey(
        Reservation, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True
    )
    
    # Multa y evidencia
    fine_amount = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    evidence = models.JSONField(default=list, blank=True)  # Para almacenar URLs de imágenes
    notes = models.TextField(blank=True)
    resolution_notes = models.TextField(blank=True)
    
    # Fechas
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.ticket_number:
            # Generar número de ticket automáticamente
            last_violation = Violation.objects.order_by('-id').first()
            last_id = last_violation.id if last_violation else 0
            self.ticket_number = f'INF-{(last_id + 1):06d}'
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.ticket_number} - {self.license_plate} - {self.get_violation_type_display()}"

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Infracción'
        verbose_name_plural = 'Infracciones'