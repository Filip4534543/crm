import { useDraggable } from '@dnd-kit/core';

function parseDateLike(value) {
  if (!value) return null;
  const normalized = String(value).includes('T')
    ? String(value)
    : String(value).replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDaysAgo(value) {
  const date = parseDateLike(value);
  if (!date) return '—';
  const diffDays = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return 'dzisiaj';
  if (diffDays === 1) return '1 dzień temu';
  return `${diffDays} dni temu`;
}

function resolveStageAgeDays(lead) {
  const since = (lead.history || []).find((entry) => entry.to_stage === lead.stage)?.created_at;
  const stageSince = parseDateLike(since);
  if (!stageSince) return 0;
  return Math.floor((Date.now() - stageSince.getTime()) / (24 * 60 * 60 * 1000));
}

export default function LeadCard({ lead, tasks, selected, onClick, onDoubleClick }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: `lead-${lead.id}`, data: { lead } });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const title = lead.company_name || lead.prospect_name || 'Bez nazwy';
  const stageAgeDays = resolveStageAgeDays(lead);
  const isStale = stageAgeDays >= 2;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`lead-card${isDragging ? ' dragging' : ''}${selected ? ' selected' : ''}${
        isStale ? ' stale' : ''
      }`}
      {...listeners}
      {...attributes}
      onClick={() => {
        if (!isDragging) onClick?.(lead);
      }}
      onDoubleClick={() => {
        if (!isDragging) onDoubleClick?.(lead);
      }}
    >
      <h4>{title}</h4>
      {lead.contact_name && <div className="meta">{lead.contact_name}</div>}
      {lead.phone && <div className="meta">{lead.phone}</div>}
      <div className="meta">Last contact: {formatDaysAgo(lead.last_contact_at)}</div>
      {tasks?.length > 0 && <div className="meta">Zadania: {tasks.length}</div>}
      {isStale && <div className="meta stale-text">Na tym stage od {stageAgeDays} dni</div>}
      {lead.last_description && (
        <div className="last-desc">{lead.last_description}</div>
      )}
      {lead.stage === 'win' && lead.earnings != null && (
        <div className="sum">Zarobek: {lead.earnings} PLN</div>
      )}
      {lead.agreed_sum != null && lead.stage !== 'win' && (
        <div className="sum">Umówiona: {lead.agreed_sum} PLN</div>
      )}
    </div>
  );
}
