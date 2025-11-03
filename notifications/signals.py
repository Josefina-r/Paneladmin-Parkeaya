# notifications/signals.py - VERSIÓN CORREGIDA
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from .models import Notification

User = get_user_model()

@receiver(post_save, sender=User)
def create_user_registration_notification(sender, instance, created, **kwargs):
    """
    Crear notificación cuando se registra un nuevo usuario
    """
    if created and not instance.is_staff:  # Solo notificar para usuarios no staff
        print(f"🔔 Señal: Nuevo usuario registrado - {instance.username}")
        
        # Crear notificación para todos los administradores
        admins = User.objects.filter(is_staff=True, is_active=True)
        
        for admin in admins:
            Notification.objects.create(
                user=admin,
                type='info',  # Usar el campo 'type' de tu modelo
                title='🎉 Nuevo usuario registrado',
                message=f'El usuario "{instance.username}" ({instance.email}) se ha registrado en Parkeaya.',
                source='system',
                icon='fas fa-user-plus'
            )
            print(f"✅ Notificación creada para admin: {admin.username}")

@receiver(post_save, sender=User)
def notify_user_activation_change(sender, instance, **kwargs):
    """
    Notificar cuando cambia el estado de activación de un usuario
    """
    # Verificar si is_active fue actualizado - CORREGIDO
    if 'update_fields' in kwargs:
        update_fields = kwargs['update_fields']
        # CORRECCIÓN: update_fields contiene strings, no objetos Field
        if update_fields and any(field == 'is_active' for field in update_fields):
            print(f"🔔 Señal: Estado de usuario cambiado - {instance.username} -> is_active: {instance.is_active}")
            
            # Notificar a los admins sobre el cambio de estado
            admins = User.objects.filter(is_staff=True, is_active=True)
            
            for admin in admins:
                Notification.objects.create(
                    user=admin,
                    type='warning' if not instance.is_active else 'success',
                    title='Estado de usuario actualizado',
                    message=f'El usuario "{instance.username}" ha sido {"activado ✅" if instance.is_active else "desactivado ⚠️"}.',
                    source='system',
                    icon='fas fa-user-check' if instance.is_active else 'fas fa-user-slash'
                )

@receiver(post_save, sender=User)
def notify_user_profile_update(sender, instance, **kwargs):
    """
    Notificar cuando un usuario actualiza su perfil (solo cambios importantes)
    """
    if 'update_fields' in kwargs and not kwargs.get('created', False):
        update_fields = kwargs['update_fields']
        if update_fields:
            # Solo notificar cambios en email o username - CORREGIDO
            important_fields = ['email', 'username']
            # CORRECCIÓN: update_fields contiene strings, no objetos Field
            if any(field in important_fields for field in update_fields):
                print(f"🔔 Señal: Perfil de usuario actualizado - {instance.username}")
                
                admins = User.objects.filter(is_staff=True, is_active=True)
                
                for admin in admins:
                    Notification.objects.create(
                        user=admin,
                        type='info',
                        title='Perfil de usuario actualizado',
                        message=f'El usuario "{instance.username}" actualizó su información de perfil.',
                        source='system',
                        icon='fas fa-user-edit'
                    )