"""lms_api URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.urls import path,include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import RedirectView
from main import admin_api

urlpatterns = [
    path('api/admin-ui/csrf/', admin_api.admin_csrf),
    path('api/admin-ui/login/', admin_api.admin_login),
    path('api/admin-ui/session/', admin_api.admin_session),
    path('api/admin-ui/logout/', admin_api.admin_logout),
    path('api/admin-ui/approvals/<str:account_type>/<int:account_id>/', admin_api.admin_approve_account),
    path('api/admin-ui/resources/', admin_api.admin_resources),
    path('api/admin-ui/groups/<int:group_id>/members/', admin_api.admin_group_members),
    path('api/admin-ui/resources/<str:app_label>/<str:model_name>/', admin_api.admin_resource_list),
    path('api/admin-ui/resources/<str:app_label>/<str:model_name>/<str:object_id>/', admin_api.admin_resource_detail),
    path('admin/', RedirectView.as_view(url=settings.REACT_ADMIN_URL, query_string=True), name='react-admin'),
    path('api/', include('main.urls')),
    path('api-auth/', include('rest_framework.urls')),

]+static(settings.MEDIA_URL,document_root=settings.MEDIA_ROOT)
