from django.conf import settings
from django.contrib.auth import get_user_model
from .models import Notification

def create_notification(user, type, title, message, action_url=None, source='system'):
    """
    Crea una nueva notificación
    """
    notification = Notification.objects.create(
        user=user,
        type=type,
        title=title,
        message=message,
        action_url=action_url,
        source=source
    )
    return notification

def notify_admins(type, title, message, action_url=None, source='system'):
    """
    Crea notificación para todos los usuarios admin
    """
    User = get_user_model()  # CORREGIDO: Usar get_user_model()
    admins = User.objects.filter(is_staff=True)
    for admin in admins:
        create_notification(admin, type, title, message, action_url, source)