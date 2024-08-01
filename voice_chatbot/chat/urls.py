from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('start/', views.start_recognition, name='start'),
    path('recognize/', views.recognize, name='recognize'),
    path('end/', views.end_recognition, name='end'),
    path('download/', views.download_conversation_history, name='download'),
]
