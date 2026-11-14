'use client';

import { useCallback, useEffect, useState } from 'react';

import dynamic from 'next/dynamic';

import { UbButton, UbDialogLoading, UbPanel, UbStack, UbText } from 'src/design-system';
import { useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectActiveTenant } from 'src/redux/slice/sessionSlice';

import { listItemTags } from '../../inventory/api/tagService';

const AddTagDialog = dynamic(
  () => import('../../inventory/components/AddTagDialog').then((m) => m.AddTagDialog),
  { ssr: false, loading: () => <UbDialogLoading /> }
);

interface Piece {
  readonly itemId: string;
  readonly itemName: string;
  readonly tagNo: string;
}

/**
 * Design D6 on the purchase itself: the pieces this bill brought in that have
 * no weights yet, each one tap from its "Tag details". Uses the item page's own
 * dialog, and the server fills the bought piece rather than adding stock.
 */
export function BoughtPiecesPanel({
  lines,
}: Readonly<{
  lines: readonly { itemId: string | null; description: string; serials?: readonly string[] }[];
}>): React.JSX.Element | null {
  const { t } = useTranslation();
  const jeweller = Boolean(useAppSelector(selectActiveTenant)?.features?.includes('jewellery'));
  const [pieces, setPieces] = useState<readonly Piece[]>([]);
  const [open, setOpen] = useState<Piece | null>(null);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const held = jeweller ? lines.filter((l) => l.itemId && l.serials?.length) : [];
      const found = await Promise.all(
        held.map(async (line) => {
          const tags = await listItemTags(line.itemId as string, signal);
          return (line.serials ?? [])
            .filter((no) => tags.some((tag) => tag.tagNo === no && !tag.netG))
            .map((tagNo) => ({ itemId: line.itemId as string, itemName: line.description, tagNo }));
        })
      );
      return found.flat();
    },
    [jeweller, lines]
  );
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then(setPieces).catch(() => undefined);
    return () => controller.abort();
  }, [load]);
  if (!pieces.length) return null;
  return (
    <UbPanel aria-label={t('purchases.pieces.title')} data-testid="bought-pieces">
      <UbStack gap={2} className="p-4">
        <UbText as="h2" variant="body-medium" className="font-semibold">
          {t('purchases.pieces.title')}
        </UbText>
        {pieces.map((piece) => (
          <UbStack
            key={piece.tagNo}
            direction="row"
            justify="between"
            align="center"
            className="gap-3"
          >
            <UbText variant="body-sm" className="ds-num min-w-0 break-words">
              {`${piece.tagNo} · ${piece.itemName}`}
            </UbText>
            <UbButton size="sm" variant="secondary" onClick={() => setOpen(piece)}>
              {t('purchases.pieces.add')}
            </UbButton>
          </UbStack>
        ))}
      </UbStack>
      {open && (
        <AddTagDialog
          itemId={open.itemId}
          tagNo={open.tagNo}
          onClose={() => setOpen(null)}
          onAdded={() => {
            setOpen(null);
            void load().then(setPieces);
          }}
        />
      )}
    </UbPanel>
  );
}
