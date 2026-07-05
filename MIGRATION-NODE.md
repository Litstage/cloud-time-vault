# Migration: Cloudflare Workers → Node.js / Vite

Den här guiden beskriver hur du flyttar projektet från Lovables Cloudflare
Worker-bundle till en helt vanlig Node.js-server (t.ex. VPS, Docker, PM2,
systemd) efter att du har synkat koden till GitHub och klonat ut den till
din egen miljö.

> **Kör INTE dessa ändringar inne i Lovable.** Preseten som Lovable använder
> är hårdkodad mot Cloudflare — om du river ut den slutar preview och
> Lovable Cloud-integrationen att fungera, och nästa preset-uppdatering
> skriver över dina ändringar. Gör allt nedan i ditt eget repo.

---

## 1. Byt ut `vite.config.ts`

Ersätt hela filen:

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import path from "node:path";

export default defineConfig({
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({
      target: "node-server",       // <-- Node istället för Cloudflare
      customViteReactPlugin: true,
    }),
    viteReact(),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: { port: 8080 },
});
```

## 2. Uppdatera `package.json`

Ta bort:

- `@lovable.dev/vite-tanstack-config`

Lägg till som `devDependencies` (om de inte redan finns transitivt):

- `@tanstack/react-start`
- `@vitejs/plugin-react`
- `@tailwindcss/vite`
- `vite-tsconfig-paths`
- `vite`

Uppdatera scripts:

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "start": "node .output/server/index.mjs"
  }
}
```

Kör sedan:

```bash
npm install
```

## 3. Ta bort Cloudflare-specifik SSR-entry

Filen `src/server.ts` är en wrapper runt Cloudflares
`@tanstack/react-start/server-entry` (som är Worker-formad). Med
`target: "node-server"` genererar Nitro en Node-server åt dig automatiskt.

**Ta bort:**

- `src/server.ts`
- `src/lib/error-capture.ts` (används bara av `server.ts`; behåll om annan
  kod importerar den)
- `src/lib/error-page.ts` (samma sak)

Verifiera med `grep` att inget annat importerar dem innan du raderar.

## 4. Skapa `.env`

Skapa `.env` i repo-roten och lägg till den i `.gitignore`:

```env
# Klient (exponeras i browser-bundlen via Vite)
VITE_SUPABASE_URL=https://<ditt-projekt>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<din anon/publishable key>
VITE_SUPABASE_PROJECT_ID=<ditt project-ref>

# Server (läses via process.env i serverfunktioner)
SUPABASE_URL=https://<ditt-projekt>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<din anon/publishable key>
SUPABASE_PROJECT_ID=<ditt project-ref>

# Endast server — får ALDRIG committas eller exponeras i klienten
SUPABASE_SERVICE_ROLE_KEY=<din service role key från Supabase-dashboard>

# Om du använder Lovable AI Gateway (annars ta bort)
LOVABLE_API_KEY=<din nyckel>
```

### Viktigt om namngivning

- Koden i `src/integrations/supabase/*` läser redan
  `import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL` och
  motsvarande för nyckeln, så du **behöver inte ändra klientkoden**.
- Variabeln heter `SUPABASE_PUBLISHABLE_KEY` (inte `SUPABASE_ANON_KEY`) i
  det här projektet. Nya Supabase-nycklar med prefix `sb_publishable_...`
  och `sb_secret_...` hanteras redan av wrapper-funktionen
  `createSupabaseFetch` — ingen kodändring behövs.
- `VITE_*`-variabler bakas in i klientbundlen vid build. Byter du dem måste
  du bygga om.

### I produktion

Läs INTE `.env`-filen i produktion. Exportera variablerna från miljön
(systemd `Environment=`, Docker `-e` / `env_file:`, PM2 `env:`, etc.).
Använd `.env` bara för lokal utveckling.

## 5. Bygg och kör

```bash
npm run build      # skapar .output/server/index.mjs (Nitro node preset)
npm run start      # startar Node-servern på port 3000
```

Portmapping styrs av Nitro. Sätt `PORT=8080 npm run start` för annan port.

### Bakom en reverse proxy (nginx-exempel)

```nginx
server {
  listen 443 ssl http2;
  server_name tider.exempel.se;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

### Docker (minimalt exempel)

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/.output ./.output
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

## 6. Databas & auth

Din Supabase-databas är oförändrad — den ligger fortfarande hos Supabase
och nås över HTTPS. Ingen migration behövs på databassidan. Om du samtidigt
bytte till en egen Supabase-instans: kör `database-schema.sql`,
`database-auth-users.sql` och `database-data.sql` i den nya instansen
(i den ordningen).

## 7. Sådant som INTE följer med

Följande Lovable-specifika funktioner slutar fungera när du hostar själv:

- Preview-URLs (`*.lovable.app`)
- Lovable Cloud-hanterade secrets (`LOVABLE_API_KEY` etc.) — lägg dem i
  din egen `.env`
- Auto-deploy från Lovable
- Edge-runtime-specifika optimeringar

Följande fortsätter fungera:

- All applikationskod (routes, komponenter, serverfunktioner)
- Supabase auth, RLS, database, storage
- TanStack Start server functions och server routes

## 8. Verifiera efter migration

- [ ] `npm run build` går igenom utan fel
- [ ] `npm run start` startar servern
- [ ] `/` renderas
- [ ] Login via `/auth` fungerar
- [ ] Skyddade routes under `/_authenticated/*` kräver login
- [ ] En serverfunktion (t.ex. admin-koll) svarar korrekt
- [ ] Inga `process.env`-relaterade fel i serverloggarna