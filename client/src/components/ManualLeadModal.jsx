import { useState } from 'react';

const INITIAL_FORM = {
  company_name: '',
  prospect_name: '',
  contact_name: '',
  phone: '',
  address: '',
  website: '',
  maps_url: '',
  initial_description: '',
};

function trimOrUndefined(value) {
  const text = value.trim();
  return text || undefined;
}

export default function ManualLeadModal({ onClose, onSubmit }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canSubmit =
    form.company_name.trim().length > 0 || form.prospect_name.trim().length > 0;

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) {
      setError('Podaj nazwę firmy lub prospecta.');
      return;
    }

    setError('');
    setSaving(true);
    try {
      await onSubmit({
        company_name: trimOrUndefined(form.company_name),
        prospect_name: trimOrUndefined(form.prospect_name),
        contact_name: trimOrUndefined(form.contact_name),
        phone: trimOrUndefined(form.phone),
        address: trimOrUndefined(form.address),
        website: trimOrUndefined(form.website),
        maps_url: trimOrUndefined(form.maps_url),
        initial_description: trimOrUndefined(form.initial_description),
      });
    } catch (err) {
      setError(err.message || 'Nie udało się dodać leadu.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide" onClick={(event) => event.stopPropagation()}>
        <form className="lead-form" onSubmit={handleSubmit}>
          <h2>Dodaj lead ręcznie</h2>
          <p className="lead-form-hint">
            Lead trafi od razu do etapu <strong>Not contacted yet</strong>.
          </p>

          <div className="lead-form-grid">
            <label className="lead-form-field">
              <span>Nazwa firmy</span>
              <input
                type="text"
                value={form.company_name}
                onChange={(event) => updateField('company_name', event.target.value)}
                placeholder="np. Studio Smile"
                autoFocus
              />
            </label>

            <label className="lead-form-field">
              <span>Prospect</span>
              <input
                type="text"
                value={form.prospect_name}
                onChange={(event) => updateField('prospect_name', event.target.value)}
                placeholder="np. Gabinet stomatologiczny"
              />
            </label>

            <label className="lead-form-field">
              <span>Osoba kontaktowa</span>
              <input
                type="text"
                value={form.contact_name}
                onChange={(event) => updateField('contact_name', event.target.value)}
                placeholder="np. Anna Kowalska"
              />
            </label>

            <label className="lead-form-field">
              <span>Telefon</span>
              <input
                type="text"
                value={form.phone}
                onChange={(event) => updateField('phone', event.target.value)}
                placeholder="np. +48 500 600 700"
              />
            </label>

            <label className="lead-form-field lead-form-field--full">
              <span>Adres</span>
              <input
                type="text"
                value={form.address}
                onChange={(event) => updateField('address', event.target.value)}
                placeholder="np. Warszawa, ul. Kwiatowa 1"
              />
            </label>

            <label className="lead-form-field">
              <span>Strona WWW</span>
              <input
                type="text"
                value={form.website}
                onChange={(event) => updateField('website', event.target.value)}
                placeholder="https://..."
              />
            </label>

            <label className="lead-form-field">
              <span>Link Google Maps</span>
              <input
                type="text"
                value={form.maps_url}
                onChange={(event) => updateField('maps_url', event.target.value)}
                placeholder="https://maps.google.com/..."
              />
            </label>

            <label className="lead-form-field lead-form-field--full">
              <span>Notatka startowa</span>
              <textarea
                value={form.initial_description}
                onChange={(event) =>
                  updateField('initial_description', event.target.value)
                }
                placeholder="Skąd lead, co już wiadomo, na czym zależy..."
                rows={4}
              />
            </label>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Anuluj
            </button>
            <button type="submit" className="btn-primary" disabled={saving || !canSubmit}>
              {saving ? 'Dodawanie...' : 'Dodaj lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
