"""The Money Book's rules, through its API (docs/revamp/moneybook/01-model-and-api.md)."""

from __future__ import annotations

from decimal import Decimal
from uuid import uuid4

import pytest
from django.db import connection, transaction
from django.db.utils import InternalError

from apps.moneybook.models import Entry, Person
from apps.moneybook.services import recalc_balance

pytestmark = pytest.mark.django_db
ROOT = "/api/v1/moneybook/"


def post(client, path, data=None, key=None):
    return client.post(ROOT + path, data or {}, format="json", HTTP_IDEMPOTENCY_KEY=key or str(uuid4()))


@pytest.fixture
def me(tenant, api_as):
    client, member = api_as(tenant)
    return client, member.user


def add(client, name="Suresh Jadhav", mobile="9822041178"):
    r = post(client, "people", {"name": name, "mobile": mobile})
    assert r.status_code == 201, r.content
    return r.json()["data"]["id"]


def entry(client, pid, kind, amount, **extra):
    r = post(client, f"people/{pid}/entries", {"kind": kind, "amount": amount, **extra})
    assert r.status_code == 201, r.content
    return r.json()


def balance(client, pid):
    return client.get(ROOT + f"people/{pid}").json()["data"]["balance"]


def test_gave_and_got_move_the_balance_by_exactly_the_amount(me):
    """The book's one job: gave adds what they owe, got takes it away."""
    client, _ = me
    pid = add(client)
    entry(client, pid, "gave", "3500")
    assert balance(client, pid) == "3500.00"
    body = entry(client, pid, "got", "2000", note="Paid by UPI")
    assert body["meta"]["person"]["balance"] == "1500.00"
    assert body["meta"]["person"]["last_entry_note"] == "Paid by UPI"


def test_a_retry_with_the_same_key_posts_once(me):
    """A double tap or a lost reply must never post a second entry."""
    client, _ = me
    pid = add(client)
    key = str(uuid4())
    first = post(client, f"people/{pid}/entries", {"kind": "gave", "amount": "500"}, key=key)
    again = post(client, f"people/{pid}/entries", {"kind": "gave", "amount": "500"}, key=key)
    assert first.status_code == again.status_code == 201
    assert Entry.objects.filter(person_id=pid).count() == 1
    assert balance(client, pid) == "500.00"


@pytest.mark.parametrize("amount", ["0", "-5", "abc", "99999999999", ""])
def test_a_bad_amount_is_refused_and_stores_nothing(me, amount):
    """E7/E8: zero, negative, junk and extra zeros never become an entry."""
    client, _ = me
    pid = add(client)
    r = post(client, f"people/{pid}/entries", {"kind": "gave", "amount": amount})
    assert r.status_code == 400
    assert "amount" in r.json()["error"]["details"]
    assert Entry.objects.count() == 0


def test_a_future_date_is_refused_and_a_past_one_kept(me):
    """The design lets the date change; it may not be after today."""
    client, _ = me
    pid = add(client)
    r = post(client, f"people/{pid}/entries", {"kind": "gave", "amount": "10", "entry_date": "2999-01-01"})
    assert r.status_code == 400
    body = entry(client, pid, "gave", "10", entry_date="2026-10-05")
    assert body["data"]["entry_date"] == "2026-10-05"


def test_preview_says_the_balance_after_and_saves_nothing(me):
    """The sheet's "After this: ₹8,000 to get" — the save's rule, without the save."""
    client, _ = me
    pid = add(client)
    entry(client, pid, "gave", "4500")
    r = post(client, f"people/{pid}/entries?preview=true", {"kind": "gave", "amount": "3500"})
    assert r.json()["data"] == {"balance": "4500.00", "balance_after": "8000.00"}
    assert Entry.objects.count() == 1


def test_a_correction_moves_by_the_difference_and_keeps_the_original(me):
    """Typed 1500 for 1000: the balance moves by −500 and the mistake stays visible."""
    client, _ = me
    pid = add(client)
    wrong = entry(client, pid, "gave", "1500", note="Cement")["data"]["id"]
    entry(client, pid, "got", "400")
    r = post(client, f"entries/{wrong}/replace", {"kind": "gave", "amount": "1000", "note": "Cement", "reason": "Typo"})
    assert r.status_code == 201, r.content
    assert r.json()["meta"]["person"]["balance"] == "600.00"
    live = client.get(ROOT + f"people/{pid}/entries").json()["data"]
    every = client.get(ROOT + f"people/{pid}/entries?include_removed=true").json()["data"]
    assert [e["amount"] for e in live] == ["400.00", "1000.00"]
    assert len(every) == 4


