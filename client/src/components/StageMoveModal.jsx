import { useState } from 'react';
import { STAGE_MAP } from '../constants';

export default function StageMoveModal({ lead, toStage, onConfirm, onCancel }) {
  const [description, setDescription] = useState('');
  const [agreedSum, setAgreedSum] = useState(
    lead.agreed_sum != null ? String(lead.agreed_sum) : ''
  );

  const fromLabel = STAGE_MAP[lead.stage]?.label || lead.stage;
  const toLabel = STAGE_MAP[toStage]?.label || toStage;

  function handleSubmit(e) {
    e.preventDefault();
    onConfirm({
      description: description.trim() || null,
      agreed_sum: agreedSum !== '' ? parseFloat(agreedSum) : undefined,
    });
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2>Przenieś lead</h2>
        <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--muted)' }}>
          <strong>{lead.company_name || lead.prospect_name || 'Lead'}</strong>
          <br />
          {fromLabel} → {toLabel}
        </p>

        <label>Opis (opcjonalnie)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Notatka z tego przeniesienia…"
          autoFocus
        />

        <label>Umówiona suma (PLN)</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={agreedSum}
          onChange={(e) => setAgreedSum(e.target.value)}
          placeholder="0.00"
        />

        {toStage === 'win' && (
          <p style={{ fontSize: '0.8125rem', color: '#86efac', marginBottom: '1rem' }}>
            Po przeniesieniu do Win umówiona suma stanie się zarobkiem.
          </p>
        )}

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Anuluj
          </button>
          <button type="submit" className="btn-primary">
            Przenieś
          </button>
        </div>
      </form>
    </div>
  );
}
