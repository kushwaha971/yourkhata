"""No junk a person (or a broken client) can send to Lending, the Library or the
Money Book may crash the server (QA audit, 12 Nov 2026).

A 500 on a shop counter reads "Something went wrong" and says nothing about what
to fix; every one of these must be a 4xx that names the field. The harness fires
every junk body and every junk query value at every route of the three apps and
fails on any 5xx, naming the route and the input.
"""

from __future__ import annotations

import logging
import traceback
from types import SimpleNamespace
from uuid import uuid4

import pytest

from apps.library.models import Shift
from apps.library.services import seed_library

pytestmark = pytest.mark.django_db
V1 = "/api/v1/"

JUNK_VALUES = [
    None, "", " ", "abc", "0", "-1", "1e400", "NaN", "Infinity", "9" * 40, "१२३", "12.345", "0.001",
    0, -1, 10**30, 1.5, True, False, [], [1], {}, {"a": 1}, "x" * 5000, "<b>x</b>", "'; drop table x;--",
    "\x00", "😀" * 50, "2026-02-30", "0001-01-01", "9999-12-31", "1900-01-01", "not-a-uuid", str(uuid4()),
]
JUNK_QUERY = ["abc", "-1", "0", "9" * 40, "1e400", "", "'", "%00", "😀", "2026-13-45", "0001-01-01", "9999-12-31", str(uuid4())]
QUERY_KEYS = ["page", "page_size", "q", "route", "loan", "person", "day", "from", "to", "days", "status", "kind",
              "balance", "sort", "tone", "lang", "month", "shift", "student", "format", "include_removed", "date"]


def entitle(tenant, *modules):
    for row, field in ((tenant.plan, "modules"), (tenant.partner, "allowed_modules")):
        setattr(row, field, sorted(set(getattr(row, field) or []) | set(modules)))
        row.save(update_fields=[field])
    tenant.enabled_modules = sorted(set(tenant.enabled_modules or []) | set(modules))
    tenant.save(update_fields=["enabled_modules"])
    tenant.refresh_from_db()


LAST_CRASH: list[str] = []


class _CrashNotes(logging.Handler):
    """Keeps what the last unhandled error was, so a failure names its cause."""

    def emit(self, record):
        if not record.exc_info:
            return
        kind, error, tb = record.exc_info
        ours = [f for f in traceback.extract_tb(tb) if "/apps/" in f.filename][-1:]
        spot = f"{ours[0].filename.split('/apps/')[1]}:{ours[0].lineno}" if ours else "?"
        LAST_CRASH[:] = [f"{kind.__name__} at {spot}: {str(error)[:70]}"]


logging.getLogger("ub.api").addHandler(_CrashNotes())


def send(client, method, path, body=None):
    kwargs = {"format": "json"}
    if method != "get":
        kwargs["HTTP_IDEMPOTENCY_KEY"] = str(uuid4())
    LAST_CRASH.clear()
    try:
        return getattr(client, method)(path, body, **kwargs) if method != "get" else client.get(path)
    except Exception as crash:  # noqa: BLE001 - an unhandled error is the server's 500
        LAST_CRASH[:] = LAST_CRASH or [repr(crash)[:120]]
        return SimpleNamespace(status_code=500, content=b"", json=dict)


def made(client, path, body):
    r = send(client, "post", V1 + path, body)
    assert r.status_code in (200, 201), (path, r.content)
    return r.json()["data"]


