from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Car
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework import serializers

User = get_user_model()

class CarSerializer(serializers.ModelSerializer):
    class Meta:
        model = Car
        fields = ['id', 'placa', 'modelo', 'tipo', 'color', 'created_at']

class UserSerializer(serializers.ModelSerializer):
    cars = CarSerializer(many=True, read_only=True)
    password = serializers.CharField(write_only=True)  

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'rol', 'telefono', 'activo', 
            'fecha_registro', 'cars', 'password',
            # AGREGAR ESTOS CAMPOS
            'date_joined', 'last_login', 'is_active', 'is_staff', 'is_superuser'
        ]
        read_only_fields = ['fecha_registro', 'activo', 'date_joined', 'last_login']

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

    extra_kwargs = {
        'rol': {'required': False, 'allow_null': True},
        'telefono': {'required': False, 'allow_null': True}
    }

class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        username_or_email = attrs.get("username")
        password = attrs.get("password")

        # Permitir login con email o username
        user = authenticate(
            request=self.context.get("request"),
            username=username_or_email,
            password=password
        )

        if user is None:
            try:
                user_obj = User.objects.get(email=username_or_email)
                user = authenticate(
                    request=self.context.get("request"),
                    username=user_obj.username,
                    password=password
                )
            except User.DoesNotExist:
                pass

        if user is None:
            raise serializers.ValidationError("Credenciales inválidas")

        data = super().validate({"username": user.username, "password": password})
        return data