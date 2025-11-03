from django.shortcuts import render
from rest_framework import viewsets, permissions, generics, status
from django.contrib.auth import get_user_model
from .serializers import UserSerializer, CarSerializer
from .models import Car
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

# AGREGAR ESTOS IMPORTS
from rest_framework.decorators import api_view, permission_classes, action
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone

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
    # MODIFICAR EL QUERYSET PARA EXCLUIR USUARIOS ELIMINADOS
    queryset = User.objects.filter(eliminado=False).order_by('-date_joined')
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ['create']:
            return [permissions.AllowAny()]
        return super().get_permissions()

    # AGREGAR ESTE MÉTODO PARA SOBREESCRIBIR LA ELIMINACIÓN
    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            
            # No permitir eliminación de superusers o el usuario actual
            if instance.is_superuser:
                return Response(
                    {"error": "No se puede eliminar un superusuario"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if instance == request.user:
                return Response(
                    {"error": "No puedes eliminar tu propia cuenta"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Realizar eliminación suave
            instance.soft_delete()
            
            return Response(
                {"message": "Usuario eliminado correctamente"},
                status=status.HTTP_200_OK
            )
            
        except Exception as e:
            return Response(
                {"error": f"No se pudo eliminar el usuario: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    # AGREGAR ACCIÓN PARA REACTIVAR USUARIOS (OPCIONAL)
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Reactivar un usuario desactivado"""
        user = self.get_object()
        user.activo = True
        user.is_active = True
        user.eliminado = False
        user.fecha_eliminacion = None
        user.save()
        
        return Response({
            "message": "Usuario reactivado correctamente",
            "activo": user.activo
        })

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

# =============================================================================
# VISTAS EXISTENTES (NO MODIFICAR)
# =============================================================================

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def admin_login(request):
    """
    Login específico para administradores del panel web
    """
    username = request.data.get('username')
    password = request.data.get('password')
    
    print(f"Intento de login admin: {username}")  # 👈 Para debug
    
    # Autenticar usuario
    user = authenticate(username=username, password=password)
    
    if user is not None and user.is_active:
        # Verificar si es staff/admin
        if not user.is_staff and not user.is_superuser:
            return Response(
                {'error': 'Acceso solo para administradores'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Generar tokens JWT usando SimpleJWT
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'is_staff': user.is_staff,
                'is_superuser': user.is_superuser
            }
        })
    else:
        return Response(
            {'error': 'Credenciales inválidas'}, 
            status=status.HTTP_401_UNAUTHORIZED
        )

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def simple_login(request):
    """
    Login simple para cualquier usuario (admin o regular)
    """
    username = request.data.get('username')
    password = request.data.get('password')
    
    print(f"Intento de login simple: {username}")  # 👈 Para debug
    
    user = authenticate(username=username, password=password)
    
    if user is not None and user.is_active:
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'is_staff': user.is_staff,
                'is_superuser': user.is_superuser
            }
        })
    else:
        return Response(
            {'error': 'Credenciales inválidas'}, 
            status=status.HTTP_401_UNAUTHORIZED
        )

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_user_profile(request):
    """
    Obtener perfil del usuario autenticado
    """
    user = request.user
    return Response({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'is_staff': user.is_staff,
        'is_superuser': user.is_superuser
    })

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def check_admin_permission(request):
    """
    Verificar si el usuario tiene permisos de administrador
    """
    user = request.user
    is_admin = user.is_staff or user.is_superuser
    
    return Response({
        'is_admin': is_admin,
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'is_staff': user.is_staff,
            'is_superuser': user.is_superuser
        }
    })

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register_owner(request):
    """
    Registro de usuario tipo DUEÑO
    """
    data = request.data.copy()
    data['rol'] = 'owner'  # fuerza el rol
    serializer = UserSerializer(data=data)
    if serializer.is_valid():
        serializer.save()
        return Response({"message": "Dueño registrado correctamente"}, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)