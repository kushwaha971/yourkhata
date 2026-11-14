/** Actual hit testing: a toast can cover readable, high-contrast dialog text. */
export const coveredOverlayText = async (surface) => surface.evaluate((dialog) => {
            const blocked = [];
            const walker = document.createTreeWalker(dialog, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {
              if (
                !node.textContent?.trim() ||
                node.parentElement?.closest('.sr-only,[aria-hidden="true"]')
              )
                continue;
              const range = document.createRange();
              range.selectNodeContents(node);
              for (const rect of range.getClientRects()) {
                if (rect.width < 2 || rect.height < 2) continue;
                const y = rect.top + rect.height / 2;
                for (const x of [rect.left + 2, rect.left + rect.width / 2, rect.right - 2]) {
                  if (x < 0 || x >= innerWidth || y < 0 || y >= innerHeight) continue;
                  const top = document.elementFromPoint(x, y);
                  if (top && !dialog.contains(top))
                    blocked.push(node.textContent.trim().slice(0, 90));
                }
              }
            }
            return [...new Set(blocked)];
          });
