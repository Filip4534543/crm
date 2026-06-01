const BULK_STAGE = 'not_contacted_yet';

function normalizePhone(phone) {
  if (!phone || phone === '-') return '';
  return String(phone).replace(/\D/g, '');
}

function normalizeText(value) {
  if (!value || value === '-') return '';
  return String(value).trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeLeadForCompare(lead) {
  return {
    company_name: normalizeText(lead.company_name),
    prospect_name: normalizeText(lead.prospect_name),
    contact_name: normalizeText(lead.contact_name),
    phone: normalizePhone(lead.phone),
    maps_url: normalizeText(lead.maps_url),
    website: normalizeText(lead.website),
    address: normalizeText(lead.address),
  };
}

function matchDetails(aLead, bLead) {
  const a = normalizeLeadForCompare(aLead);
  const b = normalizeLeadForCompare(bLead);
  const matchedFields = [];

  for (const field of Object.keys(a)) {
    const aVal = a[field];
    const bVal = b[field];
    if (!aVal || !bVal) continue;
    if (aVal !== bVal) continue;
    if ((field === 'company_name' || field === 'prospect_name') && aVal.length < 3) continue;
    if (field === 'address' && aVal.length < 6) continue;
    matchedFields.push(field);
  }

  if (!matchedFields.length) {
    return { isDuplicate: false, matchedFields: [] };
  }

  const strongMatch = ['phone', 'maps_url', 'website'].some((field) =>
    matchedFields.includes(field)
  );
  const isDuplicate = strongMatch || matchedFields.length >= 2;

  return { isDuplicate, matchedFields };
}

function findBestDuplicateMatch(lead, pools, options = {}) {
  const excludeIds = new Set((options.excludeIds || []).map(Number));
  let best = null;

  for (const { source, leads } of pools) {
    for (const candidate of leads) {
      if (!candidate) continue;
      if (excludeIds.has(Number(candidate.id))) continue;
      const details = matchDetails(lead, candidate);
      if (!details.isDuplicate) continue;
      if (!best || details.matchedFields.length > best.matchedFields.length) {
        best = { source, lead: candidate, matchedFields: details.matchedFields };
      }
    }
  }

  return best;
}

/**
 * Zwraca ID do usunięcia dla leadów z wybranego stage.
 * Zachowuje najstarszy rekord ze stage, usuwa duplikaty w oparciu o:
 * - wszystkie aktywne leady z innych stage,
 * - leady już usunięte,
 * - leady wcześniej zachowane wewnątrz tego stage.
 */
function duplicateIdsToRemoveForStage({
  scopedLeads,
  activeLeadsOutsideScope = [],
  deletedLeads = [],
}) {
  const sortedScoped = [...scopedLeads].sort((a, b) => Number(a.id) - Number(b.id));
  const survivors = [];
  const idsToRemove = [];

  for (const lead of sortedScoped) {
    const duplicate = findBestDuplicateMatch(
      lead,
      [
        { source: 'active', leads: activeLeadsOutsideScope },
        { source: 'deleted', leads: deletedLeads },
        { source: 'stage', leads: survivors },
      ],
      { excludeIds: [lead.id] }
    );

    if (duplicate) {
      idsToRemove.push(lead.id);
    } else {
      survivors.push(lead);
    }
  }

  return idsToRemove;
}

function assertBulkStage(stage) {
  if (stage !== BULK_STAGE) {
    throw new Error('Operacja dozwolona tylko dla stage not_contacted_yet');
  }
}

module.exports = {
  BULK_STAGE,
  matchDetails,
  findBestDuplicateMatch,
  duplicateIdsToRemoveForStage,
  assertBulkStage,
  normalizeLeadForCompare,
};
