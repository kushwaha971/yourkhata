"""A collection is history: never deleted, and only its status may change.

The rule the Library's payments and the Money Book's entries have. A mistake
is undone by a removal row (`services.remove_collection`).
"""

from django.db import migrations

FORBID = """
CREATE OR REPLACE FUNCTION lending_collection_is_history() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Collections are never deleted; remove the collection instead'
            USING ERRCODE = 'restrict_violation';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.loan_id IS DISTINCT FROM OLD.loan_id
       OR NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.mode IS DISTINCT FROM OLD.mode
       OR NEW.collected_on IS DISTINCT FROM OLD.collected_on
       OR NEW.removes_id IS DISTINCT FROM OLD.removes_id
       OR NEW.reason IS DISTINCT FROM OLD.reason
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
        RAISE EXCEPTION 'A collection is history: only its status may change'
            USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lending_collection_is_history
BEFORE UPDATE OR DELETE ON lending_collection
FOR EACH ROW EXECUTE FUNCTION lending_collection_is_history();

CREATE OR REPLACE FUNCTION lending_due_is_fixed() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'A loan''s schedule is written once and never changed'
        USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lending_due_is_fixed
BEFORE UPDATE OR DELETE ON lending_due
FOR EACH ROW EXECUTE FUNCTION lending_due_is_fixed();
"""

UNDO = """
DROP TRIGGER IF EXISTS lending_collection_is_history ON lending_collection;
DROP FUNCTION IF EXISTS lending_collection_is_history();
DROP TRIGGER IF EXISTS lending_due_is_fixed ON lending_due;
DROP FUNCTION IF EXISTS lending_due_is_fixed();
"""


class Migration(migrations.Migration):
    dependencies = [("lending", "0001_rebuild")]
    operations = [migrations.RunSQL(FORBID, UNDO)]