@pytest.fixture
def world(tenant, api_as):
    """One of everything in each app, and the routes that reach it."""
    entitle(tenant, "lending", "library")
    seed_library(None, tenant)
    client, _ = api_as(tenant)
    client.raise_request_exception = False

    route = made(client, "lending/routes", {"name": "Market road"})["id"]
    borrower = made(client, "lending/borrowers", {"name": "Sunil Mane", "mobile": "9822041178", "route_id": route})["id"]
    loan_body = {"borrower_id": borrower, "lent": "20000", "frequency": "daily", "count": 40, "each": "500",
                 "starts_on": "2026-11-02"}
    loan = made(client, "lending/loans", loan_body)["id"]
    collection = made(client, f"lending/loans/{loan}/collections", {"amount": "500", "mode": "cash"})["id"]

    person = made(client, "moneybook/people", {"name": "Suresh Jadhav", "mobile": "9822041179"})["id"]
    entry = made(client, f"moneybook/people/{person}/entries", {"kind": "gave", "amount": "3500"})["id"]

    assert client.put(V1 + "library/seats", {"count": 20}, format="json").status_code == 200
    shift = str(Shift.objects.filter(tenant=tenant).first().pk)
    student = made(client, "library/students", {"name": "Rahul Gaikwad", "seat": 4, "shift_id": shift, "monthly_fee": "800"})["id"]
    payment = made(client, f"library/students/{student}/payments", {"amount": "800", "mode": "cash"})["id"]
    lib_book = made(client, "library/books", {"title": "Physics", "copies": 2})["id"]

    routes = {
        "lending/today": ("get",), "lending/routes": ("get", "post"), f"lending/routes/{route}": ("patch",),
        "lending/borrowers": ("get", "post"), f"lending/borrowers/{borrower}": ("get", "patch"),
        "lending/loans": ("get", "post"), "lending/loans?preview=true": ("post",), f"lending/loans/{loan}": ("get",),
        f"lending/loans/{loan}/collections": ("post",), f"lending/loans/{loan}/collections?preview=true": ("post",),
        f"lending/loans/{loan}/not-paid": ("post",), f"lending/loans/{loan}/close": ("post",),
        f"lending/collections/{collection}/remove": ("post",), "lending/remind": ("get",),
        "lending/messages": ("get", "post"), "lending/messages/text": ("get",), "lending/settings": ("get", "patch"),
        "moneybook/people": ("get", "post"), f"moneybook/people/{person}": ("get", "patch"),
        f"moneybook/people/{person}/archive": ("post",), f"moneybook/people/{person}/restore": ("post",),
        f"moneybook/people/{person}/entries": ("get", "post"),
        f"moneybook/people/{person}/entries?preview=true": ("post",),
        f"moneybook/entries/{entry}/remove": ("post",), f"moneybook/entries/{entry}/replace": ("post",),
        "moneybook/report": ("get",), "moneybook/old-dues": ("get",), "moneybook/reminders": ("get", "post"),
        "moneybook/reminders/text": ("get",), "moneybook/settings": ("get", "patch"),
        "library/home": ("get",), "library/shifts": ("get", "post"), f"library/shifts/{shift}": ("patch",),
        "library/seats": ("get", "put"), "library/students": ("get", "post"),
        f"library/students/{student}": ("get", "patch"), f"library/students/{student}/move": ("post",),
        f"library/students/{student}/hold": ("post",), f"library/students/{student}/resume": ("post",),
        f"library/students/{student}/leave": ("post",), f"library/students/{student}/payments": ("get", "post"),
        f"library/payments/{payment}/remove": ("post",), "library/fees": ("get",), "library/fees/poster": ("get",),
        "library/messages": ("get", "post"), "library/messages/text": ("get",),
        "library/attendance": ("get", "post"), "library/money": ("get",), "library/expenses": ("get", "post"),
        "library/books": ("get", "post"), f"library/books/{lib_book}": ("patch",),
        f"library/books/{lib_book}/give": ("post",), "library/settings": ("get", "patch"),
    }
    ids = {"route_id": route, "borrower_id": borrower, "loan_id": loan, "person_id": person, "shift_id": shift,
           "student_id": student}
    client.tenant, client.record_ids = tenant, {**ids, "collection": collection, "entry": entry, "payment": payment}
    return client, routes, ids


BODY_KEYS = ["name", "mobile", "amount", "kind", "note", "entry_date", "reason", "lent", "each", "count", "frequency",
             "starts_on", "skip_sundays", "borrower_id", "route_id", "loan_id", "person_id", "shift_id", "student_id",
             "seat", "mode", "collected_on", "paid_on", "day", "promised_on", "text", "tone", "channel", "active",
             "monthly_fee", "title", "copies", "upi_id", "sign_as", "old_dues_days", "hold_until", "joined_on",
             "work", "date", "category", "due_on", "months", "start", "end", "sort", "status", "discount", "deposit"]


