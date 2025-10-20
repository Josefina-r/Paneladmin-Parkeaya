from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Violation
from .serializers import ViolationSerializer

class ViolationViewSet(viewsets.ModelViewSet):
    queryset = Violation.objects.all().select_related(
        'reported_by_user', 
        'reported_by_parking', 
        'parking_lot'
    )
    serializer_class = ViolationSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        qs = super().get_queryset()
        
        # Filtrar por estado si se proporciona
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
            
        # Filtrar por tipo de reportante
        reported_by = self.request.query_params.get('reported_by')
        if reported_by == 'user':
            qs = qs.filter(reported_by_user__isnull=False)
        elif reported_by == 'parking':
            qs = qs.filter(reported_by_parking__isnull=False)
            
        return qs

    def perform_create(self, serializer):
        # Asignar automáticamente el usuario que reporta si es una queja de usuario
        if not serializer.validated_data.get('reported_by_user') and not serializer.validated_data.get('reported_by_parking'):
            serializer.save(reported_by_user=self.request.user)
        else:
            serializer.save()

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        violation = self.get_object()
        resolution_notes = request.data.get('resolution_notes', '')
        
        violation.status = 'resuelta'
        violation.resolution_notes = resolution_notes
        violation.save()
        
        serializer = self.get_serializer(violation)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        violation = self.get_object()
        resolution_notes = request.data.get('resolution_notes', '')
        
        if not resolution_notes:
            return Response(
                {'error': 'Se requiere motivo del rechazo.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        violation.status = 'rechazada'
        violation.resolution_notes = resolution_notes
        violation.save()
        
        serializer = self.get_serializer(violation)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def reopen(self, request, pk=None):
        violation = self.get_object()
        
        violation.status = 'pendiente'
        violation.save()
        
        serializer = self.get_serializer(violation)
        return Response(serializer.data)