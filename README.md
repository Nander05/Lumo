# Lumo (eigen webapp)

Lumo als gewone webapp: iedereen krijgt een link en een eigen inlog, zonder Claude-account. Installeerbaar op het beginscherm van een telefoon (PWA). Elk team is volledig gescheiden van andere teams, dus je kunt Lumo ook aan crossline-klanten geven.

## Wat zit erin

| Onderdeel | Doet |
|---|---|
| `index.html`, `app.js` | de app zelf (dezelfde als in Claude) |
| `backend.js` | inloggen, team aanmaken of deelnemen, opslag en AI via Supabase |
| `config.js` | **hier vul je twee gegevens in** |
| `supabase/schema.sql` | database met rechten per team |
| `supabase/functions/ai/` | server-functie voor de AI (jouw Claude-sleutel blijft op de server) |
| `seed/library.sql` | zet de 12 Young Living-teksten in de bibliotheek van je team |
| `privacy.html` | concept-privacyverklaring (invullen en laten nalezen) |

## Opzetten (ongeveer 45 minuten, eenmalig)

### 1. Supabase (inlog en database)
1. Maak een account op supabase.com en kies **New project**. Kies een regio in de EU (bijvoorbeeld Frankfurt) en bewaar het database-wachtwoord.
2. Open **SQL Editor > New query**, plak de inhoud van `supabase/schema.sql` en klik **Run**. Je mag dit bestand veilig opnieuw uitvoeren.
3. Ga naar **Project Settings > API** en noteer de **Project URL** en de **anon public** sleutel.
4. Ga naar **Authentication > Sign In / Providers > Email** en laat "Confirm email" aan staan (aanbevolen).
5. De ingebouwde mailservice van Supabase verstuurt maar weinig mails per uur. Voor echt gebruik: **Authentication > SMTP Settings** en vul de gegevens van een mailservice in (bijvoorbeeld Brevo).

### 2. De AI (Claude API)
1. Maak op console.anthropic.com een API-sleutel en zet daar een **maandelijks uitgavenlimiet** (bijvoorbeeld 50 euro).
2. Installeer de Supabase CLI (`npm install -g supabase`) en voer in deze map uit:
   ```
   supabase login
   supabase link --project-ref JOUW-PROJECT-REF
   supabase secrets set --env-file supabase/.env
   supabase functions deploy ai
   ```
   De sleutel staat in `supabase/.env` (staat in `.gitignore`, dus komt nooit op GitHub). Vervang daar de testsleutel door de echte. `AI_MONTHLY_LIMIT` is het aantal AI-aanvragen per lid per maand (standaard 400). Wil je een ander model, voeg `ANTHROPIC_MODEL=claude-haiku-5-5` toe aan `secrets set`. Standaard is dat `claude-sonnet-5-5`.

### 3. De app koppelen en online zetten
1. Open `config.js` en vul `supabaseUrl` en `supabaseAnonKey` in. De anon-sleutel mag publiek zijn: de beveiliging zit in de database.
2. Zet de hele map online op een gewone hostingdienst voor statische bestanden: Cloudflare Pages, Netlify (map slepen) of GitHub Pages. Er is geen server nodig.
3. Ga terug naar Supabase > **Authentication > URL Configuration**. Zet bij **Site URL** het adres van je app en voeg datzelfde adres toe onder **Redirect URLs**.

### 4. Eerste gebruik
1. Open je app, kies **Account maken** en daarna **Jouw team maken**. Jij wordt beheerder.
2. Ga naar **Instellingen > Team en account**. Daar staat de **uitnodigingslink**. Wie die opent, maakt een account en zit direct in je team.
3. Wil je de Young Living-teksten in de bibliotheek? Open `seed/library.sql`, controleer dat de teamnaam bovenaan klopt, plak het in de SQL Editor en klik **Run**.
4. Zet eerst een privacyverklaring klaar (`privacy.html`), voordat anderen een account maken.

## AI en meldingen zetten (zonder terminal)

Dit kan volledig in het Supabase-dashboard, zonder CLI.