# Its own transactions, as a real request has: inside the usual one-transaction
# test, one crash would make every later request crash too.
@pytest.mark.django_db(transaction=True)
def test_no_junk_body_crashes_any_route(world):
    """Every write route, sent each junk value in every field it might read, and
    bodies that are not objects at all, answers 4xx (or does the plain thing)."""
    client, routes, ids = world
    crashes = []
    for path, methods in routes.items():
        for method in methods:
            if method == "get":
                continue
            bodies = [[], [1, 2], "text", 7, None, {}, dict(ids)]
            bodies += [{**ids, **{k: junk for k in BODY_KEYS}} for junk in JUNK_VALUES]
            bodies += [{**{k: junk for k in BODY_KEYS}} for junk in JUNK_VALUES[:8]]
            for body in bodies:
                r = send(client, method, V1 + path, body)
                if r.status_code >= 500:
                    crashes.append(f"{method.upper()} {path} {str(body)[:70]} → {r.status_code} {LAST_CRASH}")
    assert not crashes, "\n".join(crashes[:400])


# Its own transactions, as a real request has: inside the usual one-transaction
# test, one crash would make every later request crash too.
@pytest.mark.django_db(transaction=True)
def test_no_junk_query_crashes_any_route(world):
    """Every read route with each junk value in each query key it might read."""
    client, routes, _ids = world
    crashes = []
    for path, methods in routes.items():
        if "get" not in methods:
            continue
        for key in QUERY_KEYS:
            for junk in JUNK_QUERY:
                r = client.get(V1 + path, {key: junk})
                if r.status_code >= 500:
                    crashes.append(f"GET {path}?{key}={junk[:30]} → {r.status_code} {LAST_CRASH}")
    assert not crashes, "\n".join(crashes[:400])


# ── who may do what: every role, every route ─────────────────────────────────

#: Routes only the owner or an admin may write.
OWNER_ONLY = ("library/shifts", "library/seats", "library/expenses", "library/settings")
#: Owner, 13 Nov 2026: staff add borrowers and give loans too. Routes, closing a
#: loan and settings stay with the owner and admins.
STAFF_MAY_NOT_WRITE_LENDING = ("lending/routes", "/close", "lending/settings")


def may_write(role: str, path: str) -> bool:
    if path.startswith("moneybook/"):
        return True  # everybody's own private book
    if role in ("owner", "admin"):
        return True
    if role == "accountant":
        return False
    if path.startswith("lending/"):
        return not any(part in path for part in STAFF_MAY_NOT_WRITE_LENDING)
    return not any(path.startswith(p) for p in OWNER_ONLY)


@pytest.mark.parametrize("role", ["owner", "admin", "staff", "accountant"])
def test_each_role_reaches_exactly_what_it_should(world, api_as, role):
    """A team member signed in as each role: every read answers, every write is
    allowed or refused (403) exactly as the role table says. A refused write that
    goes through is a cashier closing loans; an allowed one refused is a counter
    that cannot take a fee."""
    owner, routes, _ids = world
    client, _member = api_as(owner.tenant, role=role)
    client.raise_request_exception = False
    wrong = []
    for path, methods in routes.items():
        if path.startswith(("moneybook/people/", "moneybook/entries/")):
            continue  # the owner's rows: not this member's book (checked below)
        for method in methods:
            r = send(client, method, V1 + path, {} if method != "get" else None)
            allowed = True if method == "get" else may_write(role, path)
            refused = r.status_code == 403
            if r.status_code >= 500 or refused == allowed:
                wrong.append(f"{role} {method.upper()} {path} → {r.status_code} (should be {'allowed' if allowed else '403'})")
    assert not wrong, "\n".join(wrong)


