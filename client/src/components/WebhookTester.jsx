import { useState } from 'react';

const TEST_PAYLOAD = {
  ping: true,
  source: 'filips-crm-panel',
  time: new Date().toISOString(),
};

export default function WebhookTester({
  testUrl,
  leadsUrl,
  tasksUrl,
  webhookSecret,
  exampleLead,
  exampleTask,
  onSuccess,
}) {
  const [status, setStatus] = useState('idle');
  const [loading, setLoading] = useState(null);
  const [result, setResult] = useState('');

  function headers() {
    const h = { 'Content-Type': 'application/json' };
    if (webhookSecret?.trim()) {
      h['x-webhook-secret'] = webhookSecret.trim();
    }
    return h;
  }

  async function runTest(kind, url, options = {}) {
    setLoading(kind);
    setStatus('idle');
    setResult('');
    const start = performance.now();
    try {
      const method = options.method || 'POST';
      const init = { method, headers: headers() };
      if (method !== 'GET') {
        init.body = JSON.stringify(
          options.body !== undefined ? options.body : TEST_PAYLOAD
        );
      }
      const res = await fetch(url, init);
      const text = await res.text();
      let parsed = text;
      try {
        parsed = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        /* raw */
      }
      const ms = Math.round(performance.now() - start);
      if (!res.ok) {
        setStatus('error');
        setResult(`HTTP ${res.status} (${ms} ms)\n${parsed}`);
        return;
      }
      setStatus('ok');
      setResult(`HTTP ${res.status} (${ms} ms)\n${parsed}`);
      if (options.refreshOnSuccess && onSuccess) onSuccess();
    } catch (err) {
      setStatus('error');
      setResult(
        `Błąd połączenia: ${err.message}\n\nSprawdź URL serwera i czy CRM działa (npm run dev).`
      );
    } finally {
      setLoading(null);
    }
  }

  const statusLabel =
    status === 'ok' ? 'Działa' : status === 'error' ? 'Błąd' : 'Nie testowano';

  return (
    <section className="api-section webhook-tester">
      <div className="webhook-tester-head">
        <h2>Tester webhooków</h2>
        <span className={`webhook-status webhook-status--${status}`}>{statusLabel}</span>
      </div>
      <p className="api-hint">
        Najpierw użyj <strong>testowego webhooka</strong> — nie dodaje leadów ani zadań, tylko
        sprawdza połączenie z serwerem (i klucz, jeśli jest ustawiony).
      </p>

      <label>URL testowy (GET lub POST)</label>
      <div className="api-url-box">
        <code>{testUrl}</code>
        <button type="button" className="btn-ghost" onClick={() => navigator.clipboard.writeText(testUrl)}>
          Kopiuj
        </button>
      </div>

      <div className="webhook-test-buttons">
        <button
          type="button"
          className="btn-primary"
          disabled={!!loading}
          onClick={() => runTest('ping-get', testUrl, { method: 'GET', body: undefined })}
        >
          {loading === 'ping-get' ? 'Testuję…' : 'Ping (GET)'}
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={!!loading}
          onClick={() => runTest('ping-post', testUrl, { method: 'POST', body: TEST_PAYLOAD })}
        >
          {loading === 'ping-post' ? 'Testuję…' : 'Test POST (bez danych)'}
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={!!loading}
          onClick={() =>
            runTest('lead', leadsUrl, {
              body: { ...exampleLead, Company_Name: `[TEST] ${exampleLead.Company_Name}` },
              refreshOnSuccess: true,
            })
          }
        >
          {loading === 'lead' ? '…' : 'Test leada (dodaje do CRM)'}
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={!!loading}
          onClick={() =>
            runTest('task', tasksUrl, {
              body: { ...exampleTask, title: `[TEST] ${exampleTask.title}` },
              refreshOnSuccess: true,
            })
          }
        >
          {loading === 'task' ? '…' : 'Test zadania (dodaje do stosu)'}
        </button>
      </div>

      {result && (
        <pre className={`api-code api-test-result api-test-result--${status}`}>{result}</pre>
      )}
    </section>
  );
}
