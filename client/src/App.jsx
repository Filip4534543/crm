import { useState, useEffect, useCallback } from 'react';
import { api, getToken, clearToken } from './api';
import Login from './components/Login';
import Pipeline from './components/Pipeline';
import StatsPage from './components/StatsPage';
import TasksPage from './components/TasksPage';
import ApiPage from './components/ApiPage';
import LeadDetailModal from './components/LeadDetailModal';

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState([]);
  const [tab, setTab] = useState('pipeline');
  const [tasks, setTasks] = useState({ active: [], done: [] });
  const [selectedLead, setSelectedLead] = useState(null);

  const refresh = useCallback(async () => {
    const [leadsData, statsData] = await Promise.all([
      api.getLeads(),
      api.getStats(),
    ]);
    setLeads(leadsData);
    setStats(statsData);
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
    await api.moveStage(id, body);
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
        </nav>
        <div className="header-actions">
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
        {tab === 'pipeline' && (
          <div className="pipeline-wrap">
            <Pipeline
              leads={leads}
              onMoveStage={handleMoveStage}
              onLeadClick={(lead) => setSelectedLead(lead)}
            />
          </div>
        )}
        {tab === 'stats' && <StatsPage stats={stats} leads={leads} />}
        {tab === 'api' && <ApiPage onWebhookSuccess={refresh} />}
        {tab === 'tasks' && (
          <TasksPage
            tasks={tasks}
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
        />
      )}
    </div>
  );
}
