import { useDroppable } from '@dnd-kit/core';

function ShortcutItem({
  stage,
  count,
  isActive,
  isCurrent,
  isDropTarget,
  onClick,
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `shortcut-${stage.id}`,
    data: { stageId: stage.id },
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={[
        'stage-shortcut',
        isActive && 'active',
        isCurrent && 'current',
        (isOver || isDropTarget) && 'drop-over',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ '--stage-color': stage.color }}
      onClick={onClick}
      title={stage.label}
    >
      <span className="stage-shortcut-bar" />
      <span className="stage-shortcut-text">
        <span className="stage-shortcut-label">{stage.label}</span>
        <span className="stage-shortcut-count">{count}</span>
      </span>
    </button>
  );
}

export default function StageShortcuts({
  stages,
  counts,
  selectedLead,
  focusedStageId,
  dragOverStageId,
  onStageClick,
}) {
  return (
    <aside className="stage-shortcuts">
      <div className="stage-shortcuts-head">
        <span>Skróty</span>
      </div>

      {selectedLead ? (
        <div className="stage-shortcuts-selected">
          <span className="label">Wybrany lead</span>
          <strong>
            {selectedLead.company_name ||
              selectedLead.prospect_name ||
              'Lead'}
          </strong>
          <span className="hint">Kliknij stage → przenieś</span>
        </div>
      ) : (
        <p className="stage-shortcuts-hint">
          Kliknij leada, potem stage. Przeciągnij kartę na skrót. Dwuklik = szczegóły.
        </p>
      )}

      <nav className="stage-shortcuts-list">
        {stages.map((stage) => (
          <ShortcutItem
            key={stage.id}
            stage={stage}
            count={counts[stage.id] ?? 0}
            isActive={focusedStageId === stage.id}
            isCurrent={selectedLead?.stage === stage.id}
            isDropTarget={dragOverStageId === stage.id}
            onClick={() => onStageClick(stage.id)}
          />
        ))}
      </nav>
    </aside>
  );
}
