import { useState } from 'react';
import { STAGE_MAP } from '../constants';

function formatDate(iso) {
  if (!iso) return '';
  const normalized = iso.includes('T') ? iso : iso.replace(' ', 'T');
  return new Date(normalized).toLocaleString('pl-PL');
}

export default function LeadDetailModal({ lead, onClose, onUpdateSum, onDelete }) {
  const [sum, setSum] = useState(
    lead.agreed_sum != null ? String(lead.agreed_sum) : ''
  );
  const [deleting, setDeleting] = useState(false);

  function handleSumBlur() {
    const val = sum !== '' ? parseFloat(sum) : null;
    if (val !== lead.agreed_sum) onUpdateSum(lead.id, { agreed_sum: val });
  }

  async function handleDelete() {
    const name = lead.company_name || lead.prospect_name || 'ten lead';
    if (
      !window.confirm(
        `Przenieść lead „${name}” do zakładki „Usunięte”?`
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await onDelete(lead.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2>{lead.company_name || lead.prospect_name || 'Lead'}</h2>

        <dl className="detail-grid">
          {lead.prospect_name && (
            <>
              <dt>Prospect</dt>
              <dd>{lead.prospect_name}</dd>
            </>
          )}
          {lead.contact_name && (
            <>
              <dt>Kontakt</dt>
              <dd>{lead.contact_name}</dd>
            </>
          )}
          {lead.phone && (
            <>
              <dt>Telefon</dt>
              <dd>
                <a href={`tel:${lead.phone}`}>{lead.phone}</a>
              </dd>
            </>
          )}
          {lead.address && (
            <>
              <dt>Adres</dt>
              <dd>{lead.address}</dd>
            </>
          )}
          {lead.website && (
            <>
              <dt>Strona</dt>
              <dd>
                <a href={lead.website} target="_blank" rel="noreferrer">
                  {lead.website}
                </a>
              </dd>
            </>
          )}
          {lead.maps_url && (
            <>
              <dt>Maps</dt>
              <dd>
                <a href={lead.maps_url} target="_blank" rel="noreferrer">
                  Otwórz w Maps
                </a>
              </dd>
            </>
          )}
          {(lead.rating != null || lead.rating_count != null) && (
            <>
              <dt>Ocena</dt>
              <dd>
                {lead.rating ?? '—'} ({lead.rating_count ?? 0} opinii)
              </dd>
            </>
          )}
          <dt>Stage</dt>
          <dd>{STAGE_MAP[lead.stage]?.label || lead.stage}</dd>
          <dt>Umówiona suma</dt>
          <dd>
            <input
              type="number"
              step="0.01"
              value={sum}
              onChange={(e) => setSum(e.target.value)}
              onBlur={handleSumBlur}
              style={{ width: 120, marginBottom: 0 }}
            />{' '}
            PLN
          </dd>
          {lead.earnings != null && (
            <>
              <dt>Zarobek</dt>
              <dd className="earnings-value">{lead.earnings} PLN</dd>
            </>
          )}
        </dl>

        {lead.last_description && (
          <p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
            <strong>Ostatni opis:</strong> {lead.last_description}
          </p>
        )}

        <h3 style={{ fontSize: '0.9375rem', marginBottom: '0.5rem' }}>Historia przenoszeń</h3>
        <ul className="history-list">
          {(lead.history || []).map((h) => (
            <li key={h.id}>
              <div className="move">
                {h.from_stage
                  ? `${STAGE_MAP[h.from_stage]?.label || h.from_stage} → `
                  : 'Nowy → '}
                {STAGE_MAP[h.to_stage]?.label || h.to_stage}
              </div>
              <div className="date">{formatDate(h.created_at)}</div>
              {h.description && <div className="desc">{h.description}</div>}
            </li>
          ))}
          {(!lead.history || lead.history.length === 0) && (
            <li style={{ color: 'var(--muted)' }}>Brak historii</li>
          )}
        </ul>

        <div className="modal-actions modal-actions-split" style={{ marginTop: '1rem' }}>
          <button
            type="button"
            className="btn-danger"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Usuwanie…' : 'Usuń lead'}
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
}