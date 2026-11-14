"""Seed a lender like the design's (Part I, I8–I11) on the QA business.

Run with: manage.py shell < e2e/lending_seed.py   (E2E_LENDING_EMAIL picks the owner)

The design's own round on "Market road" — Sunil Mane two days late, Kavita due
today, Imran collected, Rekha late, Ganesh not paid — placed RELATIVE TO TODAY,
so every state shows whatever day the round runs. Re-running clears this book.
"""

import datetime as dt
import os
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import connection

from apps.common.dates import tenant_today
from apps.lending import book, services
from apps.lending.models import Borrower, Collection, Due, Loan, Message, Route, Settings, Visit
from apps.platform_app.models import Membership

email = os.environ.get("E2E_LENDING_EMAIL", "scale@digikhaato.test")
user = get_user_model().objects.get(email=email)
tenant = Membership.objects.filter(user=user).select_related("tenant").first().tenant
if "lending" not in (tenant.enabled_modules or []):
    tenant.enabled_modules = sorted({*tenant.enabled_modules, "lending"})
    tenant.save(update_fields=["enabled_modules"])

with connection.cursor() as cur:
    cur.execute("ALTER TABLE lending_collection DISABLE TRIGGER lending_collection_is_history")
    cur.execute("ALTER TABLE lending_due DISABLE TRIGGER lending_due_is_fixed")
    Collection.objects.filter(tenant=tenant, removes__isnull=False).delete()
    for model in (Message, Visit, Collection, Due, Loan, Borrower, Route, Settings):
        model.objects.filter(tenant=tenant).delete()
    cur.execute("ALTER TABLE lending_collection ENABLE TRIGGER lending_collection_is_history")
    cur.execute("ALTER TABLE lending_due ENABLE TRIGGER lending_due_is_fixed")

today = tenant_today(tenant)
services.update_settings(tenant=tenant, data={"sign_as": "Shiv Finance", "upi_id": "shiv@upi"})
market = services.save_route(tenant=tenant, user=user, data={"name": "Market road"})
station = services.save_route(tenant=tenant, user=user, data={"name": "Station side"})


def back(days: int) -> dt.date:
    """`days` collection days before today, Sundays skipped."""
    d = today
    n = 0
    while n < days:
        d -= dt.timedelta(days=1)
        if d.weekday() != 6:
            n += 1
    return d


def lend(name, mobile, work, route, *, each, count=40, started=10, paid_days=None, extra=0, frequency="daily"):
    """A daily loan that started `started` collection days ago, with `paid_days` of them paid."""
    b = services.save_borrower(tenant=tenant, user=user, data={"name": name, "mobile": mobile, "work": work, "route_id": str(route.pk)})
    starts = back(started) if frequency == "daily" else today - dt.timedelta(weeks=started)
    loan = services.create_loan(tenant=tenant, user=user, data={
        "borrower_id": str(b.pk), "route_id": str(route.pk), "lent": str(Decimal(each) * count), "frequency": frequency,
        "count": count, "each": str(each), "starts_on": starts.isoformat(),
    })
    days = paid_days if paid_days is not None else started
    if days:
        Collection.objects.create(tenant=tenant, created_by=user, loan=loan, amount=Decimal(each) * days,
                                  mode="cash", collected_on=back(1) if started else today)
    if extra:
        Collection.objects.create(tenant=tenant, created_by=user, loan=loan, amount=Decimal(extra), mode="upi", collected_on=today)
    return loan


lend("Sunil Mane", "9822041178", "Tea stall", market, each=500, started=11, paid_days=9)        # 2 days late
lend("Kavita Gaikwad", "9022471830", "Vegetables", market, each=300, started=6)                   # due today
lend("Imran Shaikh", "9850011223", "Tailor", market, each=500, started=8, extra=500)              # collected today
lend("Rekha Jadhav", "9767022334", "Flowers", market, each=200, started=12, paid_days=10)         # 2 days late
g = lend("Ganesh Pawar", "9545033445", "Pan shop", market, each=400, started=5)                   # not paid today
Visit.objects.create(tenant=tenant, created_by=user, loan=g, day=today, reason="Shop closed",
                     promised_on=today + dt.timedelta(days=1))
for i, (n, w) in enumerate([("Prakash Kamble", "Cobbler"), ("Sanjay More", "Fruit cart"), ("Meena Salve", "Tiffin"),
                            ("Anil Bhosale", "Auto"), ("Lata Pawar", "Bangles")]):
    lend(n, f"98{30000000 + i * 1111:08d}", w, station, each=300 + 100 * i, started=6 + i, paid_days=6 + i - (i % 3))
lend("Vijay Gite", "9890077889", "Hardware", market, each=1000, count=12, started=3, paid_days=3, frequency="weekly")
print("seeded", tenant.name, Loan.objects.filter(tenant=tenant).count(), "loans")
