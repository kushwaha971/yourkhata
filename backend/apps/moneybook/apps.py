from django.apps import AppConfig


class MoneyBookConfig(AppConfig):
    """The Money Book: one person's own book of money given and got.

    Rebuilt from scratch on 11 Nov 2026 as an app that stands alone (owner: "I
    don't want any relation with shop"). Its tables are its own and belong to a
    USER, not a business — no Shop table is read or written here, and the Shop
    never reads these. See docs/revamp/moneybook/01-model-and-api.md.
    """

    name = "apps.moneybook"
    label = "moneybook"
    verbose_name = "Money Book"
    default_auto_field = "django.db.models.BigAutoField"
