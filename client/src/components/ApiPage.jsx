import { useState, useEffect } from 'react';
import {
  getEndpoints,
  saveEndpoints,
  resetEndpoints,
  PRODUCTION_HOST,
  isNetlifyHost,
} from '../endpoints';
import WebhookTester from './WebhookTester';

const LEAD_FIELDS = [
  ['Company_Name', 'Nazwa firmy'],
  ['Maps_url', 'Link Google Maps'],
  ['Phone', 'Telefon'],
  ['Adress / Address', 'Adres'],
  ['Website', 'Strona www'],
  ['Rating', 'Ocena'],
  ['Rating_count', 'Liczba opinii'],
  ['Processed', 'Przetworzony (flaga z n8n)'],
  ['Contact_Name', 'Osoba kontaktowa'],
  ['Prospect_Name', 'Nazwa prospecta'],
];

const EXAMPLE_LEAD = {
  Company_Name: 'Przykładowa Firma Sp. z o.o.',
  Maps_url: 'https://maps.google.com/...',
  Phone: '+48 123 456 789',
  Adress: 'ul. Testowa 1, Warszawa',
  Website: 'https://example.pl',
  Rating: 4.5,
  Rating_count: 42,
  Processed: 'false',
  Contact_Name: 'Jan Kowalski',
  Prospect_Name: 'Jan Kowalski',
};

const EXAMPLE_TASK = {
  title: 'Zadzwonić do klienta',
  notes: 'Przypomnienie z n8n',
};

function copyText(text) {
  navigator.clipboard.writeText(text);
}

