from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator

User = settings.AUTH_USER_MODEL

class ParkingLot(models.Model):
    NIVEL_SEGURIDAD_CHOICES = [
        (1, 'Básico'),
        (2, 'Moderado'),
        (3, 'Alto'),
        (4, 'Premium'),
        (5, 'Máxima Seguridad')
    ]
    
    dueno = models.ForeignKey(User, on_delete=models.CASCADE, related_name='parking_lots')
    nombre = models.CharField(max_length=120)
    direccion = models.CharField(max_length=255)
    precio_hora = models.DecimalField(max_digits=7, decimal_places=2, validators=[MinValueValidator(0)])
    total_plazas = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    plazas_disponibles = models.PositiveIntegerField()
    nivel_seguridad = models.IntegerField(choices=NIVEL_SEGURIDAD_CHOICES, default=1)
    descripcion = models.TextField(blank=True)
    latitud = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitud = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    horario_apertura = models.TimeField(blank=True, null=True)
    horario_cierre = models.TimeField(blank=True, null=True)
    telefono = models.CharField(max_length=15, default="000000000")
    tiene_camaras = models.BooleanField(default=False)
    tiene_vigilancia_24h = models.BooleanField(default=False)
    acepta_reservas = models.BooleanField(default=True)
    rating_promedio = models.DecimalField(max_digits=3, decimal_places=2, default=0.0, validators=[MinValueValidator(0), MaxValueValidator(5)])
    total_reseñas = models.PositiveIntegerField(default=0)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.nombre

    def save(self, *args, **kwargs):
        # Asegurar que plazas_disponibles no sea mayor que total_plazas
        if self.plazas_disponibles > self.total_plazas:
            self.plazas_disponibles = self.total_plazas
        super().save(*args, **kwargs)

    def actualizar_rating(self):
        """Recalcula el rating promedio y total de reseñas."""
        reseñas = self.reseñas.all()
        if reseñas.exists():
            promedio = sum([r.rating for r in reseñas]) / reseñas.count()
            self.rating_promedio = round(promedio, 2)
            self.total_reseñas = reseñas.count()
        else:
            self.rating_promedio = 0
            self.total_reseñas = 0
        self.save(update_fields=['rating_promedio', 'total_reseñas'])

    @property
    def esta_abierto(self):
        """Verifica si el estacionamiento está abierto según la hora actual"""
        from django.utils import timezone
        ahora = timezone.now().time()
        if not self.horario_apertura or not self.horario_cierre:
            return True
        return self.horario_apertura <= ahora <= self.horario_cierre

    @property
    def porcentaje_ocupacion(self):
        """Calcula el porcentaje de ocupación"""
        if self.total_plazas == 0:
            return 0
        return ((self.total_plazas - self.plazas_disponibles) / self.total_plazas) * 100

    class Meta:
        indexes = [
            models.Index(fields=['latitud', 'longitud']),
            models.Index(fields=['plazas_disponibles']),
            models.Index(fields=['precio_hora']),
            models.Index(fields=['nivel_seguridad']),
            models.Index(fields=['rating_promedio']),
        ]
        ordering = ['-creado_en']


class ParkingImage(models.Model):
    parking_lot = models.ForeignKey(ParkingLot, on_delete=models.CASCADE, related_name='imagenes')
    imagen = models.ImageField(upload_to='parking_images/')
    es_principal = models.BooleanField(default=False)
    creado_en = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Imagen de {self.parking_lot.nombre}"


class ParkingReview(models.Model):
    parking_lot = models.ForeignKey(ParkingLot, on_delete=models.CASCADE, related_name='reseñas')
    usuario = models.ForeignKey(User, on_delete=models.CASCADE)
    rating = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comentario = models.TextField(blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Actualizar rating promedio del parking
        self.parking_lot.actualizar_rating()

    def __str__(self):
        return f"Reseña de {self.usuario} para {self.parking_lot.nombre}"
