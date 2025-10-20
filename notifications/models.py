from django.db import models
from django.conf import settings
from django.utils import timezone

class Notification(models.Model):
    NOTIFICATION_TYPES = (
        ('reservation', 'Reserva'),
        ('payment', 'Pago'),
        ('warning', 'Advertencia'),
        ('info', 'Información'),
        ('success', 'Éxito'),
        ('error', 'Error'),
        ('violation', 'Infracción'),
        ('ticket', 'Ticket'),
        ('system', 'Sistema'),
    )
    
    SOURCE_TYPES = (
        ('mobile', 'App Móvil'),
        ('web', 'Panel Web'),
        ('system', 'Sistema'),
    )
    
    # CORREGIDO: Usar AUTH_USER_MODEL en lugar de User directo
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='notifications'
    )
    type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES, default='info')
    title = models.CharField(max_length=200)
    message = models.TextField()
    read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    action_url = models.CharField(max_length=500, blank=True, null=True)
    source = models.CharField(max_length=20, choices=SOURCE_TYPES, default='system')
    icon = models.CharField(max_length=50, blank=True, null=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Notificación'
        verbose_name_plural = 'Notificaciones'
    
    def __str__(self):
        return f"{self.title} - {self.user.username}"
    
    def mark_as_read(self):
        if not self.read:
            self.read = True
            self.read_at = timezone.now()
            self.save()
    
    def get_icon(self):
        if self.icon:
            return self.icon
            
        icons = {
            'reservation': 'fas fa-calendar-check',
            'payment': 'fas fa-dollar-sign',
            'warning': 'fas fa-exclamation-triangle',
            'info': 'fas fa-info-circle',
            'success': 'fas fa-check-circle',
            'error': 'fas fa-times-circle',
            'violation': 'fas fa-exclamation-circle',
            'ticket': 'fas fa-ticket-alt',
            'system': 'fas fa-cog',
        }
        return icons.get(self.type, 'fas fa-bell')