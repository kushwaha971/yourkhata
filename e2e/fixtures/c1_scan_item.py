"""C1 — one local TEST item with a known barcode in the QA shop, for e2e/c1-scan.mjs.

Run inside the backend (`python manage.py shell < ../e2e/fixtures/c1_scan_item.py`).
Idempotent: copies the unit and tax of an existing item of the same shop.
"""

from apps.inventory.models import Item
from apps.platform_app.models import User, Membership

user = User.objects.get(email="scale@digikhaato.test")
tenant = Membership.objects.filter(user=user).first().tenant
if Item.objects.filter(tenant=tenant, barcode="8906000000017").exists():
    print("exists")
else:
    model = Item.objects.filter(tenant=tenant, deleted_at__isnull=True).exclude(unit=None).first()
    item = Item.objects.get(pk=model.pk)
    item.pk = None
    item.id = None
    item.name = "C1 scan item"
    item.sku = "C1-SCAN-0001"
    item.barcode = "8906000000017"
    item.selling_price = "50.00"
    item.track_stock = False
    item.save()
    print("made", item.id)
