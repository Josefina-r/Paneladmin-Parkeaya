from django.contrib import admin
from .models import Violation

@admin.register(Violation)
class ViolationAdmin(admin.ModelAdmin):
    list_display = [
        'ticket_number', 
        'license_plate', 
        'violation_type', 
        'severity', 
        'status',
        'reported_by_user',
        'reported_by_parking',
        'created_at'
    ]
    list_filter = ['violation_type', 'severity', 'status', 'created_at']
    search_fields = ['ticket_number', 'license_plate', 'description']
    readonly_fields = ['created_at', 'updated_at']