from django.contrib.auth.models import AbstractUser
from django.db import models

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

    def __str__(self):
        return self.username

class Car(models.Model):
    TIPO_CHOICES = (
        ('auto', 'Auto'),
        ('moto', 'Moto'),
        ('camioneta', 'Camioneta'),
    )
    usuario = models.ForeignKey(User, on_delete=models.CASCADE, related_name='cars')
    placa = models.CharField(max_length=20, unique=True)
    modelo = models.CharField(max_length=80, blank=True)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default='auto')
    color = models.CharField(max_length=30, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.placa}"
