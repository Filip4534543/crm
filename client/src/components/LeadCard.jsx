import { useState } from 'react';
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

export default function LeadCard({
  lead,
  tasks,
  selected,
  showDelete = false,
  showInlineEdit = false,
  onClick,
  onDoubleClick,
  onDelete,
  onUpdate,
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editFields, setEditFields] = useState({
    first_name: lead.first_name || '',
    last_name: lead.last_name || '',
    email: lead.email || '',
    phone: lead.phone || '',
  });

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: `lead-${lead.id}`, data: { lead } });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const title = lead.company_name || lead.prospect_name || 'Bez nazwy';
  const stageAgeDays = resolveStageAgeDays(lead);
  const isStale = stageAgeDays >= 2;

  function handleEditToggle(e) {
    e.stopPropagation();
    if (!editOpen) {
      setEditFields({
        first_name: lead.first_name || '',
        last_name: lead.last_name || '',
        email: lead.email || '',
        phone: lead.phone || '',
      });
    }
    setEditOpen((prev) => !prev);
  }

  async function handleSave(e) {
    e.stopPropagation();
    setSaving(true);
    try {
      await onUpdate?.(lead.id, editFields);
      setEditOpen(false);
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteClick(e) {
    e.stopPropagation();
    if (window.confirm(`Usunąć lead "${title}"? Tej operacji nie można cofnąć.`)) {
      onDelete?.(lead.id);
    }
  }

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
        if (!isDragging && !editOpen) onClick?.(lead);
      }}
      onDoubleClick={() => {
        if (!isDragging && !editOpen) onDoubleClick?.(lead);
      }}
    >
      <div className="lead-card-header">
        <h4>{title}</h4>
        <div className="lead-card-actions">
          {showInlineEdit && (
            <button
              type="button"
              className="btn-card-icon"
              title="Edytuj dane"
              onClick={handleEditToggle}
            >
              {editOpen ? '✕' : '✏'}
            </button>
          )}
          {showDelete && (
            <button
              type="button"
              className="btn-card-icon btn-card-icon--danger"
              title="Usuń lead"
              onClick={handleDeleteClick}
            >
              🗑
            </button>
          )}
        </div>
      </div>

      {editOpen ? (
        <div
          className="lead-inline-edit"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <label>
            <span>Imię</span>
            <input
              type="text"
              value={editFields.first_name}
              onChange={(e) => setEditFields((prev) => ({ ...prev, first_name: e.target.value }))}
              placeholder="Imię"
            />
          </label>
          <label>
            <span>Nazwisko</span>
            <input
              type="text"
              value={editFields.last_name}
              onChange={(e) => setEditFields((prev) => ({ ...prev, last_name: e.target.value }))}
              placeholder="Nazwisko"
            />
          </label>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={editFields.email}
              onChange={(e) => setEditFields((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="Email"
            />
          </label>
          <label>
            <span>Telefon</span>
            <input
              type="tel"
              value={editFields.phone}
              onChange={(e) => setEditFields((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="Telefon"
            />
          </label>
          <div className="lead-inline-edit-actions">
            <button
              type="button"
              className="btn-primary"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? 'Zapisywanie…' : 'Zapisz'}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={handleEditToggle}
            >
              Anuluj
            </button>
          </div>
        </div>
      ) : (
        <>
          {(lead.first_name || lead.last_name) && (
            <div className="meta">
              {[lead.first_name, lead.last_name].filter(Boolean).join(' ')}
            </div>
          )}
          {lead.contact_name && !lead.first_name && !lead.last_name && (
            <div className="meta">{lead.contact_name}</div>
          )}
          {lead.email && <div className="meta">{lead.email}</div>}
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
        </>
      )}
    </div>
  );
}