@pytest.mark.parametrize("role", ["admin", "staff", "accountant"])
def test_a_team_member_never_sees_the_owners_money_book(world, api_as, role):
    """The Money Book is the signed-in person's own: a team member of the same
    business gets an empty book and 404 for every id in the owner's."""
    owner, _routes, _ids = world
    client, _member = api_as(owner.tenant, role=role)
    client.raise_request_exception = False
    ids = owner.record_ids
    assert client.get(V1 + "moneybook/people").json()["data"] == []
    assert client.get(V1 + "moneybook/report").json()["data"] == []
    assert client.get(V1 + "moneybook/old-dues?days=1").json()["data"] == []
    person, entry = ids["person_id"], ids["entry"]
    for method, path in (
        ("get", f"moneybook/people/{person}"), ("patch", f"moneybook/people/{person}"),
        ("get", f"moneybook/people/{person}/entries"), ("post", f"moneybook/people/{person}/entries"),
        ("post", f"moneybook/people/{person}/archive"), ("post", f"moneybook/entries/{entry}/remove"),
        ("post", f"moneybook/entries/{entry}/replace"), ("get", f"moneybook/report?person={person}"),
        ("get", f"moneybook/reminders/text?person={person}"),
    ):
        body = {"kind": "got", "amount": "1", "name": "x", "reason": "x"} if method != "get" else None
        r = send(client, method, V1 + path, body)
        assert r.status_code == 404, (role, method, path, r.status_code)
    assert owner.get(V1 + f"moneybook/people/{person}").json()["data"]["balance"] == "3500.00"


def test_another_business_reaches_no_record_by_its_id(world, other_tenant, api_as):
    """The owner of a second business, running the same apps, pasting every id
    of the first into every route: 404 each time, and nothing moved."""
    owner, routes, ids = world
    entitle(other_tenant, "lending", "library")
    seed_library(None, other_tenant)
    stranger, _m = api_as(other_tenant)
    stranger.raise_request_exception = False
    leaks = []
    for path, methods in routes.items():
        has_id = any(len(part) == 36 and part.count("-") == 4 for part in path.split("?")[0].split("/"))
        if not has_id or path.startswith("moneybook/"):
            continue
        for method in methods:
            body = {"amount": "100", "mode": "cash", "name": "x", "reason": "mistake", "seat": 5, "note": "x",
                    "student_id": ids["student_id"], "shift_id": ids["shift_id"]} if method != "get" else None
            r = send(stranger, method, V1 + path, body)
            if r.status_code != 404:
                leaks.append(f"{method.upper()} {path} → {r.status_code}")
    assert not leaks, "\n".join(leaks)
    for path in ("lending/loans", "lending/borrowers", "lending/messages", "library/students", "library/books",
                 "library/expenses"):
        assert stranger.get(V1 + path).json()["data"] in ([], {}), path
    # A stranger's own record made from the first business's ids is refused too.
    for path, body in (
        ("lending/borrowers", {"name": "X", "route_id": ids["route_id"]}),
        ("lending/loans", {"borrower_id": ids["borrower_id"], "lent": "100", "frequency": "daily", "count": 1, "each": "100"}),
        ("lending/messages", {"loan_id": ids["loan_id"], "kind": "late", "text": "x"}),
        ("library/students", {"name": "X", "seat": 1, "shift_id": ids["shift_id"]}),
        ("library/messages", {"student_id": ids["student_id"], "kind": "fee_due", "text": "x"}),
        ("library/attendance", {"student_id": ids["student_id"]}),
    ):
        r = send(stranger, "post", V1 + path, body)
        assert r.status_code in (400, 404, 409, 422), (path, r.status_code, r.content[:200])
    assert owner.get(V1 + f"lending/loans/{ids['loan_id']}").status_code == 200


def test_an_app_that_is_switched_off_answers_nobody(world):
    """Lending and Library off: every route of both refuses even the owner, and
    the Money Book (no business switch) still answers."""
    owner, routes, _ids = world
    tenant = owner.tenant
    tenant.enabled_modules = [m for m in tenant.enabled_modules if m not in ("lending", "library")]
    tenant.save(update_fields=["enabled_modules"])
    for path, methods in routes.items():
        for method in methods:
            r = send(owner, method, V1 + path, {} if method != "get" else None)
            if path.startswith("moneybook/"):
                assert r.status_code != 403, (method, path)
            else:
                assert r.status_code in (403, 404), (method, path, r.status_code)



