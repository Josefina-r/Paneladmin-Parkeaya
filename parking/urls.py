from django.urls import path, include
from rest_framework.routers import DefaultRouter
from users import views as user_views
from .views import (
    ParkingLotViewSet, 
    ParkingReviewViewSet, 
    ParkingApprovalViewSet,  
    dashboard_stats, 
    recent_reservations,
    dashboard_data,
    admin_dashboard_data,
    owner_dashboard_data,
    register_parking
)

# Router para parking normal (SIN approval-requests)
router = DefaultRouter()
router.register(r'parking', ParkingLotViewSet, basename='parking')
router.register(r'reviews', ParkingReviewViewSet, basename='review')
# ❌ NO registrar approval-requests aquí

# Router SEPARADO para approval requests
approval_router = DefaultRouter()
approval_router.register(r'', ParkingApprovalViewSet, basename='approval-request')

urlpatterns = [
    # ✅ Approval requests PRIMERO con su propio router
    path('approval-requests/', include(approval_router.urls)),
    
    # ✅ Luego el router principal
    path('', include(router.urls)),

    # Dashboard endpoints
    path('admin/dashboard-stats/', dashboard_stats, name='dashboard-stats'),
    path('admin/recent-reservations/', recent_reservations, name='recent-reservations'),
    path('dashboard/data/', dashboard_data, name='dashboard_data'),
    path('dashboard/admin/', admin_dashboard_data, name='admin_dashboard_data'),
    path('dashboard/owner/', owner_dashboard_data, name='owner_dashboard_data'),
    path('<int:pk>/register/', register_parking, name='register-parking'),
]