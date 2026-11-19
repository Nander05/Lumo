# Lumo: architectuur in het kort

## Onderdelen
- **App** (`index.html`, `app.js`, `sw.js`): een PWA zonder framework. `app.js` wordt gebouwd uit `src/parts/` (zie hieronder).
- **Opslag** (Supabase `docs`-tabel): elk gegeven is een JSON-blok met `team_id`, `path` en `id`. Per gebruiker is het pad `data/users/<user-id>`. Contacten hebben id `contact-...`, VO-gebeurtenissen `vobest-...`, instellingen en doelen een vaste naam (`profile`, `mgoal`, `commhist`, `commref`). Rechten staan in `supabase/schema.sql` (RLS met `my_team()` en `doc_can()`).
- **Virtual Office-koppeling**: een Chrome-extensie leest het Virtual Office van de gebruiker uit en stuurt het naar de edge function `vo-ingest`. Die schrijft de gegevens in `docs` (`yl`-veld en `hist` per maand, vanaf november 2026).
- **AI**: edge function `ai`; de sleutel staat alleen op de server, met een maandlimiet per lid (`ai_usage`).

## Schermen
Vandaag (maanddoel en Nu doen), Mensen (opzoeken), Coach (hulp en berichten, met compliance-check onder Meer), Groei (Commissie, trend en organisatie), plus Team, Campagnes en Instellingen.

## Plan-regels
Alle regels van het compensatieplan staan in `PLAN` bovenin `src/parts/org.js`. Bron: de YL-trainingen Comp Plan 1 tot 3 (EU). De omrekenkoers 1 PV = €0,88 is de officiële peg rate van YL. Controle: YL Insights van 19 nov 2026. Pas daar iets aan als het plan wijzigt, nergens anders.

## Bekende beperkingen
- Niet in de berekening: leiderschapsbonus, rangbonussen, generaties 2 tot 4, eigen 100 PV, afhoudingen.
- De extensie ziet geen rang of verjaardag van teamleden en geen eigen PV.
- De commissie is een schatting en nooit een belofte van inkomen.

## Verwante apps
Lumo, de Joy Team-app (Joy Command) en de app voor Nadia delen veel ideeën maar staan los van elkaar. Lumo is de enige met meerdere teams en een eigen inlog; verbeteringen daar zijn de maatstaf.

## Beveiliging
RLS staat aan op alle tabellen. De functies met `security definer` zijn alleen voor ingelogde gebruikers (`supabase/hardening-2026-11-19.sql`). Nog te doen in het Supabase-dashboard: "Leaked password protection" aanzetten (Authentication > Providers > Email).