def test_a_corrected_entry_keeps_its_place_so_no_balance_lies(me):
    """The old book ordered a correction by when it was typed, so a row typed in
    between read "Bal ₹400 to give" for a person who never owed (11 Nov round)."""
    client, _ = me
    pid = add(client)
    wrong = entry(client, pid, "gave", "1500")["data"]["id"]
    entry(client, pid, "got", "400")
    post(client, f"entries/{wrong}/replace", {"kind": "gave", "amount": "1000"})
    live = client.get(ROOT + f"people/{pid}/entries").json()["data"]
    assert [(e["amount"], e["balance_after"]) for e in live] == [("400.00", "600.00"), ("1000.00", "1000.00")]


def test_removing_an_entry_undoes_it_once(me):
    """A removal is the opposite entry; a second removal of the same one is refused."""
    client, _ = me
    pid = add(client)
    eid = entry(client, pid, "got", "400")["data"]["id"]
    assert post(client, f"entries/{eid}/remove", {"reason": "Twice"}).json()["meta"]["person"]["balance"] == "0.00"
    again = post(client, f"entries/{eid}/remove", {"reason": "Twice"})
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "entry_already_reversed"


def test_the_cached_balance_equals_a_full_recount(me):
    """A cache moved one entry at a time must reach what every row adds up to."""
    client, _ = me
    pid = add(client)
    ids = [entry(client, pid, k, a)["data"]["id"] for k, a in [("gave", "999.99"), ("got", "120.50"), ("gave", "7")]]
    post(client, f"entries/{ids[0]}/replace", {"kind": "got", "amount": "50"})
    post(client, f"entries/{ids[1]}/remove", {})
    person = Person.objects.get(pk=pid)
    assert person.balance == recalc_balance(person) == Decimal("-43.00")


def test_an_entry_cannot_be_edited_or_deleted_in_the_database(me):
    """History is enforced by the database, not by remembering to be careful."""
    client, _ = me
    pid = add(client)
    eid = entry(client, pid, "gave", "100")["data"]["id"]
    for sql in (
        "UPDATE moneybook_entry SET amount = 1 WHERE id = %s",
        "DELETE FROM moneybook_entry WHERE id = %s",
    ):
        with pytest.raises(Exception), transaction.atomic(), connection.cursor() as cursor:
            cursor.execute(sql, [eid])
    assert Entry.objects.get(pk=eid).amount == Decimal("100.00")


def test_the_same_name_twice_points_at_the_first(me):
    """Two "Suresh"es is how a book splits one person's money in two."""
    client, _ = me
    pid = add(client, "Suresh")
    r = post(client, "people", {"name": "  suresh "})
    assert r.status_code == 409
    assert r.json()["error"]["details"]["id"] == pid


def test_archive_needs_exactly_zero(me):
    """No tolerance band: ₹0.01 owed is still owed."""
    client, _ = me
    pid = add(client)
    entry(client, pid, "gave", "0.01")
    r = post(client, f"people/{pid}/archive")
    assert r.status_code == 409 and r.json()["error"]["code"] == "balance_not_settled"
    entry(client, pid, "got", "0.01")
    assert post(client, f"people/{pid}/archive").json()["data"]["archived"] is True


def test_totals_are_over_the_whole_filtered_book(me):
    """The two figures on top are the book's, not the page's."""
    client, _ = me
    for i in range(30):
        entry(client, add(client, f"P{i:02}"), "gave" if i % 3 else "got", "100")
    body = client.get(ROOT + "people?page_size=5").json()
    assert body["meta"]["total"] == 30
    assert body["meta"]["totals"]["to_get"] == "2000.00"
    assert body["meta"]["totals"]["to_give"] == "1000.00"
    assert body["meta"]["totals"]["people_to_get"] == 20
    assert body["meta"]["totals"]["net"] == "1000.00"
    give = client.get(ROOT + "people?balance=give").json()["meta"]["totals"]
    assert give["to_get"] == "0.00" and give["people"] == 10


def test_a_book_is_private_to_its_owner(tenant, api_as):
    """Same business, same role: another person's book is not found, not shown."""
    mine, _ = api_as(tenant)
    theirs, _ = api_as(tenant)
    pid = add(mine)
    entry(mine, pid, "gave", "500")
    assert theirs.get(ROOT + "people").json()["data"] == []
    assert theirs.get(ROOT + f"people/{pid}").status_code == 404
    assert post(theirs, f"people/{pid}/entries", {"kind": "gave", "amount": "1"}).status_code == 404


def test_the_shop_never_sees_a_money_book_person(me):
    """The owner's rule: no relation with the Shop, as two shops have none."""
    client, _ = me
    add(client, "Ramesh only in my book")
    assert client.get("/api/v1/parties?book=shop&q=Ramesh").json()["data"] == []


