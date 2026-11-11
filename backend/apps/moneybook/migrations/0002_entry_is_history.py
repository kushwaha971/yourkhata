"""A Money Book entry is history: never deleted, and only its status may change.

The same rule the old book had (ledger 0002), enforced by the database so no
code path — a bug, a shell, a future feature — can quietly rewrite what was
given or got. A mistake is undone by a removal row (`services.remove_entry`).
"""

from django.db import migrations

FORBID = """
CREATE OR REPLACE FUNCTION moneybook_entry_is_history() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Money Book entries are never deleted; remove the entry instead'
            USING ERRCODE = 'restrict_violation';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
       OR NEW.person_id IS DISTINCT FROM OLD.person_id
       OR NEW.kind IS DISTINCT FROM OLD.kind
       OR NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.note IS DISTINCT FROM OLD.note
       OR NEW.entry_date IS DISTINCT FROM OLD.entry_date
       OR NEW.removes_id IS DISTINCT FROM OLD.removes_id
       OR NEW.replaces_id IS DISTINCT FROM OLD.replaces_id
       OR NEW.reason IS DISTINCT FROM OLD.reason
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.sort_at IS DISTINCT FROM OLD.sort_at
    THEN
        RAISE EXCEPTION 'A Money Book entry is history: only its status may change'
            USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER moneybook_entry_is_history
BEFORE UPDATE OR DELETE ON moneybook_entry
FOR EACH ROW EXECUTE FUNCTION moneybook_entry_is_history();
"""

UNDO = """
DROP TRIGGER IF EXISTS moneybook_entry_is_history ON moneybook_entry;
DROP FUNCTION IF EXISTS moneybook_entry_is_history();
"""


class Migration(migrations.Migration):
    dependencies = [("moneybook", "0001_initial")]
    operations = [migrations.RunSQL(FORBID, UNDO)]
