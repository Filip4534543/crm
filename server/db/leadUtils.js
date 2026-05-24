const BULK_STAGE = 'not_contacted_yet';

function normalizePhone(phone) {
  if (!phone || phone === '-') return '';
  return String(phone).replace(/\D/g, '');
}

function normalizeText(value) {
  if (!value || value === '-') return '';
  return String(value).trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Klucz do wykrywania duplikatów w obrębie jednego stage. */
function duplicateKey(lead) {
  const phone = normalizePhone(lead.phone);
  if (phone.length >= 6) return `phone:${phone}`;
  const name = normalizeText(lead.company_name || lead.prospect_name);
  if (name.length >= 2) return `name:${name}`;
  const maps = normalizeText(lead.maps_url);
  if (maps.length > 8) return `maps:${maps}`;
  return null;
}

/** ID do usunięcia — zostaje najstarszy lead (najmniejsze id) w grupie. */
function duplicateIdsToRemove(leads) {
  const byKey = new Map();
  for (const lead of leads) {
    const key = duplicateKey(lead);
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(lead);
  }
  const ids = [];
  for (const group of byKey.values()) {
    if (group.length <= 1) continue;
    group.sort((a, b) => a.id - b.id);
    for (let i = 1; i < group.length; i++) ids.push(group[i].id);
  }
  return ids;
}

function assertBulkStage(stage) {
  if (stage !== BULK_STAGE) {
    throw new Error('Operacja dozwolona tylko dla stage not_contacted_yet');
  }
}

module.exports = {
  BULK_STAGE,
  duplicateIdsToRemove,
  assertBulkStage,
};
