"""A library's messages to its students (I6 receipt, I7 fee reminder), signed
with the LIBRARY's name only — never the product's. Nothing is sent from here:
the screen opens WhatsApp with this text and the person at the counter presses
send (DEC-012)."""

from __future__ import annotations

import datetime as dt
from decimal import Decimal
from typing import Any

from apps.library.constants import MessageKind
from apps.library.fees import FeeState
from apps.library.models import Payment, Settings, Student

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

TEXT = {
    "en": {
        MessageKind.FEE_DUE: "Hi {first}, your fee of {due} for {seat}at {library} was due on {date}.{upi}",
        "fee_soon": "Hi {first}, your fee of {due} for {seat}at {library} is due on {date}.{upi}",
        MessageKind.RECEIPT: "Hi {first}, received {amount} ({mode}) on {paid_on} at {library}. "
        "Your fee is paid to {paid_to}.{left} Thank you!",
        MessageKind.WELCOME: "Welcome to {library}, {first}! {seat_line}Monthly fee {fee}. Paid to {paid_to}.",
    },
    "hi": {
        MessageKind.FEE_DUE: "नमस्ते {first}, {library} में {seat}की फ़ीस {due} {date} को देनी थी।{upi}",
        "fee_soon": "नमस्ते {first}, {library} में {seat}की फ़ीस {due} {date} को देनी है।{upi}",
        MessageKind.RECEIPT: "नमस्ते {first}, {library} को {paid_on} को {amount} ({mode}) मिले। "
        "आपकी फ़ीस {paid_to} तक भरी है।{left} धन्यवाद!",
        MessageKind.WELCOME: "{library} में स्वागत है, {first}! {seat_line}महीने की फ़ीस {fee}। {paid_to} तक भरी है।",
    },
}
SEAT = {"en": "seat {n} ", "hi": "सीट {n} "}
SEAT_LINE = {"en": "Seat {n}, {shift}. ", "hi": "सीट {n}, {shift}। "}
UPI = {"en": " Pay by UPI: {upi}.", "hi": " UPI से भेजें: {upi}।"}
LEFT = {"en": " {left} is left for this month.", "hi": " इस महीने के {left} बाकी हैं।"}
MODE = {"en": {"cash": "cash", "upi": "UPI"}, "hi": {"cash": "नकद", "upi": "UPI"}}


def rupees(amount: Decimal) -> str:
    """₹4,500 or ₹4,500.50 — Indian grouping, no paise when there are none."""
    whole, _, paise = f"{abs(amount):.2f}".partition(".")
    head, tail = whole[:-3], whole[-3:]
    groups = []
    while len(head) > 2:
        groups.insert(0, head[-2:])
        head = head[:-2]
    if head:
        groups.insert(0, head)
    text = ",".join([*groups, tail]) if groups else tail
    return f"₹{text}" + ("" if paise == "00" else f".{paise}")


def day_text(day: dt.date) -> str:
    return f"{day.day} {MONTHS[day.month - 1]}"


def library_name(tenant: Any, settings: Settings) -> str:
    return settings.sign_as or getattr(tenant, "name", "") or ""


def lang_of(locale: str | None) -> str:
    return "hi" if (locale or "").startswith("hi") else "en"


def fee_text(*, tenant: Any, student: Student, state: FeeState, settings: Settings, locale: str) -> str:
    lang = lang_of(locale)
    key = MessageKind.FEE_DUE if state.days_late > 0 else "fee_soon"
    due = state.due if state.due > 0 else student.monthly_fee
    return TEXT[lang][key].format(
        first=student.name.split(" ")[0],
        due=rupees(due),
        seat=SEAT[lang].format(n=student.seat.number) if student.seat_id else "",
        library=library_name(tenant, settings),
        date=day_text(state.paid_to),
        upi=UPI[lang].format(upi=settings.upi_id) if settings.upi_id else "",
    )


def receipt_text(*, tenant: Any, payment: Payment, student: Student, settings: Settings, locale: str) -> str:
    lang = lang_of(locale)
    left = student.monthly_fee - student.credit if student.credit > 0 else Decimal("0")
    return TEXT[lang][MessageKind.RECEIPT].format(
        first=student.name.split(" ")[0],
        amount=rupees(payment.amount),
        mode=MODE[lang][payment.mode],
        paid_on=day_text(payment.paid_on),
        library=library_name(tenant, settings),
        paid_to=day_text(student.paid_to) if student.paid_to else "—",
        left=LEFT[lang].format(left=rupees(left)) if left > 0 else "",
    )


def welcome_text(*, tenant: Any, student: Student, state: FeeState, settings: Settings, locale: str) -> str:
    lang = lang_of(locale)
    return TEXT[lang][MessageKind.WELCOME].format(
        first=student.name.split(" ")[0],
        library=library_name(tenant, settings),
        seat_line=SEAT_LINE[lang].format(n=student.seat.number, shift=student.shift.name) if student.seat_id else "",
        fee=rupees(student.monthly_fee),
        paid_to=day_text(state.paid_to),
    )
