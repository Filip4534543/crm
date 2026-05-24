import { useDraggable } from '@dnd-kit/core';

export default function LeadCard({ lead, selected, onClick, onDoubleClick }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: `lead-${lead.id}`, data: { lead } });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const title = lead.company_name || lead.prospect_name || 'Bez nazwy';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`lead-card${isDragging ? ' dragging' : ''}${selected ? ' selected' : ''}`}
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
