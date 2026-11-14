from django.apps import AppConfig


class LendingConfig(AppConfig):
    """Loans & Collections: a small lender's loans, round and collections.

    Rebuilt from scratch on 12 Nov 2026 as an app that stands alone (owner: "I
    don't want any relation with shop"). Its tables are its own; it reads and
    writes no Shop table and no other app's. See
    docs/revamp/lending/01-model-and-api.md.
    """

    name = "apps.lending"
    label = "lending"
    verbose_name = "Lending"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self) -> None:
        from apps.common.jobs import Schedule, register_schedule
        from apps.lending import tasks
        from apps.lending.services import seed_lending
        from apps.notifications.constants import NotificationCategory, NotificationSeverity
        from apps.notifications.services.notify import NotificationType, register_notification_type
        from apps.platform_app.apps_registry import AppSpec, SetupStep, register_app, register_app_setup
        from apps.platform_app.services.guards import register_module_enable_hook

        register_module_enable_hook("lending", seed_lending)

        from apps.lending import importers

        importers.register()
        register_app(
            AppSpec(
                code="lending",
                label_id="nav.workspace.lending",
                anchor="lending",
                # `import_export`: running loans from the paper register.
                capabilities=frozenset({"lending", "import_export"}),
                entry_permission="lending.loan.read",
                home_path="/lending",
                order=20,
            )
        )

        def lending_setup(tenant: object) -> list:
            """The first steps a lender takes: a borrower, a loan, a route."""
            from apps.lending.models import Borrower, Loan, Route

            return [
                SetupStep(key="loan", label_id="lending.setup.loan", path="/lending/loans/new",
                          done=Loan.objects.filter(tenant=tenant).exists(), permission="lending.loan.create"),
                SetupStep(key="routes", label_id="lending.setup.routes", path="/lending/routes",
                          done=Route.objects.filter(tenant=tenant).exists(), permission="lending.settings.manage"),
                SetupStep(key="borrower", label_id="lending.setup.borrower", path="/lending/borrowers",
                          done=Borrower.objects.filter(tenant=tenant).exists(), permission="lending.loan.create"),
            ]

        register_app_setup("lending", lending_setup)

        # The morning bell: loans that became late today.
        register_notification_type(
            tasks.LATE_TODAY,
            NotificationType(
                code=tasks.LATE_TODAY,
                category=NotificationCategory.REMINDERS,
                severity=NotificationSeverity.WARNING,
                required_permission="lending.loan.read",
                title_en="Loans late today: {count}",
                body_en="Tap to see who to remind",
                group_window=24 * 60,
                route=lambda _params: "/lending/messages",
            ),
        )
        register_schedule(Schedule(tasks.LATE_TODAY, period="daily", at_hour_ist=8, minute=0))
