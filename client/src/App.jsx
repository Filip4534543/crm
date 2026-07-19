import { useState, useEffect, useCallback, useMemo } from 'react';
import { api, getToken, clearToken } from './api';
import Login from './components/Login';
import Pipeline from './components/Pipeline';
import NewLeadsPage from './components/NewLeadsPage';
import StatsPage from './components/StatsPage';
import TasksPage from './components/TasksPage';
import ApiPage from './components/ApiPage';
import DeletedLeadsPage from './components/DeletedLeadsPage';
import LeadDetailModal from './components/LeadDetailModal';
import ManualLeadModal from './components/ManualLeadModal';

const THEME_KEY = 'filips-crm-theme';

function getInitialTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function parseDateLike(value) {
  if (!value) return null;
  const normalized = String(value).includes('T')
    ? String(value)
    : String(value).replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayKeyFromDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function resolveLeadLastContact(lead, tasksByLead) {
  const dates = [];
  const push = (val) => {
    const parsed = parseDateLike(val);
    if (parsed) dates.push(parsed.getTime());
  };
  push(lead.updated_at);
  for (const entry of lead.history || []) {
    push(entry.created_at);
  }
  for (const task of tasksByLead.get(lead.id) || []) {
    push(task.updated_at);
    push(task.created_at);
  }
  if (!dates.length) return null;
  return new Date(Math.max(...dates)).toISOString();
}

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState([]);
  const [tab, setTab] = useState('pipeline');
  const [tasks, setTasks] = useState({ active: [], done: [] });
  const [deletedLeads, setDeletedLeads] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showManualLeadModal, setShowManualLeadModal] = useState(false);
  const [theme, setTheme] = useState(getInitialTheme);
  
  const allTasks = useMemo(() => [...(tasks?.active || []), ...(tasks?.done || [])], [tasks]);
  const leadsWithMeta = useMemo(() => {
    const tasksByLead = new Map();
    for (const task of allTasks) {
      if (task.lead_id == null) continue;
      if (!tasksByLead.has(task.lead_id)) tasksByLead.set(task.lead_id, []);
      tasksByLead.get(task.lead_id).push(task);
    }
    return leads.map((lead) => ({
      ...lead,
      last_contact_at: resolveLeadLastContact(lead, tasksByLead),
    }));
  }, [leads, allTasks]);
  
  const inboxCount = useMemo(
    () => leads.filter((l) => (l.pipeline || 'pipeline') === 'inbox').length,
    [leads]
  );
  
  const nextContactStats = useMemo(() => {
    const today = dayKeyFromDate();
    const planned = (tasks?.active || []).filter(
      (task) => task.lead_id != null && Boolean(task.due_date)
    );
    return {
      planned: planned.length,
      overdue: planned.filter((task) => task.due_date < today).length,
      dueToday: planned.filter((task) => task.due_date === today).length,
      dueFuture: planned.filter((task) => task.due_date > today).length,
    };
  }, [tasks]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const refresh = useCallback(async () => {
    const [leadsData, statsData, deletedData] = await Promise.all([
      api.getLeads(),
      api.getStats(),
      api.getDeletedLeads().catch(() => []),
    ]);
    setLeads(leadsData);
    setStats(statsData);
    setDeletedLeads(Array.isArray(deletedData) ? deletedData : []);
    try {
      const tasksData = await api.getTasks();
      setTasks(tasksData);
    } catch {
      /* stare API bez /tasks — nie psuj reszty aplikacji */
    }
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .checkAuth()
      .then(() => {
        setAuthed(true);
        return refresh();
      })
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    if (!authed) return;
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [authed, refresh]);

  async function handleMoveStage(id, body) {
    const { task, ...moveBody } = body;
    await api.moveStage(id, moveBody);
    if (task?.title?.trim()) {
      await api.createTask({
        title: task.title.trim(),
        notes: task.notes,
        due_date: task.due_date,
        lead_id: task.lead_id ?? id,
      });
    }
    await refresh();
    if (selectedLead?.id === id) {
      const updated = (await api.getLeads()).find((l) => l.id === id);
      if (updated) setSelectedLead(updated);
    }
  }

  async function handleUpdateSum(id, fields) {
    await api.updateLead(id, fields);
    await refresh();
    const updated = (await api.getLeads()).find((l) => l.id === id);
    if (updated) setSelectedLead(updated);
  }

  async function handleCreateLead(body) {
    await api.createLead(body);
    await refresh();
    setShowManualLeadModal(false);
  }

  async function handleAssignPipeline(id, pipeline) {
    await api.assignPipeline(id, pipeline);
    await refresh();
    if (selectedLead?.id === id) setSelectedLead(null);
  }

  async function handleAssignAllInbox(pipeline) {
    await api.assignAllInboxPipeline(pipeline);
    await refresh();
    setSelectedLead(null);
  }

  if (loading) {
    return (
      <div className="login-page">
        <p style={{ color: 'var(--muted)' }}>Ładowanie…</p>
      </div>
    );
  }

  if (!authed) {
    return (
      <Login
        onSuccess={() => {
          setAuthed(true);
          refresh();
        }}
      />
    );
  }

  return (
    <div className="app-layout">
      <header className="app-header">
        <h1>Filip's CRM</h1>
        <nav className="app-tabs">
          <button
            type="button"
            className={`tab-btn${tab === 'new_leads' ? ' active' : ''}`}
            onClick={() => setTab('new_leads')}
          >
            Nowe leady
            {inboxCount > 0 && (
              <span className="tab-badge">{inboxCount}</span>
            )}
          </button>
          <button
            type="button"
            className={`tab-btn${tab === 'pipeline' ? ' active' : ''}`}
            onClick={() => setTab('pipeline')}
          >
            Pipeline
          </button>
          <button
            type="button"
            className={`tab-btn${tab === 'stats' ? ' active' : ''}`}
            onClick={() => setTab('stats')}
          >
            Statystyki
          </button>
          <button
            type="button"
            className={`tab-btn${tab === 'tasks' ? ' active' : ''}`}
            onClick={() => setTab('tasks')}
          >
            Stos
          </button>
          <button
            type="button"
            className={`tab-btn${tab === 'api' ? ' active' : ''}`}
            onClick={() => setTab('api')}
          >
            API
          </button>
          <button
            type="button"
            className={`tab-btn${tab === 'deleted' ? ' active' : ''}`}
            onClick={() => setTab('deleted')}
          >
            Usunięte
          </button>
        </nav>
        <div className="header-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowManualLeadModal(true)}
          >
            Dodaj lead
          </button>
          <button
            type="button"
            className="btn-ghost theme-toggle"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            title={theme === 'dark' ? 'Jasny motyw' : 'Ciemny motyw'}
          >
            {theme === 'dark' ? '☀ Jasny' : '☾ Ciemny'}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => refresh()}
          >
            Odśwież
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              clearToken();
              setAuthed(false);
            }}
          >
            Wyloguj
          </button>
        </div>
      </header>

      <main className="app-main">
        {tab === 'new_leads' && (
          <NewLeadsPage
            leads={leadsWithMeta}
            onAssignPipeline={handleAssignPipeline}
            onAssignAllInbox={handleAssignAllInbox}
            onLeadClick={(lead) => setSelectedLead(lead)}
            onDeleteLead={async (id) => {
              await api.deleteLead(id);
              if (selectedLead?.id === id) setSelectedLead(null);
              await refresh();
            }}
          />
        )}
        {tab === 'pipeline' && (
          <div className="pipeline-wrap">
            <Pipeline
              pipeline="pipeline"
              leads={leadsWithMeta}
              tasks={tasks}
              onMoveStage={handleMoveStage}
              onLeadClick={(lead) => setSelectedLead(lead)}
              onUpdateLead={async (id, fields) => {
                await api.updateLead(id, fields);
                await refresh();
              }}
              onDeleteLead={async (id) => {
                await api.deleteLead(id);
                if (selectedLead?.id === id) setSelectedLead(null);
                await refresh();
              }}
              onDeleteAllNotQualified={async () => {
                await api.deleteAllNotQualified('pipeline');
                setSelectedLead(null);
                await refresh();
              }}
              onRemoveDuplicatesNotQualified={async () => {
                const result = await api.removeDuplicatesNotQualified('pipeline');
                await refresh();
                return result;
              }}
            />
          </div>
        )}
        {tab === 'stats' && (
          <StatsPage
            stats={stats}
            leads={leadsWithMeta}
            deletedLeads={deletedLeads}
            tasks={tasks}
            nextContactStats={nextContactStats}
          />
        )}
        {tab === 'api' && <ApiPage onWebhookSuccess={refresh} />}
        {tab === 'deleted' && (
          <DeletedLeadsPage
            leads={deletedLeads}
            onRestore={async (deletedId) => {
              await api.restoreDeletedLead(deletedId);
              await refresh();
            }}
            onDeletePermanent={async (deletedId) => {
              await api.deleteDeletedLead(deletedId);
              await refresh();
            }}
          />
        )}
        {tab === 'tasks' && (
          <TasksPage
            tasks={tasks}
            leads={leadsWithMeta}
            onLeadPreview={(lead) => setSelectedLead(lead)}
            onAdd={async (body) => {
              await api.createTask(body);
              await refresh();
            }}
            onToggle={async (id, done) => {
              await api.updateTask(id, { done });
              await refresh();
            }}
            onDelete={async (id) => {
              await api.deleteTask(id);
              await refresh();
            }}
          />
        )}
      </main>

      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdateSum={handleUpdateSum}
          onDelete={async (id) => {
            await api.deleteLead(id);
            setSelectedLead(null);
            await refresh();
          }}
        />
      )}

      {showManualLeadModal && (
        <ManualLeadModal
          onClose={() => setShowManualLeadModal(false)}
          onSubmit={handleCreateLead}
        />
      )}
    </div>
  );
}