# ── states a record must not be pushed into (QA audit, 12 Nov 2026) ─────────


def test_a_closed_loan_cannot_be_closed_again_or_marked_not_paid(world):
    """Prevents: closing a loan twice overwrote the day and the reason it was
    closed for, and "not paid today" could be written on a loan nobody owes on."""
    client, _routes, ids = world
    loan = ids["loan_id"]
    first = send(client, "post", f"{V1}lending/loans/{loan}/close", {"reason": "written_off"})
    assert first.status_code == 200, first.content
    again = send(client, "post", f"{V1}lending/loans/{loan}/close", {"reason": "written_off"})
    assert again.status_code == 409, again.content
    assert again.json()["error"]["code"] == "loan_closed"
    late = send(client, "post", f"{V1}lending/loans/{loan}/not-paid", {"reason": "shop shut"})
    assert late.status_code == 409, late.content


def test_skip_sundays_false_sent_as_text_is_still_false(world):
    """Prevents: `bool("false")` is True, so a form that sends the switch as text
    got a schedule that skips Sundays the lender asked to collect on."""
    client, _routes, ids = world
    body = {"borrower_id": ids["borrower_id"], "lent": "7000", "frequency": "daily", "count": 14, "each": "500",
            "starts_on": "2026-11-02", "skip_sundays": "false"}
    r = send(client, "post", f"{V1}lending/loans?preview=true", body)
    assert r.status_code == 200, r.content
    days = [d["due_on"] for d in r.json()["data"]["schedule"]]
    assert "2026-11-08" in days, days  # a Sunday


def test_a_person_put_away_keeps_a_zero_balance(world):
    """Prevents: removing or correcting an old entry of a person who was put away
    moved their balance off ₹0 while they stayed hidden from the book."""
    client, _routes, ids = world
    person, entry = ids["person_id"], client.record_ids["entry"]
    made(client, f"moneybook/people/{person}/entries", {"kind": "got", "amount": "3500"})
    assert send(client, "post", f"{V1}moneybook/people/{person}/archive", {}).status_code == 200
    gone = send(client, "post", f"{V1}moneybook/entries/{entry}/remove", {"reason": "typo"})
    assert gone.status_code == 409, gone.content
    fixed = send(client, "post", f"{V1}moneybook/entries/{entry}/replace", {"kind": "gave", "amount": "3000"})
    assert fixed.status_code == 409, fixed.content
    assert send(client, "get", f"{V1}moneybook/people/{person}").json()["data"]["balance"] in ("0.00", "0")


def test_a_student_who_left_cannot_be_put_on_hold_and_a_hold_ends_later(world):
    """Prevents: "hold" on a student who had left brought them back as a held
    student with no seat, and a hold could end on a day already gone."""
    client, _routes, ids = world
    student = ids["student_id"]
    past = send(client, "post", f"{V1}library/students/{student}/hold", {"hold_until": "2020-01-01"})
    assert past.status_code == 400, past.content
    assert send(client, "post", f"{V1}library/students/{student}/leave", {}).status_code == 200
    held = send(client, "post", f"{V1}library/students/{student}/hold", {})
    assert held.status_code == 409, held.content
    assert send(client, "get", f"{V1}library/students/{student}").json()["data"]["status"] == "left"


def test_two_students_cannot_be_edited_onto_one_mobile(world):
    """Prevents: enrolling refuses a mobile another student has, but editing a
    student accepted it, so one number reached two fee reminders."""
    client, _routes, ids = world
    first = made(client, "library/students", {"name": "Asha Pawar", "mobile": "9822000011", "shift_id": ids["shift_id"], "monthly_fee": "800"})
    assert first["id"]
    r = send(client, "patch", f"{V1}library/students/{ids['student_id']}", {"mobile": "9822000011"})
    assert r.status_code == 409, r.content



def _reads(client):
    return {p: client.get(V1 + p).status_code for p in ("lending/today", "lending/loans", "library/home", "library/students")}


