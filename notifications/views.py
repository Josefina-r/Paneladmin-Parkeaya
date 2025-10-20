from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from datetime import timedelta
from .models import Notification
from .serializers import NotificationSerializer

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_notifications(request):
    # Filtrar notificaciones de los últimos 30 días
    date_threshold = timezone.now() - timedelta(days=30)
    
    notifications = Notification.objects.filter(
        user=request.user,
        created_at__gte=date_threshold
    ).order_by('-created_at')[:50]  # Limitar a 50 más recientes
    
    unread_count = Notification.objects.filter(
        user=request.user,
        read=False,
        created_at__gte=date_threshold
    ).count()
    
    serializer = NotificationSerializer(notifications, many=True)
    
    return Response({
        'notifications': serializer.data,
        'unread_count': unread_count
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_notification_read(request, notification_id):
    try:
        notification = Notification.objects.get(
            id=notification_id, 
            user=request.user
        )
        notification.mark_as_read()
        return Response({'status': 'success'})
    except Notification.DoesNotExist:
        return Response({'error': 'Notificación no encontrada'}, status=404)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_all_notifications_read(request):
    date_threshold = timezone.now() - timedelta(days=30)
    
    notifications = Notification.objects.filter(
        user=request.user,
        read=False,
        created_at__gte=date_threshold
    )
    
    for notification in notifications:
        notification.mark_as_read()
    
    return Response({'status': 'success', 'marked_read': notifications.count()})

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_notification(request, notification_id):
    try:
        notification = Notification.objects.get(
            id=notification_id,
            user=request.user
        )
        notification.delete()
        return Response({'status': 'success'})
    except Notification.DoesNotExist:
        return Response({'error': 'Notificación no encontrada'}, status=404)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def notification_stats(request):
    """Estadísticas de notificaciones para el dashboard"""
    today = timezone.now().date()
    week_ago = today - timedelta(days=7)
    
    total_unread = Notification.objects.filter(
        user=request.user,
        read=False
    ).count()
    
    recent_notifications = Notification.objects.filter(
        user=request.user,
        created_at__gte=week_ago
    ).count()
    
    return Response({
        'total_unread': total_unread,
        'recent_count': recent_notifications
    })