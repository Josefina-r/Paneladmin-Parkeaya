from rest_framework import viewsets, permissions
from .models import ParkingLot
from .serializers import ParkingLotSerializer

class ParkingLotViewSet(viewsets.ModelViewSet):
    queryset = ParkingLot.objects.all().order_by('-creado_en')
    serializer_class = ParkingLotSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get('available') == 'true':
            qs = qs.filter(plazas_disponibles__gt=0)
        return qs
