"""Seed a study library like the design's (Part I, I4–I7) on the QA business.

Run with: manage.py shell < e2e/library_seed.py   (E2E_LIBRARY_EMAIL picks the owner)

The students are the design's own names and states, placed RELATIVE TO TODAY so
the screens show every fee state whatever day the round runs: overdue by 5, 3,
2 and 1 days, due soon, part paid, paid, on hold, plus empty seats. Re-running
it first clears this library's rows, so a round always starts from the same room.
"""

import datetime as dt
import os
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import connection

from apps.common.dates import tenant_today
from apps.library import fees
from apps.library.models import (
    Attendance, Book, BookIssue, Expense, Message, Payment, Seat, Settings, Shift, Student,
)
from apps.library.services import seed_library, set_seat_count
from apps.platform_app.models import Membership

email = os.environ.get("E2E_LIBRARY_EMAIL", "scale@digikhaato.test")
user = get_user_model().objects.get(email=email)
tenant = Membership.objects.filter(user=user).select_related("tenant").first().tenant

with connection.cursor() as cur:
    cur.execute("ALTER TABLE library_payment DISABLE TRIGGER library_payment_is_history")
    # A removal row points at the payment it undid: it goes first.
    Payment.objects.filter(tenant=tenant, removes__isnull=False).delete()
    for model in (BookIssue, Book, Message, Attendance, Payment, Expense, Student, Seat, Shift, Settings):
        model.objects.filter(tenant=tenant).delete()
    cur.execute("ALTER TABLE library_payment ENABLE TRIGGER library_payment_is_history")

seed_library(None, tenant)
Settings.objects.filter(tenant=tenant).update(sign_as="Gyan Study Library", upi_id="gyan@upi")
fee = {"Morning": 800, "Evening": 800, "Full day": 1200}
for s in Shift.objects.filter(tenant=tenant):
    s.monthly_fee = fee[s.name]
    s.save()
set_seat_count(tenant=tenant, user=user, count=60)
shift = {s.name: s for s in Shift.objects.filter(tenant=tenant)}
seat = {s.number: s for s in Seat.objects.filter(tenant=tenant)}
today = tenant_today(tenant)


def add(name, mobile, number, shift_name, paid_to_delta, credit=0, status="active", months_paid=3):
    sh = shift[shift_name]
    paid_to = today + dt.timedelta(days=paid_to_delta)
    joined = fees.add_months(paid_to, -months_paid, paid_to.day)
    st = Student.objects.create(
        tenant=tenant, created_by=user, name=name, mobile=mobile, seat=seat.get(number), shift=sh,
        monthly_fee=sh.monthly_fee, joined_on=joined, paid_to=paid_to, credit=Decimal(credit), status=status,
    )
    # The payments that brought them here, a month each, so history and "paid this year" are real.
    for i in range(months_paid):
        start = fees.add_months(joined, i, joined.day)
        end = fees.add_months(joined, i + 1, joined.day)
        Payment.objects.create(
            tenant=tenant, created_by=user, student=st, amount=sh.monthly_fee, mode="upi" if i % 2 else "cash",
            paid_on=min(start, today), months=1, from_date=start, to_date=end - dt.timedelta(days=1),
            paid_to_before=start, credit_before=Decimal(0),
        )
    if credit:
        Payment.objects.create(
            tenant=tenant, created_by=user, student=st, amount=Decimal(credit), mode="cash",
            paid_on=today, months=0, paid_to_before=paid_to, credit_before=Decimal(0),
        )
    return st


rahul = add("Rahul Gaikwad", "9764011820", 14, "Full day", -5)
add("Nikhil Raut", "9822041178", 22, "Morning", -3)
add("Swati Kale", "9850012345", 5, "Evening", -2)
add("Omkar Patil", "9890034567", 40, "Morning", -1)
add("Pooja Shinde", "9890122311", 8, "Morning", 3)
add("Sneha More", "9767055512", 3, "Evening", 18)
add("Akash Pawar", "9545066623", 21, "Morning", 9, credit=400)
add("Kiran Jagtap", "9623077734", 30, "Full day", 11, status="hold")
names = ["Priya Deshmukh", "Amit Jadhav", "Rohit Shinde", "Neha Kulkarni", "Vishal Bhosale", "Pallavi Gite",
         "Sagar Mane", "Komal Salunkhe", "Tushar Kale", "Ankita Pawar", "Mahesh Thorat", "Sonal Gaikwad"]
for i, n in enumerate(names):
    add(n, f"98{90000000 + i * 1111:08d}", [1, 2, 4, 6, 7, 9, 10, 11, 12, 13, 15, 16][i],
        "Morning" if i % 2 == 0 else "Evening", 12 + i)
Expense.objects.create(tenant=tenant, created_by=user, spent_on=today.replace(day=1), head="rent", amount=9000)
Expense.objects.create(tenant=tenant, created_by=user, spent_on=today.replace(day=1), head="electricity", amount=1850)
Attendance.objects.create(tenant=tenant, created_by=user, student=rahul, day=today,
                          in_at=dt.datetime.now(dt.timezone.utc))
lucent = Book.objects.create(tenant=tenant, created_by=user, title="Lucent's General Knowledge",
                             author="Lucent", copies=2, code="9789384761540")
Book.objects.create(tenant=tenant, created_by=user, title="Indian Polity", author="M. Laxmikanth", copies=1,
                    code="9789355323489")
BookIssue.objects.create(tenant=tenant, created_by=user, book=lucent, student=rahul, given_on=today)
print("seeded", tenant.name, Student.objects.filter(tenant=tenant).count(), "students")
