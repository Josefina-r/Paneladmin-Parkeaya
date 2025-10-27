from django.db import models
from django.utils import timezone
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator, RegexValidator


class ParkingLot(models.Model):
    dueno = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='parkings')
    nombre = models.CharField(max_length=100)
    direccion = models.CharField(max_length=200)
    coordenadas = models.CharField(max_length=100)
    telefono = models.CharField(
        max_length=15,
        validators=[RegexValidator(regex=r'^\+?1?\d{9,15}$', message="Número de teléfono inválido.")]
    )
    descripcion = models.TextField(blank=True)
    horario_apertura = models.TimeField(null=True, blank=True)
    horario_cierre = models.TimeField(null=True, blank=True)
    nivel_seguridad = models.CharField(max_length=50, default='Estándar')
    tarifa_hora = models.DecimalField(max_digits=6, decimal_places=2)
    total_plazas = models.PositiveIntegerField()
    plazas_disponibles = models.PositiveIntegerField()
    rating_promedio = models.DecimalField(
        max_digits=3, decimal_places=2, default=0,
        validators=[MinValueValidator(0), MaxValueValidator(5)]
    )
    total_reseñas = models.PositiveIntegerField(default=0)
    aprobado = models.BooleanField(default=False)
    activo = models.BooleanField(default=True)

    class Meta:
        indexes = [
            models.Index(fields=['direccion']),
            models.Index(fields=['nivel_seguridad']),
        ]
        ordering = ['-rating_promedio']

    def __str__(self):
        return f"{self.nombre} ({self.direccion})"

    def save(self, *args, **kwargs):
        if self.plazas_disponibles > self.total_plazas:
            raise ValueError("Las plazas disponibles no pueden exceder el total.")
        super().save(*args, **kwargs)

    
    def esta_abierto(self):
        if not self.horario_apertura or not self.horario_cierre:
            return True
        ahora = timezone.localtime().time()
        if self.horario_apertura < self.horario_cierre:
            return self.horario_apertura <= ahora <= self.horario_cierre
        else:
            return ahora >= self.horario_apertura or ahora <= self.horario_cierre


class ParkingImage(models.Model):
    estacionamiento = models.ForeignKey(ParkingLot, on_delete=models.CASCADE, related_name='imagenes')
    imagen = models.ImageField(upload_to='parking_images/')
    descripcion = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return f"Imagen de {self.estacionamiento.nombre}"


class ParkingReview(models.Model):
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    estacionamiento = models.ForeignKey(ParkingLot, on_delete=models.CASCADE, related_name='reseñas')
    comentario = models.TextField(blank=True)
    calificacion = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('usuario', 'estacionamiento')

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        estacionamiento = self.estacionamiento
        reseñas = estacionamiento.reseñas.all()
        estacionamiento.rating_promedio = sum(r.calificacion for r in reseñas) / len(reseñas)
        estacionamiento.total_reseñas = len(reseñas)
        estacionamiento.save()
