"""A lender's messages to borrowers (I11), signed with the lender's business
only — never the product's. Nothing is sent: WhatsApp opens with this text and
the lender presses send (DEC-012)."""

from __future__ import annotations

import datetime as dt
from decimal import Decimal
from typing import Any

from apps.lending.constants import MessageKind
from apps.lending.models import Loan, Settings

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

TEXT = {
    "en": {
        MessageKind.LATE: "Namaste {first} ji, {late} from {since} is still to be paid on loan {number}. I will come by tomorrow morning.{upi} – {name}",
        MessageKind.DUE_TODAY: "Namaste {first} ji, today's {today} on loan {number} is due. I will come by today.{upi} – {name}",
        MessageKind.DUE_TOMORROW: "Namaste {first} ji, {each} on loan {number} is due tomorrow. Please keep it ready.{upi} – {name}",
        MessageKind.RECEIPT: "Namaste {first} ji, received {amount} ({mode}) on {on} for loan {number}. {left} left.{late_line} – {name}",
    },
    "hi": {
        MessageKind.LATE: "नमस्ते {first} जी, लोन {number} पर {since} से {late} देना बाकी है। मैं कल सुबह आऊँगा।{upi} – {name}",
        MessageKind.DUE_TODAY: "नमस्ते {first} जी, लोन {number} पर आज के {today} देने हैं। मैं आज आऊँगा।{upi} – {name}",
        MessageKind.DUE_TOMORROW: "नमस्ते {first} जी, लोन {number} पर कल {each} देने हैं। कृपया तैयार रखें।{upi} – {name}",
        MessageKind.RECEIPT: "नमस्ते {first} जी, लोन {number} के लिए {on} को {amount} ({mode}) मिले। {left} बाकी।{late_line} – {name}",
    },
}
UPI = {"en": " UPI: {upi}.", "hi": " UPI: {upi}।"}
MODE = {"en": {"cash": "cash", "upi": "UPI"}, "hi": {"cash": "नकद", "upi": "UPI"}}
LATE_LINE = {"en": " {late} late.", "hi": " {late} देर से बाकी।"}


def rupees(amount: Decimal) -> str:
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


def lender_name(tenant: Any, settings: Settings) -> str:
    return settings.sign_as or getattr(tenant, "name", "") or ""


def lang_of(locale: str | None) -> str:
    return "hi" if (locale or "").startswith("hi") else "en"


def remind_text(*, tenant: Any, loan: Loan, pos: Any, kind: str, settings: Settings, locale: str) -> str:
    lang = lang_of(locale)
    return TEXT[lang][kind].format(
        first=loan.borrower.name.split(" ")[0],
        number=loan.number,
        late=rupees(pos.late),
        since=day_text(pos.late_since) if pos.late_since else "",
        today=rupees(pos.due_today or loan.each),
        each=rupees(loan.each),
        upi=UPI[lang].format(upi=settings.upi_id) if settings.upi_id else "",
        name=lender_name(tenant, settings),
    )


def receipt_text(*, tenant: Any, loan: Loan, amount: Decimal, mode: str, on: dt.date, pos: Any, settings: Settings, locale: str) -> str:
    lang = lang_of(locale)
    return TEXT[lang][MessageKind.RECEIPT].format(
        first=loan.borrower.name.split(" ")[0],
        number=loan.number,
        amount=rupees(amount),
        mode=MODE[lang][mode],
        on=day_text(on),
        left=rupees(pos.left),
        late_line=LATE_LINE[lang].format(late=rupees(pos.late)) if pos.late > 0 else "",
        name=lender_name(tenant, settings),
    )
