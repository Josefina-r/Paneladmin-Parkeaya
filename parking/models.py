from django.db import models
from django.conf import settings

User = settings.AUTH_USER_MODEL

class ParkingLot(models.Model):
    dueno = models.ForeignKey(User, on_delete=models.CASCADE, related_name='parking_lots')
    nombre = models.CharField(max_length=120)
    direccion = models.CharField(max_length=255)
    precio_hora = models.DecimalField(max_digits=7, decimal_places=2)
    total_plazas = models.PositiveIntegerField()
    plazas_disponibles = models.PositiveIntegerField()
    nivel_seguridad = models.IntegerField(default=1)
    descripcion = models.TextField(blank=True)
    latitud = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitud = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    horario_apertura = models.TimeField(blank=True, null=True)
    horario_cierre = models.TimeField(blank=True, null=True)
    telefono = models.CharField(max_length=15, default="000000000")  # 📞 Campo nuevo
    creado_en = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.nombre