def _signed_in_again(member):
    """The member signs in afresh: a new token for the membership as it is now."""
    from rest_framework.test import APIClient

    from tests.fixtures import build_access_token

    member.refresh_from_db()
    client = APIClient()
    client.raise_request_exception = False
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {build_access_token(member)}")
    return client


def test_a_blocked_member_is_shut_out_at_once_and_signing_in_again_does_not_help(world, api_as):
    """The owner blocks a cashier who is still signed in. The session the cashier
    already holds must stop on the very next request, in every app, and a fresh
    sign-in must be refused too — a block that waits for the next sign-in leaves
    the till open to the person just sent home. Unblocked, they sign in and work."""
    owner, _routes, _ids = world
    client, member = api_as(owner.tenant, role="staff")
    client.raise_request_exception = False
    assert set(_reads(client).values()) == {200}
    r = owner.post(V1 + f"members/{member.pk}/block", {}, format="json", HTTP_IDEMPOTENCY_KEY="audit-block-1")
    assert r.status_code == 200, r.content
    take = f"lending/loans/{owner.record_ids['loan_id']}/collections"
    for who in (client, _signed_in_again(member)):
        shut = _reads(who)
        assert all(code in (401, 403) for code in shut.values()), shut
        took = who.post(V1 + take, {"amount": "500", "mode": "cash"}, format="json")
        assert took.status_code in (401, 403), took.content
    r = owner.post(V1 + f"members/{member.pk}/unblock", {}, format="json", HTTP_IDEMPOTENCY_KEY="audit-unblock-1")
    assert r.status_code == 200, r.content
    assert set(_reads(_signed_in_again(member)).values()) == {200}


def test_a_member_given_one_app_reaches_only_that_app(world, api_as):
    """The owner puts a member in the Library only. The open session ends; signed
    in again, Lending answers 403 for reads and writes alike while the Library
    still works, and an empty list takes both away. Without this a library
    attendant reads every borrower's loan."""
    owner, _routes, _ids = world
    client, member = api_as(owner.tenant, role="staff")
    client.raise_request_exception = False
    put = owner.put(V1 + f"members/{member.pk}/apps", {"grants": [{"app": "library", "role": "staff"}]}, format="json")
    assert put.status_code == 200, put.content
    assert all(code in (401, 403) for code in (_reads(client)["lending/today"], _reads(client)["lending/loans"]))
    again = _signed_in_again(member)
    got = _reads(again)
    assert got["library/home"] == 200 and got["library/students"] == 200, got
    assert got["lending/today"] == 403 and got["lending/loans"] == 403, got
    took = again.post(V1 + f"lending/loans/{owner.record_ids['loan_id']}/collections", {"amount": "500", "mode": "cash"}, format="json")
    assert took.status_code == 403, took.content
    assert owner.put(V1 + f"members/{member.pk}/apps", {"grants": []}, format="json").status_code == 200
    assert set(_reads(_signed_in_again(member)).values()) == {403}


def test_a_role_changed_by_the_owner_takes_effect_before_the_next_write(world, api_as):
    """Staff may take a library fee; an accountant only reads. When the owner
    changes a signed-in member from staff to accountant, the next fee is refused
    on the open session and on a fresh one, which can still read."""
    owner, _routes, _ids = world
    client, member = api_as(owner.tenant, role="staff")
    client.raise_request_exception = False
    fee = f"library/students/{owner.record_ids['student_id']}/payments"
    assert client.post(V1 + fee, {"amount": "800", "mode": "cash"}, format="json").status_code in (200, 201)
    r = owner.patch(V1 + f"members/{member.pk}", {"role": "accountant"}, format="json")
    assert r.status_code == 200, r.content
    assert client.post(V1 + fee, {"amount": "800", "mode": "cash"}, format="json").status_code in (401, 403)
    again = _signed_in_again(member)
    assert again.post(V1 + fee, {"amount": "800", "mode": "cash"}, format="json").status_code == 403
    assert again.get(V1 + "library/students").status_code == 200
