from django.apps import AppConfig


class LibraryConfig(AppConfig):
    """Members & Fees: a study library's seats, students and monthly fees.

    Rebuilt from scratch on 12 Nov 2026 as an app that stands alone (owner: "I
    don't want any relation with shop"). Its tables are its own; it reads and
    writes no Shop table and no other app's. See
    docs/revamp/library/01-model-and-api.md.
    """

    name = "apps.library"
    label = "library"
    verbose_name = "Library"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self) -> None:
        from apps.library.services import seed_library
        from apps.platform_app.apps_registry import AppSpec, register_app
        from apps.platform_app.services.guards import register_module_enable_hook

        register_module_enable_hook("library", seed_library)

        from apps.library import importers

        importers.register()
        register_app(
            AppSpec(
                code="library",
                label_id="nav.workspace.library",
                anchor="library",
                # `import_export`: the students import from the paper register.
                capabilities=frozenset({"library", "import_export"}),
                entry_permission="library.member.read",
                home_path="/library",
                order=10,
            )
        )
        from apps.library.selectors import library_setup
        from apps.platform_app.apps_registry import register_app_setup

        register_app_setup("library", library_setup)
