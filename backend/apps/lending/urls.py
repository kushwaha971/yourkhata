from django.urls import path

from apps.lending import views

urlpatterns = [
    path("today", views.TodayView.as_view()),
    path("routes", views.RoutesView.as_view()),
    path("routes/<uuid:pk>", views.RouteView.as_view()),
    path("borrowers", views.BorrowersView.as_view()),
    path("borrowers/<uuid:pk>", views.BorrowerView.as_view()),
    path("loans", views.LoansView.as_view()),
    path("loans/<uuid:pk>", views.LoanView.as_view()),
    path("loans/<uuid:pk>/collections", views.CollectView.as_view()),
    path("loans/<uuid:pk>/not-paid", views.NotPaidView.as_view()),
    path("loans/<uuid:pk>/close", views.CloseView.as_view()),
    path("collections/<uuid:pk>/remove", views.RemoveCollectionView.as_view()),
    path("remind", views.RemindView.as_view()),
    path("messages", views.MessagesView.as_view()),
    path("messages/text", views.MessageTextView.as_view()),
    path("settings", views.SettingsView.as_view()),
]
