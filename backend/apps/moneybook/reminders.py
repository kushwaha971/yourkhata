"""The reminder's words (I3): the owner's own message, in the owner's language,
signed with the owner's name — never the product's (DEC-012, and nothing a
customer receives names the product). Nothing is sent from here: the screen
opens WhatsApp or SMS with this text and the owner presses send."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from apps.moneybook.constants import ReminderTone
from apps.moneybook.models import Person, Settings

TEMPLATES = {
    "en": {
        ReminderTone.POLITE: "Hi {name}, a gentle reminder: {amount} is pending{since}.{upi} Thanks!",
        ReminderTone.DUE_DATE: "Hi {name}, {amount} is due{since}. Please pay it this week.{upi}",
        ReminderTone.THANK_YOU: "Hi {name}, thank you for the payment. {amount} is still pending.{upi}",
    },
    "hi": {
        ReminderTone.POLITE: "नमस्ते {name}, याद दिलाना था: {amount} बाकी है{since}।{upi} धन्यवाद!",
        ReminderTone.DUE_DATE: "नमस्ते {name}, {amount} देना बाकी है{since}। कृपया इस हफ़्ते दे दें।{upi}",
        ReminderTone.THANK_YOU: "नमस्ते {name}, पैसे देने के लिए धन्यवाद। {amount} अभी बाकी है।{upi}",
    },
}
SINCE = {"en": " from our account (last entry {date})", "hi": " (आखिरी एंट्री {date})"}
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
UPI = {"en": " You can pay by UPI to {upi}.", "hi": " UPI से {upi} पर भेज सकते हैं।"}


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


def reminder_text(*, person: Person, tone: str, settings: Settings, locale: str) -> str:
    lang = "hi" if (locale or "").startswith("hi") else "en"
    since = ""
    if person.last_entry_date:
        when = person.last_entry_date
        since = SINCE[lang].format(date=f"{when.day} {MONTHS[when.month - 1]}")
    upi = UPI[lang].format(upi=settings.upi_id) if settings.upi_id else ""
    text = TEMPLATES[lang][tone].format(
        name=person.name.split(" ")[0], amount=rupees(person.balance), since=since, upi=upi
    )
    return f"{text}\n— {settings.sign_as}" if settings.sign_as else text

