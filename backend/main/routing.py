from django.urls import path

from .consumers import LiveClassroomConsumer


websocket_urlpatterns = [
    path('ws/live-classrooms/<int:classroom_id>/', LiveClassroomConsumer.as_asgi()),
]