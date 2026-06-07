# Filip's CRM

Lokalny CRM z pipeline Kanban, integracją n8n i logowaniem hasłem.

## Uruchomienie

```bash
cd "/Users/filipborowski/Desktop/websites folder/crm"
npm run install:all
npm run dev
```

- **Frontend (dev):** http://localhost:5173  
- **API / webhook:** http://localhost:3847  

Hasło domyślne: `Neo2552` (zmień w `.env` → `LOGIN_PASSWORD`).

## Produkcja — Netlify

**Domena:** https://filipscrm.netlify.app

1. Połącz repozytorium z Netlify (Build command i publish są w `netlify.toml`).
2. W **Site settings → Environment variables** dodaj:
   - `LOGIN_PASSWORD` — hasło do panelu
   - `JWT_SECRET` — losowy ciąg
   - `WEBHOOK_SECRET` — opcjonalnie, ten sam w n8n jako nagłówek `x-webhook-secret`
3. Wdróż. API działa jako Netlify Function; dane w **Netlify Blobs**.

W zakładce **API** kliknij **Ustaw URL Netlify** — webhooki będą wskazywać na `filipscrm.netlify.app`.

## Produkcja lokalna (opcjonalnie)

```bash
npm run build
NODE_ENV=production npm start
```

Aplikacja: http://localhost:3847. Dane w `data/crm.db` (SQLite).

## Webhook n8n

W scenariuszu n8n dodaj węzeł **HTTP Request**:

- **Method:** POST  
- **Test (ping):** `GET/POST https://filipscrm.netlify.app/api/webhook/test`  
- **URL leadów:** `https://filipscrm.netlify.app/api/webhook/leads`  
- **URL zadań:** `https://filipscrm.netlify.app/api/webhook/tasks`  
- **Body:** JSON — jeden obiekt lub tablica obiektów (tylko leady)  

Obsługiwane pola (wielkość liter jak w eksporcie):

| Pole n8n        | W CRM          |
|-----------------|----------------|
| Company_Name    | company_name   |
| Maps_url        | maps_url       |
| Phone           | phone          |
| Adress / Address| address        |
| Website         | website        |
| Rating          | rating         |
| Rating_count    | rating_count   |
| Processed       | processed      |
| Contact_Name    | contact_name   |
| Prospect_Name   | prospect_name  |

Każdy nowy lead trafia automatycznie do stage **Not contacted yet**.

Opcjonalnie ustaw `WEBHOOK_SECRET` w `.env` i nagłówek w n8n:

```
x-webhook-secret: twój-klucz
```

## Pipeline

Stages: Not contacted yet → Missed call 1/2 → Meeting booked → After meeting → Written message send → Contact later → In process → **Win** / **Lost**.

- Przeciągnij kartę na inny stage → modal z opisem i umówioną sumą.  
- Kliknij kartę → szczegóły + historia przenoszeń.  
- **Win:** umówiona suma kopiuje się do pola **zarobek**.  
- Zakładka **Statystyki** — wykres słupkowy, podsumowanie i karty per stage.
- Zakładka **Stos** — zadania na stosie (nowe na wierzchu), ukończone poniżej.
- Zakładka **API** — dokumentacja integracji (lead, zadanie), edycja URL endpointów, testy webhooków.

## Dane

- **Netlify:** Netlify Blobs (automatycznie)
- **Lokalnie:** SQLite w `data/crm.db`
