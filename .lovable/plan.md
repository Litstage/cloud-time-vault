## Problem
Dialogen "Redigera användare" har blivit så hög (många fält för lön/OB/skatt) att den sträcker sig utanför skärmen — knapparna Avbryt/Spara och de nedre fälten hamnar bakom kanten och går inte att nå på små/mellanstora skärmar.

Samma sak kan hända i dialogen "Kopiera / flytta tider" och "Redigera tid" när listan är lång.

## Lösning
Gör alla tre `DialogContent` scrollbara internt så att bara innehållet scrollar medan header/footer hålls kvar synliga.

I `src/routes/_authenticated/admin.tsx`:

1. **Redigera användare** (rad 989):
   - `DialogContent` → `className="sm:max-w-lg max-h-[90vh] flex flex-col p-0"`
   - Slå in fältsektionen (rad 993–1072) i en scroll-container: `<div className="flex-1 overflow-y-auto px-6 py-4">…</div>`
   - Wrappa `DialogHeader` i `className="px-6 pt-6"` och `DialogFooter` i `className="px-6 pb-6 pt-2 border-t"` så de sitter kvar.

2. **Kopiera / flytta tider** (rad 877): samma mönster — `max-h-[90vh] flex flex-col p-0` + scrollbar mittdel.

3. **EntryDialog** (rad 1332): lägg till `max-h-[90vh] flex flex-col p-0` och scrollbar innerdel så även den fungerar på låga fönster.

Inga logik- eller datamodelländringar — enbart layout.
