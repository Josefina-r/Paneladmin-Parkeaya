from django.shortcuts import render

# Create your views here.
from rest_framework import viewsets, permissions
from django.contrib.auth import get_user_model
from .serializers import UserSerializer, CarSerializer

from .models import Car
from rest_framework import generics
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .serializers import UserSerializer



# Registro de usuario
class RegisterView(generics.CreateAPIView):
    queryset = get_user_model().objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.AllowAny]

def create(self, request, *args, **kwargs):
    print("DATA LLEGANDO DESDE ANDROID:", request.data)  # 👈
    return super().create(request, *args, **kwargs)

# Login personalizado con JWT
class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = TokenObtainPairSerializer

User = get_user_model()

class IsAdminOrSelf(permissions.BasePermission):
    """
    Allow access if user is admin or accessing their own user object.
    """

    def has_object_permission(self, request, view, obj):
        if request.user.is_superuser or getattr(request.user, 'rol', None) == 'admin':
            return True
        return obj == request.user

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ['create']:
            return [permissions.AllowAny()]
        return super().get_permissions()

class CarViewSet(viewsets.ModelViewSet):
    queryset = Car.objects.all().order_by('-created_at')
    serializer_class = CarSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # normal: a user sees only their cars unless staff
        user = self.request.user
        if user.is_authenticated and (user.is_superuser or getattr(user, 'rol', None) == 'admin'):
            return Car.objects.all()
        return Car.objects.filter(usuario=user)

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)
