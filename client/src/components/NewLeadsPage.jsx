import { useState } from 'react';
import { PIPELINES } from '../constants';

function formatDate(value) {
  if (!value) return '—';
  const normalized = String(value).includes('T')
    ? String(value)
    : String(value).replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parseAssignCount(raw, total) {
  const trimmed = String(raw ?? '').trim().toLowerCase();
  if (!trimmed || trimmed === 'wszystkie' || trimmed === 'all') {
    return total;
  }
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 1) return null;
  return Math.min(n, total);
}

export default function NewLeadsPage({
  leads,
  onAssignPipeline,
  onAssignAllInbox,
  onLeadClick,
  onPurgeLead,
  onPurgeAll,
}) {
  const [busyId, setBusyId] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const inboxLeads = leads
    .filter((lead) => (lead.pipeline || 'pipeline') === 'inbox')
    .sort((a, b) => {
      const ta = new Date(String(a.created_at).replace(' ', 'T')).getTime();
      const tb = new Date(String(b.created_at).replace(' ', 'T')).getTime();
      return tb - ta;
    });

  async function handleAssign(lead, pipeline) {
    setBusyId(lead.id);
    try {
      await onAssignPipeline(lead.id, pipeline);
    } finally {
      setBusyId(null);
    }
  }

  async function handleAssignAll(pipeline) {
    const label = PIPELINES[pipeline]?.label || pipeline;
    const total = inboxLeads.length;
    const raw = window.prompt(
      `Ile leadów przenieść do ${label}?\nDomyślnie wszystkie (${total}). Wpisz liczbę albo zostaw ${total}.`,
      String(total)
    );
    if (raw === null) return;

    const count = parseAssignCount(raw, total);
    if (count == null) {
      window.alert('Podaj dodatnią liczbę całkowitą albo zostaw domyślną wartość.');
      return;
    }

    const movingAll = count >= total;
    if (
      !window.confirm(
        movingAll
          ? `Przenieść wszystkie ${total} leadów do pipeline ${label}?`
          : `Przenieść ${count} z ${total} leadów (najnowsze z listy) do pipeline ${label}?`
      )
    ) {
      return;
    }

    setBulkBusy(true);
    try {
      await onAssignAllInbox?.(pipeline, movingAll ? undefined : count);
    } finally {
      setBulkBusy(false);
    }
  }

  async function handlePurgeAll() {
    const total = inboxLeads.length;
    if (
      !window.confirm(
        `Usunąć wszystkie ${total} leadów z Nowych leadów?\nNie trafią do Usuniętych i nie będą blokować ponownego dodania z n8n.`
      )
    ) {
      return;
    }
    setBulkBusy(true);
    try {
      await onPurgeAll?.();
    } finally {
      setBulkBusy(false);
    }
  }

  const anyBusy = bulkBusy || busyId != null;

  return (
    <div className="new-leads-page">
      <header className="new-leads-header">
        <div>
          <h2>Nowe leady</h2>
          <p className="new-leads-sub">
            Leady z n8n trafiają tutaj. Przypisz je do Pipeline (startują w „Not
            Qualified"). Usunięcie z tej listy nie trafia do Usuniętych — ten sam
            lead może wrócić później z n8n.
          </p>
        </div>
        <div className="new-leads-header-side">
          <div className="badge new-leads-count">{inboxLeads.length} oczekujących</div>
          {inboxLeads.length > 0 && (
            <div className="new-leads-bulk">
              <span className="new-leads-bulk-label">Przenieś:</span>
              <button
                type="button"
                className="btn-primary"
                disabled={anyBusy}
                onClick={() => handleAssignAll('pipeline')}
              >
                → {PIPELINES.pipeline.label}
              </button>
              <button
                type="button"
                className="btn-ghost btn-danger-ghost"
                disabled={anyBusy}
                onClick={handlePurgeAll}
              >
                Usuń wszystkie
              </button>
            </div>
          )}
        </div>
      </header>

      {inboxLeads.length === 0 ? (
        <p className="new-leads-empty">Brak nowych leadów z n8n.</p>
      ) : (
        <ul className="new-leads-list">
          {inboxLeads.map((lead) => {
            const title = lead.company_name || lead.prospect_name || 'Bez nazwy';
            const isBusy = anyBusy && (bulkBusy || busyId === lead.id);
            return (
              <li key={lead.id} className="new-leads-item">
                <button
                  type="button"
                  className="new-leads-item-main"
                  onClick={() => onLeadClick?.(lead)}
                >
                  <h3>{title}</h3>
                  {lead.contact_name && <span>{lead.contact_name}</span>}
                  {lead.phone && <span>{lead.phone}</span>}
                  {lead.website && <span>{lead.website}</span>}
                  {lead.address && <span>{lead.address}</span>}
                  <span className="new-leads-meta">
                    Dodano: {formatDate(lead.created_at)}
                  </span>
                  {lead.last_description && (
                    <span className="new-leads-desc">{lead.last_description}</span>
                  )}
                </button>
                <div className="new-leads-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={isBusy}
                    onClick={() => handleAssign(lead, 'pipeline')}
                  >
                    → {PIPELINES.pipeline.label}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-danger-ghost"
                    disabled={isBusy}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Usunąć lead „${title}" z Nowych leadów?\nNie trafi do Usuniętych i nie będzie blokował ponownego dodania z n8n.`
                        )
                      ) {
                        onPurgeLead?.(lead.id);
                      }
                    }}
                  >
                    Usuń
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
