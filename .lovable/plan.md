# Plan: Förenkla användarkolumnen i adminlistan

## Vad vi ska bygga
I tabellen "Alla tider" på admin-sidan ska användarkolumnen visa **bara förnamnet** i stället för nuvarande kombination av fullständigt namn + mejl.

## Ändringar

### 1. Ny hjälpfunktion för förnamn
I `src/routes/_authenticated/admin.tsx` lägger vi till en liten funktion bredvid befintliga `displayName` / `hasName`:

```text
function firstName(u: NameLike): string {
  return u.first_name ?? u.user_first_name ?? "";
}
```

Befintliga `displayName` och `hasName` behålls oförändrade eftersom de används på andra ställen (t.ex. användarlistan och dialoger).

### 2. Uppdatera användarcellen i tidtabellen
Rad 776–786 ändras så att:

- Endast förnamnet visas (`firstName(r)`).
- Efternamn och mejlrad tas bort helt.
- "Namn saknas"-märket behålls när inget förnamn finns, så det fortfarande går att se att användaren saknar registrerat namn.

Resultatet blir ungefär:

```text
<td className="px-3 py-2 max-w-[12rem]">
  <div className="truncate font-medium">{firstName(r) || (r.user_email ?? "")}</div>
  {!firstName(r) && (
    <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
      Namn saknas
    </span>
  )}
</td>
```

Fallback till mejl används bara om förnamn helt saknas, så raden inte blir tom.

### 3. Kolumnrubrik
Rubriken "Användare" behålls som den är.

## Tekniska detaljer
- Fil som ändras: `src/routes/_authenticated/admin.tsx`.
- Inga nya beroenden.
- Inga ändringar i backend, databas eller andra sidor.
- Typecheck (`bunx tsc --noEmit`) körs efter ändringen.

## Verifiering
Efter implementationen kontrolleras att:
1. Tabellen fortfarande renderas utan fel.
2. Användarkolumnen visar endast förnamn.
3. "Namn saknas" visas fortfarande för användare utan namn.
4. Övriga kolumner (Datum, Start, Slut, Projekt, Beskrivning, Timmar, Åtgärder) påverkas inte.