export default function ApiPage({ onWebhookSuccess }) {
  const [form, setForm] = useState(getEndpoints());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm(getEndpoints());
  }, []);

  function handleChange(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setSaved(false);
  }

  function handleSave(e) {
    e.preventDefault();
    saveEndpoints(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function handleReset() {
    const defaults = resetEndpoints();
    setForm(defaults);
    setSaved(false);
  }

  const testWebhookUrl =
    form.testWebhook ||
    `${(form.apiBase || '').replace(/\/$/, '')}/api/webhook/test`;

  const secretHeader = form.webhookSecret?.trim()
    ? `\nNagłówek: x-webhook-secret: ${form.webhookSecret.trim()}`
    : '\n(Nagłówek x-webhook-secret opcjonalny — w Netlify: Site settings → Environment variables → WEBHOOK_SECRET)';

  function applyNetlifyDefaults() {
    const host = isNetlifyHost() ? window.location.origin : PRODUCTION_HOST;
    const next = {
      apiBase: host,
      testWebhook: `${host}/api/webhook/test`,
      leadsWebhook: `${host}/api/webhook/leads`,
      tasksWebhook: `${host}/api/webhook/tasks`,
      tasksApi: `${host}/api/tasks`,
      loginApi: `${host}/api/auth/login`,
    };
    setForm((f) => ({ ...f, ...next }));
    setSaved(false);
  }

  return (
    <div className="api-page">
      <WebhookTester
        testUrl={testWebhookUrl}
        leadsUrl={form.leadsWebhook}
        tasksUrl={form.tasksWebhook}
        webhookSecret={form.webhookSecret}
        exampleLead={EXAMPLE_LEAD}
        exampleTask={EXAMPLE_TASK}
        onSuccess={onWebhookSuccess}
      />

      <section className="api-section api-netlify-box">
        <h2>Hosting Netlify</h2>
        <p className="api-hint">
          Produkcja: <strong>{PRODUCTION_HOST}</strong>. Webhooki n8n wysyłaj na ten adres
          (ścieżki <code>/api/webhook/…</code>). Dane są w Netlify Blobs.
        </p>
        <p className="api-hint">
          W panelu Netlify ustaw zmienne: <code>LOGIN_PASSWORD</code>,{' '}
          <code>JWT_SECRET</code>, opcjonalnie <code>WEBHOOK_SECRET</code>.
        </p>
        <div className="api-actions">
          <button type="button" className="btn-ghost" onClick={applyNetlifyDefaults}>
            Ustaw URL Netlify
          </button>
        </div>
      </section>

      <form className="api-section" onSubmit={handleSave}>
        <h2>Endpointy</h2>
        <p className="api-hint">
          Domyślnie API = ta sama domena co panel. Lokalnie (Vite :5173) API idzie na
          localhost:3847. Po zapisie odśwież stronę.
        </p>

        <label>Bazowy URL API (panel CRM)</label>
        <input
          value={form.apiBase}
          onChange={(e) => handleChange('apiBase', e.target.value)}
          placeholder={PRODUCTION_HOST}
        />

        <label>Webhook testowy (ping — bez dodawania danych)</label>
        <input
          value={form.testWebhook ?? testWebhookUrl}
          onChange={(e) => handleChange('testWebhook', e.target.value)}
        />

        <label>Webhook — nowy lead (n8n, bez logowania)</label>
        <input
          value={form.leadsWebhook}
          onChange={(e) => handleChange('leadsWebhook', e.target.value)}
        />

        <label>Webhook — nowe zadanie (n8n, bez logowania)</label>
        <input
          value={form.tasksWebhook}
          onChange={(e) => handleChange('tasksWebhook', e.target.value)}
        />

        <label>API zadań (z logowaniem — Bearer token)</label>
        <input
          value={form.tasksApi}
          onChange={(e) => handleChange('tasksApi', e.target.value)}
        />

        <label>Logowanie (pobranie tokena JWT)</label>
        <input
          value={form.loginApi}
          onChange={(e) => handleChange('loginApi', e.target.value)}
        />

        <label>Klucz webhook (nagłówek x-webhook-secret dla n8n)</label>
        <input
          value={form.webhookSecret}
          onChange={(e) => handleChange('webhookSecret', e.target.value)}
          placeholder="Puste = bez nagłówka (jeśli serwer też bez WEBHOOK_SECRET)"
        />

        <div className="api-actions">
          <button type="submit" className="btn-primary">
            Zapisz endpointy
          </button>
          <button type="button" className="btn-secondary" onClick={handleReset}>
            Przywróć domyślne
          </button>
          {saved && <span className="api-saved">Zapisano</span>}
        </div>
      </form>

      <section className="api-section">
        <h2>Dodawanie leada (n8n)</h2>
        <p className="api-hint">
          Węzeł <strong>HTTP Request</strong> → metoda <strong>POST</strong> na URL webhooka
          leadów. Lead trafia do stage <em>Not contacted yet</em>.
        </p>
        <div className="api-url-box">
          <code>{form.leadsWebhook}</code>
          <button type="button" className="btn-ghost" onClick={() => copyText(form.leadsWebhook)}>
            Kopiuj
          </button>
        </div>
        <p className="api-hint">Body: JSON (jeden obiekt lub tablica obiektów).</p>
        <table className="api-table">
          <thead>
            <tr>
              <th>Pole</th>
              <th>Opis</th>
            </tr>
          </thead>
          <tbody>
            {LEAD_FIELDS.map(([field, desc]) => (
              <tr key={field}>
                <td>
                  <code>{field}</code>
                </td>
                <td>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <pre className="api-code">{JSON.stringify(EXAMPLE_LEAD, null, 2)}</pre>
        <div className="api-actions">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => copyText(JSON.stringify(EXAMPLE_LEAD))}
          >
            Kopiuj przykład JSON
          </button>
        </div>
        <pre className="api-note">{`n8n — uwagi:${secretHeader}`}</pre>
      </section>

      <section className="api-section">
        <h2>Dodawanie zadania</h2>

        <h3 className="api-sub">Opcja A — webhook (zalecane dla n8n)</h3>
        <p className="api-hint">
          <strong>POST</strong> na URL poniżej. Zadanie ląduje na wierzchu stosu (jak przycisk
          „Wrzuć na stos”).
        </p>
        <div className="api-url-box">
          <code>{form.tasksWebhook}</code>
          <button type="button" className="btn-ghost" onClick={() => copyText(form.tasksWebhook)}>
            Kopiuj
          </button>
        </div>
        <pre className="api-code">{JSON.stringify(EXAMPLE_TASK, null, 2)}</pre>
        <div className="api-actions">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => copyText(JSON.stringify(EXAMPLE_TASK))}
          >
            Kopiuj przykład JSON
          </button>
        </div>

        <h3 className="api-sub">Opcja B — API z tokenem</h3>
        <p className="api-hint">
          1. <strong>POST</strong> <code>{form.loginApi}</code> z body{' '}
          <code>{'{"password":"twoje_haslo"}'}</code>
          <br />
          2. Użyj <code>token</code> z odpowiedzi jako{' '}
          <code>Authorization: Bearer TOKEN</code>
          <br />
          3. <strong>POST</strong> <code>{form.tasksApi}</code> z body jak wyżej.
        </p>
        <pre className="api-note">{`curl -X POST "${form.loginApi}" -H "Content-Type: application/json" -d '{"password":"..."}'

curl -X POST "${form.tasksApi}" \\
  -H "Authorization: Bearer TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(EXAMPLE_TASK)}'`}</pre>
      </section>

    </div>
  );
}
