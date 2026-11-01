'use client';

import { useCallback, useId, useState } from 'react';

import { useForm } from 'react-hook-form';

import { UbButton, UbDialog, UbForm } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import type { ApiErrorShape } from 'src/types/api.types';
import { applyServerErrors } from 'src/utils/applyServerErrors';

import { addTag, EMPTY_TAG, TAG_FIELD, type Tag } from '../api/tagService';

import { ItemTagFields, type TagFormHost } from './ItemTagFields';

/**
 * G2a — another piece of an item already in the shop (a second identical
 * chain): the same "Tag details" as the Add item form, opened from the item
 * page's "Weight and rate" tab. One piece goes into stock with it.
 */
export function AddTagDialog({
  itemId,
  onClose,
  onAdded,
}: Readonly<{
  itemId: string;
  onClose: () => void;
  onAdded: (tag: Tag) => void;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const formId = useId();
  const [errors, setErrors] = useState<readonly string[]>([]);
  const form = useForm<TagFormHost>({
    defaultValues: { tag: { ...EMPTY_TAG }, tracking: 'serial' },
  });
  const submit = useCallback(
    async (values: TagFormHost) => {
      try {
        onAdded(await addTag(itemId, values.tag));
      } catch (thrown) {
        const error = thrown as ApiErrorShape;
        const details = Object.fromEntries(
          Object.entries((error.details ?? {}) as Record<string, unknown>)
            .filter(([key]) => key in TAG_FIELD)
            .map(([key, value]) => [`tag.${TAG_FIELD[key]}`, value])
        );
        setErrors(
          applyServerErrors(
            { ...error, details },
            form.setError,
            // The helper anchors by a field's root, so the nested tag is `tag`.
            ['tag'],
            t
          )
        );
      }
    },
    [itemId, onAdded, form.setError, t]
  );
  return (
    <UbDialog
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={t('items.tags.add')}
      closeLabel={t('common.action.close')}
    >
      <UbForm id={formId} form={form} onSubmit={submit} formErrors={errors}>
        <ItemTagFields />
        <UbButton
          type="submit"
          form={formId}
          busy={form.formState.isSubmitting}
          busyLabel={t('items.tags.adding')}
          data-testid="tag-add-save"
        >
          {t('items.tags.add')}
        </UbButton>
      </UbForm>
    </UbDialog>
  );
}