def test_the_report_adds_up_for_everyone_and_for_one(me):
    """I3: you gave, you got and what stands now, over any dates."""
    client, _ = me
    a, b = add(client, "A"), add(client, "B")
    entry(client, a, "gave", "3500", entry_date="2026-10-22")
    entry(client, a, "got", "2000", entry_date="2026-10-30")
    entry(client, b, "gave", "1200", entry_date="2026-09-01")
    month = client.get(ROOT + "report?from=2026-10-01&to=2026-10-31").json()
    assert month["meta"]["summary"]["you_gave"] == "3500.00"
    assert month["meta"]["summary"]["you_got"] == "2000.00"
    assert month["meta"]["summary"]["to_get_now"] == "2700.00"
    assert [r["person_name"] for r in month["data"]] == ["A", "A"]
    one = client.get(ROOT + f"report?person={b}").json()["meta"]["summary"]
    assert one["you_gave"] == "1200.00" and one["to_get_now"] == "1200.00"
    assert client.get(ROOT + "report?from=2026-10-31&to=2026-10-01").status_code == 400


def test_old_dues_lists_who_owes_and_has_gone_quiet(me):
    """Old dues: money to get and no entry for N days, oldest first."""
    client, _ = me
    quiet, fresh, owed_to = add(client, "Quiet"), add(client, "Fresh"), add(client, "Owed to")
    entry(client, quiet, "gave", "800", entry_date="2026-08-01")
    entry(client, fresh, "gave", "800")
    entry(client, owed_to, "got", "800", entry_date="2026-08-01")
    names = [p["name"] for p in client.get(ROOT + "old-dues?days=30").json()["data"]]
    assert names == ["Quiet"]


def test_a_reminder_is_the_owners_words_and_is_only_logged(me):
    """Nothing is sent by the product; the text is signed with the owner's name."""
    client, user = me
    pid = add(client, "Suresh Jadhav")
    entry(client, pid, "gave", "4500")
    client.patch(ROOT + "settings", {"upi_id": "rk@upi", "sign_as": "Ravi"}, format="json")
    text = client.get(ROOT + f"reminders/text?person={pid}&tone=polite").json()["data"]["text"]
    assert text.startswith("Hi Suresh, a gentle reminder: ₹4,500 is pending")
    assert "rk@upi" in text and text.endswith("— Ravi")
    assert "YourKhata" not in text and "yourkhata" not in text
    r = post(client, "reminders", {"person_id": pid, "tone": "polite", "channel": "whatsapp", "text": text})
    assert r.status_code == 201
    assert client.get(ROOT + "reminders").json()["data"][0]["person_name"] == "Suresh Jadhav"


def test_no_reminder_to_someone_who_owes_nothing(me):
    client, _ = me
    pid = add(client)
    entry(client, pid, "got", "100")
    r = post(client, "reminders", {"person_id": pid, "tone": "polite", "channel": "sms", "text": "Hi"})
    assert r.status_code == 409 and r.json()["error"]["code"] == "nothing_to_remind"


def test_the_list_is_ordered_by_the_day_of_the_last_entry(me):
    """A back-dated entry typed today must not jump its person to the top: the
    design's list reads Today, Yesterday, 3 days ago, 12 Oct, 28 Sep."""
    client, _ = me
    old, new = add(client, "Old"), add(client, "New")
    entry(client, new, "gave", "10")
    entry(client, old, "gave", "10", entry_date="2026-09-28")  # typed after, dated before
    names = [p["name"] for p in client.get(ROOT + "people").json()["data"]]
    assert names == ["New", "Old"]


def test_a_reminder_is_unsigned_unless_the_owner_signs_it(me):
    """The design's message ends at "Thanks!": it goes from the owner's own
    WhatsApp, so it is theirs already. A signature appears only when they set one."""
    client, _ = me
    pid = add(client, "Suresh Jadhav")
    entry(client, pid, "gave", "4500", entry_date="2026-10-22")
    text = client.get(ROOT + f"reminders/text?person={pid}&tone=polite").json()["data"]["text"]
    assert text == "Hi Suresh, a gentle reminder: ₹4,500 is pending from our account (last entry 22 Oct). Thanks!"


def test_the_reminder_is_written_in_the_language_on_screen(me):
    """H33: a Hindi screen wrote an English message, because the server used the
    account's saved language rather than the person's switch (hand pass, 12 Nov)."""
    client, _ = me
    pid = add(client, "Suresh Jadhav")
    entry(client, pid, "gave", "4500", entry_date="2026-10-22")
    hi = client.get(ROOT + f"reminders/text?person={pid}&tone=polite&lang=hi").json()["data"]["text"]
    assert hi.startswith("नमस्ते Suresh") and "₹4,500" in hi
    en = client.get(ROOT + f"reminders/text?person={pid}&tone=polite&lang=en").json()["data"]["text"]
    assert en.startswith("Hi Suresh")
