from django.urls import path

from apps.library import views


def status(name: str):  # noqa: ANN201 - a view
    return type(f"{name.title()}View", (views.StatusView,), {"action_name": name}).as_view()


urlpatterns = [
    path("home", views.HomeView.as_view()),
    path("shifts", views.ShiftsView.as_view()),
    path("shifts/<uuid:pk>", views.ShiftView.as_view()),
    path("seats", views.SeatsView.as_view()),
    path("students", views.StudentsView.as_view()),
    path("students/<uuid:pk>", views.StudentView.as_view()),
    path("students/<uuid:pk>/move", views.MoveView.as_view()),
    path("students/<uuid:pk>/hold", status("hold")),
    path("students/<uuid:pk>/resume", status("resume")),
    path("students/<uuid:pk>/leave", status("leave")),
    path("students/<uuid:pk>/payments", views.PaymentsView.as_view()),
    path("payments/<uuid:pk>/remove", views.RemovePaymentView.as_view()),
    path("fees", views.FeesView.as_view()),
    path("fees/poster", views.PosterView.as_view()),
    path("messages", views.MessagesView.as_view()),
    path("messages/text", views.MessageTextView.as_view()),
    path("attendance", views.AttendanceView.as_view()),
    path("money", views.MoneyView.as_view()),
    path("expenses", views.ExpensesView.as_view()),
    path("expenses/<uuid:pk>/remove", views.RemoveExpenseView.as_view()),
    path("books", views.BooksView.as_view()),
    path("books/<uuid:pk>", views.BookView.as_view()),
    path("books/<uuid:pk>/give", views.GiveBookView.as_view()),
    path("issues/<uuid:pk>/back", views.TakeBackView.as_view()),
    path("settings", views.SettingsView.as_view()),
]