### De AI-functie
1. Ga naar **Edge Functions > Deploy a new function > Via Editor**. Noem hem exact `ai`.
2. Plak de inhoud van `supabase/dashboard/ai.ts` en klik **Deploy**.
3. Open de functie, ga naar **Details** en zet **Verify JWT** uit (de functie controleert de gebruiker zelf).
4. Ga naar **Edge Functions > Secrets** (of **Project Settings > Edge Functions**) en voeg toe: `ANTHROPIC_API_KEY` (je Anthropic-sleutel) en eventueel `AI_MONTHLY_LIMIT` (bijvoorbeeld 300).

### Pushmeldingen
1. SQL Editor: voer `supabase/push.sql` uit.
2. Edge Functions: maak op dezelfde manier een functie `push` met de inhoud van `supabase/dashboard/push.ts`, en zet **Verify JWT** uit.
3. Voeg bij Secrets toe: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` en `PUSH_CRON_SECRET`. De waarden staan in `supabase/.env` op je eigen computer (niet in GitHub). De publieke sleutel staat al in `config.js`.
4. SQL Editor: voer `supabase/cron.local.sql` uit. Dat is `cron.sql` met jouw geheim erin. Daarmee roept Supabase elk uur de functie aan.
5. In Lumo: **Instellingen > Meldingen > Meldingen aanzetten**, en kies **Stuur testmelding**.

Meldingen komen elke ochtend op de gekozen tijd, alleen als er iemand is om op te volgen of iemand jarig is. Op een iPhone moet Lumo eerst op het beginscherm staan.

## Hoe het werkt
- **Teams:** wie een team maakt, is daar beheerder. Daarna kan die leden uitnodigen, beheerders benoemen en leden verwijderen. Een nieuwe klant maakt gewoon een eigen team aan. Binnen de app zien teams elkaar nooit en is er geen supergebruiker. Let op: als eigenaar van het Supabase-project kun jij technisch wel bij alle gegevens in de database. Zeg dat eerlijk in je privacyverklaring en gebruik dat nooit voor iets anders dan onderhoud.
- **Wie ziet wat:** privé-gegevens (profiel, contacten, cijfers) ziet alleen het lid zelf, ook de beheerder niet. Bibliotheek, campagnes en dergelijke beheert de beheerder. Wat een lid "deelt met upline" ziet alleen de beheerder.
- **AI:** de browser praat nooit rechtstreeks met Claude. Alles loopt via jouw server-functie, die controleert of iemand is ingelogd en lid is, het gebruik per lid telt en de sleutel beheert.
- **Account verwijderen:** elk lid kan zichzelf en alle eigen gegevens verwijderen (Instellingen > Team en account).

## Kosten (schatting)
- Supabase: gratis om te testen (pauzeert na een week zonder gebruik), ongeveer 25 dollar per maand voor echt gebruik.
- Hosting: gratis bij Cloudflare Pages, Netlify of GitHub Pages.
- AI: per gebruik. Met 20 actieve leden ongeveer 15 tot 60 euro per maand, afhankelijk van het model en het gebruik. Met `AI_MONTHLY_LIMIT` en het uitgavenlimiet bij Anthropic kan het nooit uit de hand lopen.

## Wat er nog niet in zit
- De koppeling met het Virtual Office (die blijven "voorbeeld"; plakken en CSV werken wel).
- Mailen van uitnodigingen vanuit de app (je deelt de link zelf).
- Betalen of abonnementen voor crossline-klanten.
- Een versie in de App Store en Play Store (de PWA is installeerbaar zonder store).

## Updaten
Vervang `app.js` (en eventueel de andere bestanden), verhoog `version` in `config.js` en zet de map opnieuw online. Gebruikers krijgen de nieuwe versie bij de volgende keer openen.

## Privacy en juridisch
Dit pakket is techniek en geen juridisch advies. Zodra anderen hun gegevens invullen (en zeker namen van derden), ben jij verwerkingsverantwoordelijk. Denk aan: een privacyverklaring, een verwerkersovereenkomst met Supabase en Anthropic (beide bieden een standaardversie), en afspraken met leden over wat ze over anderen opslaan.
