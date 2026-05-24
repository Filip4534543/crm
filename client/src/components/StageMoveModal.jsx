import { useState } from 'react';
import { STAGE_MAP } from '../constants';

export default function StageMoveModal({ lead, toStage, onConfirm, onCancel }) {
  const [description, setDescription] = useState('');
  const [agreedSum, setAgreedSum] = useState(
    lead.agreed_sum != null ? String(lead.agreed_sum) : ''
  );
  const [addTask, setAddTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskNotes, setTaskNotes] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');

  const fromLabel = STAGE_MAP[lead.stage]?.label || lead.stage;
  const toLabel = STAGE_MAP[toStage]?.label || toStage;
  const leadName = lead.company_name || lead.prospect_name || 'Lead';

  function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      description: description.trim() || null,
      agreed_sum: agreedSum !== '' ? parseFloat(agreedSum) : undefined,
    };
    if (addTask && taskTitle.trim()) {
      payload.task = {
        title: taskTitle.trim(),
        notes: taskNotes.trim() || undefined,
        due_date: taskDueDate || undefined,
        lead_id: lead.id,
      };
    }
    onConfirm(payload);
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2>Przenieś lead</h2>
        <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--muted)' }}>
          <strong>{leadName}</strong>
          <br />
          {fromLabel} → {toLabel}
        </p>

        <label>Opis (opcjonalnie)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Notatka z tego przeniesienia…"
          autoFocus
        />

        <label>Umówiona suma (PLN)</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={agreedSum}
          onChange={(e) => setAgreedSum(e.target.value)}
          placeholder="0.00"
        />

        {toStage === 'win' && (
          <p style={{ fontSize: '0.8125rem', color: 'var(--success)', marginBottom: '1rem' }}>
            Po przeniesieniu do Win umówiona suma stanie się zarobkiem.
          </p>
        )}

        <div className="stage-move-task-block">
          <label className="task-inline-check">
            <input
              type="checkbox"
              checked={addTask}
              onChange={(e) => setAddTask(e.target.checked)}
            />
            Dodaj zadanie na stos (przypisane do tego leada)
          </label>
          {addTask && (
            <div className="stage-move-task-fields">
              <label>Tytuł zadania</label>
              <input
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder={`np. Oddzwonić do ${leadName}`}
              />
              <label>Notatka (opcjonalnie)</label>
              <textarea
                value={taskNotes}
                onChange={(e) => setTaskNotes(e.target.value)}
                rows={2}
                placeholder="Szczegóły…"
              />
              <label>Data wykonania (opcjonalnie)</label>
              <input
                type="date"
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Anuluj
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={addTask && !taskTitle.trim()}
          >
            Przenieś
          </button>
        </div>
      </form>
    </div>
  );
}
