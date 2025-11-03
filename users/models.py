from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

class User(AbstractUser):
    ROLE_CHOICES = (
        ('admin', 'Administrador'),
        ('owner', 'Dueño'),
        ('client', 'Cliente'),
    )
    telefono = models.CharField(max_length=20, blank=True, null=True)
    rol = models.CharField(max_length=10, choices=ROLE_CHOICES, default='client')
    activo = models.BooleanField(default=True)
    fecha_registro = models.DateTimeField(auto_now_add=True)
    
    # AGREGAR ESTOS CAMPOS PARA ELIMINACIÓN SUAVE
    eliminado = models.BooleanField(default=False)
    fecha_eliminacion = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.username

    # AGREGAR ESTE MÉTODO PARA ELIMINACIÓN SUAVE
    def soft_delete(self):
        """Marca el usuario como eliminado sin borrarlo de la BD"""
        self.eliminado = True
        self.activo = False
        self.is_active = False
        self.fecha_eliminacion = timezone.now()
        # Cambiar username y email para evitar conflictos
        self.username = f"deleted_{self.id}_{self.username}"[:150]
        self.email = f"deleted_{self.id}_{self.email}"[:254]
        self.save()

class Car(models.Model):
    TIPO_CHOICES = (
        ('auto', 'Auto'),
        ('moto', 'Moto'),
        ('camioneta', 'Camioneta'),
    )
    usuario = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL,  # CAMBIAR A SET_NULL
        related_name='cars',
        null=True,  # AGREGAR
        blank=True  # AGREGAR
    )
    placa = models.CharField(max_length=20, unique=True)
    modelo = models.CharField(max_length=80, blank=True)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default='auto')
    color = models.CharField(max_length=30, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.placa}"