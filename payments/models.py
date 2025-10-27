from django.db import models
from django.conf import settings
import uuid
from reservations.models import Reservation

class Payment(models.Model):
    METODO_CHOICES = (
        ('tarjeta', 'Tarjeta Crédito/Débito'),
        ('yape', 'Yape'),
        ('plin', 'Plin'),
    )
    
    ESTADO_CHOICES = (
        ('pendiente', 'Pendiente'),
        ('procesando', 'Procesando'),
        ('pagado', 'Pagado'),
        ('fallido', 'Fallido'),
        ('reembolsado', 'Reembolsado'),
        ('cancelado', 'Cancelado'),
    )

    # Identificadores únicos
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    referencia_pago = models.CharField(max_length=50, unique=True, editable=False)
    
    # Relaciones
    reserva = models.OneToOneField(Reservation, on_delete=models.CASCADE, related_name='payment')
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='payments')
    
    # Información del pago
    monto = models.DecimalField(max_digits=8, decimal_places=2)
    moneda = models.CharField(max_length=3, default='PEN')
    metodo = models.CharField(max_length=20, choices=METODO_CHOICES)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='pendiente')
    
    # Datos de transacción
    id_transaccion = models.CharField(max_length=100, blank=True, null=True)
    datos_gateway = models.JSONField(default=dict, blank=True)
    
    # Comisiones
    comision_plataforma = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    monto_propietario = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    
    # Tiempos
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_pago = models.DateTimeField(null=True, blank=True)
    fecha_reembolso = models.DateTimeField(null=True, blank=True)
    
    # Metadata
    intentos = models.PositiveIntegerField(default=0)
    ultimo_error = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['-fecha_creacion']
        indexes = [
            models.Index(fields=['referencia_pago']),
            models.Index(fields=['estado', 'fecha_creacion']),
            models.Index(fields=['usuario', 'fecha_creacion']),
        ]

    def __str__(self):
        return f"Pago {self.referencia_pago} - {self.metodo} - {self.estado}"

    def save(self, *args, **kwargs):
        if not self.referencia_pago:
            self.referencia_pago = self.generar_referencia()
        
        if not self.usuario_id and self.reserva:
            self.usuario = self.reserva.usuario
            
        # Calcular comisiones al guardar
        if self.monto and self.estado == 'pagado':
            self.calcular_comisiones()
            
        super().save(*args, **kwargs)

    def generar_referencia(self):
        import random
        import string
        return f"PAY-{''.join(random.choices(string.ascii_uppercase + string.digits, k=10))}"

    def calcular_comisiones(self):
        """Calcula comisiones para la plataforma y el propietario"""
        from django.conf import settings
        comision_porcentaje = getattr(settings, 'COMISION_PLATAFORMA', 0.15)  # 15%
        
        self.comision_plataforma = self.monto * comision_porcentaje
        self.monto_propietario = self.monto - self.comision_plataforma

    @property
    def puede_reembolsar(self):
        """Verifica si el pago puede ser reembolsado"""
        from django.utils import timezone
        return (self.estado == 'pagado' and 
                self.reserva.estado in ['activa', 'cancelada'] and
                self.fecha_pago and
                (timezone.now() - self.fecha_pago).days <= 30)

    def procesar_pago(self, token_pago=None):
        """Procesa el pago a través del gateway correspondiente"""
        from .services import PaymentService
        return PaymentService.procesar_pago(self, token_pago)

    def reembolsar(self, monto_parcial=None):
        """Inicia proceso de reembolso"""
        from .services import PaymentService
        return PaymentService.reembolsar_pago(self, monto_parcial)


class PaymentHistory(models.Model):
    """Auditoría de cambios en pagos"""
    payment = models.ForeignKey(Payment, on_delete=models.CASCADE, related_name='history')
    estado_anterior = models.CharField(max_length=20)
    estado_nuevo = models.CharField(max_length=20)
    mensaje = models.TextField()
    datos_adicionales = models.JSONField(default=dict)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ['-fecha_creacion']