import { useState } from 'react';

function formatDateTime(iso) {
  if (!iso) return '—';
  const normalized = iso.includes('T') ? iso : iso.replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('pl-PL');
}

function getLeadName(lead) {
  return lead.company_name || lead.prospect_name || `Lead #${lead.original_id || lead.id}`;
}

export default function DeletedLeadsPage({
  leads = [],
  onRestore,
  onDeletePermanent,
}) {
  const [busyId, setBusyId] = useState(null);

  async function handleRestore(lead) {
    setBusyId(lead.deleted_id);
    try {
      await onRestore?.(lead.deleted_id);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeletePermanent(lead) {
    const leadName = getLeadName(lead);
    if (
      !window.confirm(
        `Usunąć na stałe „${leadName}”? Tej operacji nie można cofnąć.`
      )
    ) {
      return;
    }
    setBusyId(lead.deleted_id);
    try {
      await onDeletePermanent?.(lead.deleted_id);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="deleted-page">
      <div className="deleted-head">
        <h2>Usunięte leady</h2>
        <span className="task-count">{leads.length}</span>
      </div>
      <p className="tasks-hint">
        Nowe leady są porównywane również z tą listą podczas wykrywania duplikatów.
      </p>

      {leads.length === 0 ? (
        <p className="tasks-empty">Kosz jest pusty.</p>
      ) : (
        <div className="deleted-list">
          {leads.map((lead) => {
            const leadName = getLeadName(lead);
            const busy = busyId === lead.deleted_id;
            return (
              <article key={lead.deleted_id} className="deleted-item">
                <div className="deleted-item-main">
                  <h3>{leadName}</h3>
                  <p>
                    <strong>Telefon:</strong> {lead.phone || '—'}
                  </p>
                  <p>
                    <strong>Website:</strong> {lead.website || '—'}
                  </p>
                  <p>
                    <strong>Maps:</strong> {lead.maps_url || '—'}
                  </p>
                  <p>
                    <strong>Usunięto:</strong> {formatDateTime(lead.deleted_at)}
                  </p>
                </div>
                <div className="deleted-item-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={busy}
                    onClick={() => handleRestore(lead)}
                  >
                    {busy ? 'Przywracanie…' : 'Przywróć'}
                  </button>
                  <button
                    type="button"
                    className="btn-danger"
                    disabled={busy}
                    onClick={() => handleDeletePermanent(lead)}
                  >
                    Usuń na stałe
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
