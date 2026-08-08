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

function leadTitle(lead) {
  return lead.company_name || lead.prospect_name || `Lead #${lead.id}`;
}

export default function NotForThisServicePage({
  leads = [],
  onLeadClick,
  onDeleteLead,
}) {
  const filtered = leads
    .filter((lead) => lead.stage === 'not_for_this_service')
    .sort((a, b) => {
      const ta = new Date(String(a.updated_at || a.created_at).replace(' ', 'T')).getTime();
      const tb = new Date(String(b.updated_at || b.created_at).replace(' ', 'T')).getTime();
      return tb - ta;
    });

  return (
    <div className="nft-page">
      <header className="nft-header">
        <div>
          <h2>Not for this service</h2>
          <p className="nft-sub">
            Leady, które nie pasują do tej usługi. Przenieś je tu ze stage
            „Not for this service” w Pipeline.
          </p>
        </div>
        <div className="badge">{filtered.length}</div>
      </header>

      {filtered.length === 0 ? (
        <p className="nft-empty">Brak leadów na tym stage.</p>
      ) : (
        <div className="nft-table-wrap">
          <table className="nft-table">
            <thead>
              <tr>
                <th>Firma / Prospect</th>
                <th>Kontakt</th>
                <th>Telefon</th>
                <th>Website</th>
                <th>Adres</th>
                <th>Ostatnia notatka</th>
                <th>Aktualizacja</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <tr
                  key={lead.id}
                  className="nft-row"
                  onClick={() => onLeadClick?.(lead)}
                >
                  <td className="nft-cell-title">{leadTitle(lead)}</td>
                  <td>{lead.contact_name || '—'}</td>
                  <td>{lead.phone || '—'}</td>
                  <td className="nft-cell-clip">{lead.website || '—'}</td>
                  <td className="nft-cell-clip">{lead.address || '—'}</td>
                  <td className="nft-cell-clip">
                    {lead.last_description || '—'}
                  </td>
                  <td>{formatDate(lead.updated_at || lead.created_at)}</td>
                  <td className="nft-cell-actions">
                    <button
                      type="button"
                      className="btn-ghost btn-danger-ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          window.confirm(
                            `Usunąć lead „${leadTitle(lead)}”? Trafia do zakładki Usunięte.`
                          )
                        ) {
                          onDeleteLead?.(lead.id);
                        }
                      }}
                    >
                      Usuń
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
