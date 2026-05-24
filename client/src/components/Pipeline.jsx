import { useState, useRef, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import { STAGES } from '../constants';
import LeadCard from './LeadCard';
import StageMoveModal from './StageMoveModal';
import StageShortcuts from './StageShortcuts';

function StageColumn({ stage, leads, setColumnRef, children }) {
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
      </div>
      <div className={`stage-cards${isOver ? ' drag-over' : ''}`}>{children}</div>
    </div>
  );
}

function resolveDropStage(overId) {
  if (!overId) return null;
  const id = String(overId);
  if (id.startsWith('shortcut-')) return id.slice(9);
  if (STAGES.some((s) => s.id === id)) return id;
  return null;
}

export default function Pipeline({ leads, onMoveStage, onLeadClick }) {
  const [activeLead, setActiveLead] = useState(null);
  const [pendingMove, setPendingMove] = useState(null);
  const [didDrag, setDidDrag] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [focusedStageId, setFocusedStageId] = useState(null);
  const [dragOverStageId, setDragOverStageId] = useState(null);
  const columnRefs = useRef({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const byStage = Object.fromEntries(STAGES.map((s) => [s.id, []]));
  const counts = Object.fromEntries(STAGES.map((s) => [s.id, 0]));
  for (const lead of leads) {
    if (byStage[lead.stage]) {
      byStage[lead.stage].push(lead);
      counts[lead.stage]++;
    }
  }

  function scrollToStage(stageId) {
    const col = columnRefs.current[stageId];
    const scroller = col?.closest('.pipeline-scroll');
    if (col && scroller) {
      const left =
        col.offsetLeft - scroller.offsetLeft - 12;
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
    const toStage = resolveDropStage(event.over?.id);
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
    const toStage = resolveDropStage(over.id);
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

  async function confirmMove({ description, agreed_sum }) {
    if (!pendingMove) return;
    const { lead, toStage } = pendingMove;
    setPendingMove(null);
    await onMoveStage(lead.id, { stage: toStage, description, agreed_sum });
    const updated = leads.find((l) => l.id === lead.id);
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
            stages={STAGES}
            counts={counts}
            selectedLead={selectedLead}
            focusedStageId={focusedStageId}
            dragOverStageId={dragOverStageId}
            onStageClick={handleStageShortcutClick}
          />
          <div className="pipeline-scroll">
            <div className="pipeline">
              {STAGES.map((stage) => (
                <StageColumn
                  key={stage.id}
                  stage={stage}
                  leads={byStage[stage.id]}
                  setColumnRef={(el) => {
                    columnRefs.current[stage.id] = el;
                  }}
                >
                  {byStage[stage.id].map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      selected={selectedLead?.id === lead.id}
                      onClick={handleLeadClick}
                      onDoubleClick={handleLeadDoubleClick}
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
