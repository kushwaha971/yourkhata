from django.urls import path

from apps.moneybook import views

urlpatterns = [
    path("people", views.PeopleView.as_view()),
    path("people/<uuid:pk>", views.PersonView.as_view()),
    path("people/<uuid:pk>/archive", views.ArchiveView.as_view()),
    path("people/<uuid:pk>/restore", views.RestoreView.as_view()),
    path("people/<uuid:pk>/entries", views.EntriesView.as_view()),
    path("entries/<uuid:pk>/remove", views.RemoveEntryView.as_view()),
    path("entries/<uuid:pk>/replace", views.ReplaceEntryView.as_view()),
    path("report", views.ReportView.as_view()),
    path("old-dues", views.OldDuesView.as_view()),
    path("reminders", views.RemindersView.as_view()),
    path("reminders/text", views.ReminderTextView.as_view()),
    path("settings", views.SettingsView.as_view()),
]
