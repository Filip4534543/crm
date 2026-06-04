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

export default function NewLeadsPage({
  leads,
  onAssignPipeline,
  onLeadClick,
  onDeleteLead,
}) {
  const [busyId, setBusyId] = useState(null);

  const inboxLeads = leads
    .filter((lead) => (lead.pipeline || 'websites') === 'inbox')
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

  return (
    <div className="new-leads-page">
      <header className="new-leads-header">
        <div>
          <h2>Nowe leady</h2>
          <p className="new-leads-sub">
            Leady z n8n trafiają tutaj. Przypisz je do pipeline Websites lub SEO
            (oba startują w „Not contacted yet”).
          </p>
        </div>
        <div className="badge new-leads-count">{inboxLeads.length} oczekujących</div>
      </header>

      {inboxLeads.length === 0 ? (
        <p className="new-leads-empty">Brak nowych leadów z n8n.</p>
      ) : (
        <ul className="new-leads-list">
          {inboxLeads.map((lead) => {
            const title = lead.company_name || lead.prospect_name || 'Bez nazwy';
            const isBusy = busyId === lead.id;
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
                    onClick={() => handleAssign(lead, 'websites')}
                  >
                    → {PIPELINES.websites.label} (Not contacted)
                  </button>
                  <button
                    type="button"
                    className="btn-ghost new-leads-btn-seo"
                    disabled={isBusy}
                    onClick={() => handleAssign(lead, 'seo')}
                  >
                    → {PIPELINES.seo.label} (Not contacted)
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-danger-ghost"
                    disabled={isBusy}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Usunąć lead „${title}”? Trafia do zakładki Usunięte.`
                        )
                      ) {
                        onDeleteLead?.(lead.id);
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
