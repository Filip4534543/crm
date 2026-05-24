import { useState, useMemo } from 'react';

function formatDueDate(iso) {
  if (!iso) return null;
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function TasksPage({ tasks, leads = [], onAdd, onToggle, onDelete }) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [showDone, setShowDone] = useState(true);

  const leadById = useMemo(() => {
    const map = new Map();
    for (const lead of leads) map.set(lead.id, lead);
    return map;
  }, [leads]);

  const active = tasks?.active ?? [];
  const done = tasks?.done ?? [];

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setError('');
    setAdding(true);
    try {
      await onAdd({
        title: title.trim(),
        notes: notes.trim() || undefined,
        due_date: dueDate || undefined,
      });
      setTitle('');
      setNotes('');
      setDueDate('');
    } catch (err) {
      setError(err.message || 'Nie udało się dodać zadania');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="tasks-page">
      <form className="task-add-form" onSubmit={handleSubmit}>
        <h2>Stos zadań</h2>
        <p className="tasks-hint">
          Bez daty — na samej górze stosu. Z datą — najbliższa termin na górze.
        </p>
        <input
          type="text"
          placeholder="Tytuł zadania…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        <textarea
          placeholder="Notatka (opcjonalnie)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
        <label className="task-date-label">Data wykonania (opcjonalnie)</label>
        <input
          type="date"
          className="task-date-input"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        {error && <p className="task-error">{error}</p>}
        <button type="submit" className="btn-primary" disabled={adding || !title.trim()}>
          {adding ? 'Dodawanie…' : 'Wrzuć na stos'}
        </button>
      </form>

      <section className="task-stack-section">
        <div className="task-stack-header">
          <span>Na stosie</span>
          <span className="task-count">{active.length}</span>
        </div>

        {active.length === 0 ? (
          <p className="tasks-empty">Stos pusty — dodaj pierwsze zadanie.</p>
        ) : (
          <div className="task-stack">
            {active.map((task, index) => {
              const linked = task.lead_id ? leadById.get(task.lead_id) : null;
              const linkedName =
                linked?.company_name || linked?.prospect_name || null;
              const dueLabel = formatDueDate(task.due_date);

              return (
                <article
                  key={task.id}
                  className="task-card"
                  style={{
                    '--stack-index': index,
                    zIndex: active.length - index,
                  }}
                >
                  <label className="task-check">
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => onToggle(task.id, true)}
                    />
                    <span className="check-ui" />
                  </label>
                  <div className="task-body">
                    <h3>{task.title}</h3>
                    {dueLabel && (
                      <p className="task-due-date">Termin: {dueLabel}</p>
                    )}
                    {linkedName && (
                      <p className="task-lead-link">Lead: {linkedName}</p>
                    )}
                    {task.notes && <p className="task-notes">{task.notes}</p>}
                  </div>
                  <button
                    type="button"
                    className="task-delete"
                    onClick={() => onDelete(task.id)}
                    title="Usuń"
                  >
                    ×
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {done.length > 0 && (
        <section className="task-done-section">
          <button
            type="button"
            className="task-done-toggle"
            onClick={() => setShowDone((v) => !v)}
          >
            Ukończone ({done.length}) {showDone ? '▾' : '▸'}
          </button>
          {showDone && (
            <ul className="task-done-list">
              {done.map((task) => (
                <li key={task.id} className="task-done-item">
                  <label className="task-check">
                    <input
                      type="checkbox"
                      checked
                      onChange={() => onToggle(task.id, false)}
                    />
                    <span className="check-ui" />
                  </label>
                  <span className="task-done-title">{task.title}</span>
                  <button
                    type="button"
                    className="task-delete"
                    onClick={() => onDelete(task.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
