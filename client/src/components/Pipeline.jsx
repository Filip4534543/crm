import { useState, useRef, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import { PIPELINE_STAGES } from '../constants';
import LeadCard from './LeadCard';
import StageMoveModal from './StageMoveModal';
import StageShortcuts from './StageShortcuts';

function StageColumn({
  stage,
  leads,
  setColumnRef,
  children,
  bulkActions,
  bulkBusy,
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  const setRef = useCallback(
    (node) => {
      setNodeRef(node);
      setColumnRef?.(node);
    },
    [setNodeRef, setColumnRef]
  );

  return (
    <div
      ref={setRef}
      className="stage-column"
      style={{ '--stage-color': stage.color }}
      data-stage-id={stage.id}
    >
      <div className="stage-header">
        <h3>{stage.label}</h3>
        <div className="badge">{leads.length} leadów</div>
        {bulkActions && leads.length > 0 && (
          <div className="stage-bulk-actions">
            <button
              type="button"
              className="btn-stage-mini"
              disabled={bulkBusy}
              onClick={bulkActions.onDedupe}
            >
              Usuń duplikaty
            </button>
            <button
              type="button"
              className="btn-stage-mini btn-stage-mini--danger"
              disabled={bulkBusy}
              onClick={bulkActions.onDeleteAll}
            >
              Usuń wszystkie
            </button>
          </div>
        )}
      </div>
      <div className={`stage-cards${isOver ? ' drag-over' : ''}`}>{children}</div>
    </div>
  );
}

function resolveDropStage(overId, stages) {
  if (!overId) return null;
  const id = String(overId);
  if (id.startsWith('shortcut-')) return id.slice(9);
  if (stages.some((s) => s.id === id)) return id;
  return null;
}

export default function Pipeline({
  pipeline = 'pipeline',
  leads,
  tasks,
  todayStats,
  onMoveStage,
  onLeadClick,
  onUpdateLead,
  onDeleteLead,
  onDeleteAllNotQualified,
  onRemoveDuplicatesNotQualified,
}) {
  const stages = PIPELINE_STAGES;

  const pipelineLeads = leads.filter(
    (lead) => (lead.pipeline || 'pipeline') === pipeline
  );
  const [activeLead, setActiveLead] = useState(null);
  const [pendingMove, setPendingMove] = useState(null);
  const [didDrag, setDidDrag] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [focusedStageId, setFocusedStageId] = useState(null);
  const [dragOverStageId, setDragOverStageId] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const columnRefs = useRef({});
  const allTasks = [...(tasks?.active || []), ...(tasks?.done || [])];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const byStage = Object.fromEntries(stages.map((s) => [s.id, []]));
  const counts = Object.fromEntries(stages.map((s) => [s.id, 0]));
  for (const lead of pipelineLeads) {
    if (byStage[lead.stage]) {
      byStage[lead.stage].push(lead);
      counts[lead.stage]++;
    }
  }

  function scrollToStage(stageId) {
    const col = columnRefs.current[stageId];
    const scroller = col?.closest('.pipeline-scroll');
    if (col && scroller) {
      const left = col.offsetLeft - scroller.offsetLeft - 12;
      scroller.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    }
    setFocusedStageId(stageId);
  }

  function requestMove(lead, toStage) {
    if (!lead || !toStage || lead.stage === toStage) return;
    setPendingMove({ lead, toStage });
  }

  function handleStageShortcutClick(stageId) {
    scrollToStage(stageId);
    if (selectedLead) {
      requestMove(selectedLead, stageId);
    }
  }

  function handleDragStart(event) {
    setDidDrag(true);
    const lead = event.active.data.current?.lead;
    if (lead) {
      setActiveLead(lead);
      setSelectedLead(lead);
    }
  }

  function handleDragOver(event) {
    const toStage = resolveDropStage(event.over?.id, stages);
    setDragOverStageId(toStage);
  }

  function handleDragEnd(event) {
    setActiveLead(null);
    setDragOverStageId(null);
    const { active, over } = event;
    if (!over) {
      setTimeout(() => setDidDrag(false), 0);
      return;
    }

    const lead = active.data.current?.lead;
    const toStage = resolveDropStage(over.id, stages);
    if (!lead || !toStage || lead.stage === toStage) {
      setTimeout(() => setDidDrag(false), 0);
      return;
    }

    requestMove(lead, toStage);
    setTimeout(() => setDidDrag(false), 0);
  }

  function handleLeadClick(lead) {
    if (didDrag) return;
    setSelectedLead(lead);
  }

  function handleLeadDoubleClick(lead) {
    if (didDrag) return;
    onLeadClick?.(lead);
  }

  const notQualifiedCount = counts.not_qualified ?? 0;

  async function handleDeleteAllNotQualified() {
    if (notQualifiedCount === 0) return;
    if (
      !window.confirm(
        `Usunąć wszystkie ${notQualifiedCount} leadów ze stage „Not Qualified"? Tej operacji nie można cofnąć.`
      )
    ) {
      return;
    }
    setBulkBusy(true);
    try {
      await onDeleteAllNotQualified?.();
      if (selectedLead?.stage === 'not_qualified') setSelectedLead(null);
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleRemoveDuplicatesNotQualified() {
    if (notQualifiedCount === 0) return;
    if (
      !window.confirm(
        'Usunąć duplikaty w „Not Qualified"? Zostanie najstarszy lead.'
      )
    ) {
      return;
    }
    setBulkBusy(true);
    try {
      const result = await onRemoveDuplicatesNotQualified?.();
      if (result?.deleted === 0) {
        window.alert('Nie znaleziono duplikatów do usunięcia.');
      }
      if (selectedLead?.stage === 'not_qualified') {
        const still = pipelineLeads.find((l) => l.id === selectedLead.id);
        if (!still) setSelectedLead(null);
      }
    } finally {
      setBulkBusy(false);
    }
  }

  function getBulkActionsForStage(stageId) {
    if (stageId === 'not_qualified') {
      return {
        onDeleteAll: handleDeleteAllNotQualified,
        onDedupe: handleRemoveDuplicatesNotQualified,
      };
    }
    return null;
  }

  async function confirmMove({ description, agreed_sum, task }) {
    if (!pendingMove) return;
    const { lead, toStage } = pendingMove;
    setPendingMove(null);
    await onMoveStage(lead.id, { stage: toStage, description, agreed_sum, task });
    const updated = pipelineLeads.find((l) => l.id === lead.id);
    if (updated) setSelectedLead({ ...updated, stage: toStage });
    else setSelectedLead(null);
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="pipeline-layout">
          <StageShortcuts
            stages={stages}
            counts={counts}
            todayStats={todayStats}
            selectedLead={selectedLead}
            focusedStageId={focusedStageId}
            dragOverStageId={dragOverStageId}
            onStageClick={handleStageShortcutClick}
          />
          <div className="pipeline-scroll">
            <div className="pipeline">
              {stages.map((stage) => (
                <StageColumn
                  key={stage.id}
                  stage={stage}
                  leads={byStage[stage.id]}
                  bulkBusy={bulkBusy}
                  bulkActions={getBulkActionsForStage(stage.id)}
                  setColumnRef={(el) => {
                    columnRefs.current[stage.id] = el;
                  }}
                >
                  {byStage[stage.id].map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      tasks={allTasks.filter((task) => task.lead_id === lead.id)}
                      selected={selectedLead?.id === lead.id}
                      showDelete={lead.stage === 'not_qualified'}
                      showInlineEdit
                      onClick={handleLeadClick}
                      onDoubleClick={handleLeadDoubleClick}
                      onDelete={onDeleteLead}
                      onUpdate={onUpdateLead}
                    />
                  ))}
                </StageColumn>
              ))}
            </div>
          </div>
        </div>
        <DragOverlay>
          {activeLead ? (
            <div className="lead-card" style={{ cursor: 'grabbing' }}>
              <h4>{activeLead.company_name || activeLead.prospect_name}</h4>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {pendingMove && (
        <StageMoveModal
          lead={pendingMove.lead}
          toStage={pendingMove.toStage}
          onConfirm={confirmMove}
          onCancel={() => setPendingMove(null)}
        />
      )}
    </>
  );
}
