"""A fee payment is history: never deleted, and only its status may change.

The rule the Money Book's entries have (moneybook 0002), enforced by the
database so no code path can quietly rewrite what a student paid. A mistake is
undone by a removal row (`services.remove_payment`).
"""

from django.db import migrations

FORBID = """
CREATE OR REPLACE FUNCTION library_payment_is_history() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Library payments are never deleted; remove the payment instead'
            USING ERRCODE = 'restrict_violation';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.student_id IS DISTINCT FROM OLD.student_id
       OR NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.mode IS DISTINCT FROM OLD.mode
       OR NEW.paid_on IS DISTINCT FROM OLD.paid_on
       OR NEW.months IS DISTINCT FROM OLD.months
       OR NEW.from_date IS DISTINCT FROM OLD.from_date
       OR NEW.to_date IS DISTINCT FROM OLD.to_date
       OR NEW.paid_to_before IS DISTINCT FROM OLD.paid_to_before
       OR NEW.credit_before IS DISTINCT FROM OLD.credit_before
       OR NEW.removes_id IS DISTINCT FROM OLD.removes_id
       OR NEW.reason IS DISTINCT FROM OLD.reason
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
        RAISE EXCEPTION 'A library payment is history: only its status may change'
            USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER library_payment_is_history
BEFORE UPDATE OR DELETE ON library_payment
FOR EACH ROW EXECUTE FUNCTION library_payment_is_history();
"""

UNDO = """
DROP TRIGGER IF EXISTS library_payment_is_history ON library_payment;
DROP FUNCTION IF EXISTS library_payment_is_history();
"""


class Migration(migrations.Migration):
    dependencies = [("library", "0001_rebuild")]
    operations = [migrations.RunSQL(FORBID, UNDO)]
