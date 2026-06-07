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
import { buildActivityStats } from './utils/activityStats';

const THEME_KEY = 'filips-crm-theme';
const CALL_TIMER_KEY = 'filips-crm-call-timer-v1';
const MEETINGS_TODAY_KEY = 'filips-crm-meetings-today-v1';

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

function loadMeetingsTodayState() {
  try {
    const raw = localStorage.getItem(MEETINGS_TODAY_KEY);
    if (!raw) return { dayTotals: {} };
    const parsed = JSON.parse(raw);
    return { dayTotals: parsed?.dayTotals || {} };
  } catch {
    return { dayTotals: {} };
  }
}

function loadCallTimerState() {
  try {
    const raw = localStorage.getItem(CALL_TIMER_KEY);
    if (!raw) return { runningSince: null, dayTotals: {} };
    const parsed = JSON.parse(raw);
    return {
      runningSince: parsed?.runningSince || null,
      dayTotals: parsed?.dayTotals || {},
    };
  } catch {
    return { runningSince: null, dayTotals: {} };
  }
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
  const [tab, setTab] = useState('websites');
  const [tasks, setTasks] = useState({ active: [], done: [] });
  const [deletedLeads, setDeletedLeads] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showManualLeadModal, setShowManualLeadModal] = useState(false);
  const [theme, setTheme] = useState(getInitialTheme);
  const [callTimer, setCallTimer] = useState(loadCallTimerState);
  const [meetingsToday, setMeetingsToday] = useState(loadMeetingsTodayState);
  const [timerTick, setTimerTick] = useState(0);
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
  const activityStats = useMemo(
    () => buildActivityStats(leadsWithMeta, { meetingsTodayByDay: meetingsToday.dayTotals }),
    [leadsWithMeta, meetingsToday.dayTotals]
  );
  const meetingsTodayCount = useMemo(() => {
    const day = dayKeyFromDate();
    return Number(meetingsToday.dayTotals?.[day] || 0);
  }, [meetingsToday.dayTotals]);
  const callSecondsToday = useMemo(() => {
    const day = dayKeyFromDate();
    const base = Number(callTimer.dayTotals?.[day] || 0);
    if (!callTimer.runningSince) return base;
    const started = parseDateLike(callTimer.runningSince);
    if (!started) return base;
    return base + Math.max(0, Math.floor((Date.now() - started.getTime()) / 1000));
  }, [callTimer, timerTick]);
  const inboxCount = useMemo(
    () => leads.filter((l) => (l.pipeline || 'websites') === 'inbox').length,
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

  useEffect(() => {
    try {
      localStorage.setItem(CALL_TIMER_KEY, JSON.stringify(callTimer));
    } catch {
      /* ignore */
    }
  }, [callTimer]);

  useEffect(() => {
    try {
      localStorage.setItem(MEETINGS_TODAY_KEY, JSON.stringify(meetingsToday));
    } catch {
      /* ignore */
    }
  }, [meetingsToday]);

  useEffect(() => {
    if (!callTimer.runningSince) return undefined;
    const interval = setInterval(() => setTimerTick((v) => v + 1), 1000);
    return () => clearInterval(interval);
  }, [callTimer.runningSince]);

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

  function adjustMeetingsToday(delta) {
    setMeetingsToday((current) => {
      const today = dayKeyFromDate();
      const dayTotals = { ...(current.dayTotals || {}) };
      const next = Math.max(0, Number(dayTotals[today] || 0) + delta);
      dayTotals[today] = next;
      return { ...current, dayTotals };
    });
  }

  function toggleCallTimer() {
    setCallTimer((current) => {
      const today = dayKeyFromDate();
      const dayTotals = { ...(current.dayTotals || {}) };
      if (!current.runningSince) {
        return { ...current, runningSince: new Date().toISOString() };
      }
      const started = parseDateLike(current.runningSince);
      const elapsed = started
        ? Math.max(0, Math.floor((Date.now() - started.getTime()) / 1000))
        : 0;
      dayTotals[today] = Number(dayTotals[today] || 0) + elapsed;
      return {
        ...current,
        runningSince: null,
        dayTotals,
      };
    });
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
            className={`tab-btn${tab === 'websites' ? ' active' : ''}`}
            onClick={() => setTab('websites')}
          >
            Websites
          </button>
          <button
            type="button"
            className={`tab-btn${tab === 'seo' ? ' active' : ''}`}
            onClick={() => setTab('seo')}
          >
            SEO
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
            className={`btn-ghost${callTimer.runningSince ? ' active' : ''}`}
            onClick={toggleCallTimer}
          >
            {callTimer.runningSince ? 'Stop call timer' : 'Start call timer'}
          </button>
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
        {(tab === 'websites' || tab === 'seo') && (
          <div className="pipeline-wrap">
            <Pipeline
              pipeline={tab}
              leads={leadsWithMeta}
              tasks={tasks}
              todayStats={{
                ...activityStats.today,
                callMinutes: Math.floor(callSecondsToday / 60),
                meetingsToday: meetingsTodayCount,
              }}
              onMoveStage={handleMoveStage}
              onLeadClick={(lead) => setSelectedLead(lead)}
              onDeleteAllNotContacted={async () => {
                await api.deleteAllNotContacted(tab);
                setSelectedLead(null);
                await refresh();
              }}
              onRemoveDuplicatesNotContacted={async () => {
                const result = await api.removeDuplicatesNotContacted(tab);
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
            tasks={tasks}
            activityStats={activityStats}
            callSecondsToday={callSecondsToday}
            callTimerRunning={Boolean(callTimer.runningSince)}
            onToggleCallTimer={toggleCallTimer}
            meetingsToday={meetingsTodayCount}
            onAdjustMeetingsToday={adjustMeetingsToday}
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
