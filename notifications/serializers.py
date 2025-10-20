from rest_framework import serializers
from .models import Notification

class NotificationSerializer(serializers.ModelSerializer):
    icon = serializers.SerializerMethodField()
    time_display = serializers.SerializerMethodField()
    
    class Meta:
        model = Notification
        fields = [
            'id', 'type', 'title', 'message', 'read', 
            'created_at', 'action_url', 'source', 'icon',
            'time_display'
        ]
    
    def get_icon(self, obj):
        return obj.get_icon()
    
    def get_time_display(self, obj):
        from django.utils import timezone
        from django.utils.timesince import timesince
        
        now = timezone.now()
        diff = now - obj.created_at
        
        if diff.days == 0:
            if diff.seconds < 60:
                return 'Hace un momento'
            elif diff.seconds < 3600:
                minutes = diff.seconds // 60
                return f'Hace {minutes} min'
            else:
                hours = diff.seconds // 3600
                return f'Hace {hours} hora{"s" if hours > 1 else ""}'
        elif diff.days == 1:
            return 'Ayer'
        elif diff.days < 7:
            return f'Hace {diff.days} días'
        else:
            return obj.created_at.strftime('%d/%m/%Y')