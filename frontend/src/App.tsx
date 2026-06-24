import React, { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';
import {
  Bot, Send, Square, Loader2, FolderOpen, FileText, ChevronRight,
  RefreshCw, Save, RotateCcw, Zap, Shield,
  Terminal, Cpu, Database, Search, CheckCircle2,
  XCircle, HelpCircle, MessageSquare, Code2,
  Eye, EyeOff, Copy, Check
} from 'lucide-react';

// ─── Types ───

interface FileItem {
  name: string;
  dir: boolean;
  size: number;
  mtime: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'error';
  content?: string;
  thinking?: string;
  plan?: PlanStep[];
  tools?: ToolExecution[];
  question?: QuestionData;
  timestamp: Date;
}

interface PlanStep {
  action: string;
  path: string;
  content: string;
}

interface ToolExecution {
  id: string;
  action: string;
  path: string;
  status: 'pending' | 'running' | 'done' | 'error' | 'question';
  result?: string;
  error?: string;
  rconResponse?: string;
  elapsed?: number;
}

interface QuestionData {
  question: string;
  options: string[];
  context: string;
  session_id: string;
}

interface ConnectionConfig {
  provider: string;
  model: string;
  apiKey: string;
  host: string;
  port: number;
  user: string;
  password: string;
  rconPass: string;
  rconHost: string;
  gamePort: number;
}

interface ProviderDef {
  id: string;
  label: string;
  url: string;
  models: string[];
  keyPlaceholder: string;
  keyHint?: string;
  freeNote?: string;
}

const PROVIDERS: ProviderDef[] = [
  {
    id: 'opencode',
    label: 'OpenCode (free)',
    url: 'https://opencode.ai/zen/v1/chat/completions',
    models: ['big-pickle'],
    keyPlaceholder: 'oc-...',
    keyHint: 'https://opencode.ai/auth',
    freeNote: 'free',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    url: 'https://api.anthropic.com/v1/messages',
    models: [
      'claude-opus-4-5',
      'claude-sonnet-4-5',
      'claude-3-7-sonnet-20250219',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-haiku-20240307',
    ],
    keyPlaceholder: 'sk-ant-...',
    keyHint: 'https://console.anthropic.com/settings/api-keys',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    url: 'https://api.openai.com/v1/chat/completions',
    models: ['o3', 'o4-mini', 'gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini', 'o3-mini', 'gpt-4-turbo'],
    keyPlaceholder: 'sk-...',
    keyHint: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    models: [
      'gemini-2.5-pro-preview-06-05',
      'gemini-2.5-flash-preview-05-20',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-pro',
    ],
    keyPlaceholder: 'AIza...',
    keyHint: 'https://aistudio.google.com/app/apikey',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    url: 'https://api.deepseek.com/v1/chat/completions',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    keyPlaceholder: 'sk-...',
    keyHint: 'https://platform.deepseek.com',
  },
  {
    id: 'groq',
    label: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    models: [
      'llama-3.3-70b-versatile',
      'llama4-maverick-17b-128e-instruct',
      'llama4-scout-17b-16e-instruct',
      'qwen-qwq-32b',
      'llama-3.1-70b-versatile',
      'mixtral-8x7b-32768',
      'gemma2-9b-it',
    ],
    keyPlaceholder: 'gsk_...',
    keyHint: 'https://console.groq.com/keys',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    url: 'https://api.mistral.ai/v1/chat/completions',
    models: ['mistral-large-latest', 'mistral-medium-latest', 'codestral-latest', 'open-mistral-nemo'],
    keyPlaceholder: '...',
    keyHint: 'https://console.mistral.ai/api-keys',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter (all models)',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    models: ['__custom__'],
    keyPlaceholder: 'sk-or-...',
    keyHint: 'https://openrouter.ai/keys',
  },
];

// ─── Constants ───

const TOOL_ICONS: Record<string, React.ReactNode> = {
  read: <FileText size={14} />,
  write: <Code2 size={14} />,
  edit: <Terminal size={14} />,
  delete: <XCircle size={14} />,
  ls: <FolderOpen size={14} />,
  mkdir: <FolderOpen size={14} />,
  move: <ChevronRight size={14} />,
  copy: <Copy size={14} />,
  rename: <RefreshCw size={14} />,
  chmod: <Shield size={14} />,
  rcon: <Zap size={14} />,
  exec: <Cpu size={14} />,
  search: <Search size={14} />,
  search_content: <Search size={14} />,
  append: <ChevronRight size={14} />,
  batch_read: <Database size={14} />,
  info: <Eye size={14} />,
  verify: <CheckCircle2 size={14} />,
  ask_user: <HelpCircle size={14} />,
  read_local: <FileText size={14} />,
  write_local: <Code2 size={14} />,
  list_local: <FolderOpen size={14} />,
  compile_plugin: <Cpu size={14} />,
  web_search: <Search size={14} />,
  web_fetch: <Eye size={14} />,
  download_file: <ChevronRight size={14} />,
  git_clone: <Database size={14} />,
};

const DEFAULT_CONFIG: ConnectionConfig = {
  provider: 'opencode',
  model: 'big-pickle',
  apiKey: '',
  host: '40.lemehost.com',
  port: 2022,
  user: 'user_24946.8a0f391a',
  password: '',
  rconPass: '',
  rconHost: '51.83.49.125',
  gamePort: 27015,
};

// ─── Icosahedron Component ───

function Icosahedron() {
  return (
    <div className="scene">
      <div className="icosahedron">
        {Array.from({ length: 20 }, (_, i) => (
          <div key={i} className={`face f${i + 1}`} />
        ))}
      </div>
    </div>
  );
}

// ─── Setup Screen ───

const REMEMBER_KEY = 'cs16_remember_config';

function SetupScreen({ onConnect }: { onConnect: (config: ConnectionConfig) => void }) {
  const [config, setConfig] = useState<ConnectionConfig>(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure all fields exist (merge with defaults for new fields)
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch {}
    return DEFAULT_CONFIG;
  });
  const [remember, setRemember] = useState(() => !!localStorage.getItem(REMEMBER_KEY));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const update = (field: keyof ConnectionConfig, value: string | number) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const activeProv = PROVIDERS.find(p => p.id === config.provider) ?? PROVIDERS[0];
  const isCustomModel = activeProv.models[0] === '__custom__';

  const handleConnect = async () => {
    if (!config.apiKey || !config.host || !config.user) {
      setError('Please fill in API Key, SFTP Host, and User');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const r = await api('POST', '/api/setup/test', {
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        rconPass: config.rconPass,
        rconHost: config.rconHost,
        gamePort: config.gamePort,
      });

      if (!r.ok) {
        setError('SFTP: ' + (r.sftp || 'Connection failed'));
        setLoading(false);
        return;
      }

      await api('POST', '/api/config', {
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        rconPass: config.rconPass,
        rconHost: config.rconHost,
        gamePort: config.gamePort,
      });

      if (remember) {
        localStorage.setItem(REMEMBER_KEY, JSON.stringify(config));
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }

      onConnect(config);
    } catch (e: any) {
      setError('Connection error: ' + e.message);
    }
    setLoading(false);
  };

  return (
    <div className="w-full h-screen flex items-center justify-center relative" style={{ background: '#050505' }}>
      {/* Icosahedron Background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
        <div className="w-[400px] h-[400px]">
          <Icosahedron />
        </div>
      </div>

      {/* Setup Card */}
      <div
        className="relative z-10 w-[480px] rounded-xl p-7 scale-in"
        style={{
          background: '#0A0A0A',
          border: '1px solid #1A1A1A',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
        }}
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7C6CF0, #5A4BD1)' }}>
            <Bot size={20} color="#fff" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">CS 1.6 AI Agent</h2>
            <p className="text-xs" style={{ color: '#555' }}>Connect to your server</p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Provider + Model row */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: '#888' }}>AI Provider</label>
              <select
                value={config.provider}
                onChange={e => {
                  const prov = PROVIDERS.find(p => p.id === e.target.value) ?? PROVIDERS[0];
                  setConfig(prev => ({
                    ...prev,
                    provider: prov.id,
                    model: prov.models[0] === '__custom__' ? '' : prov.models[0],
                  }));
                  setError('');
                }}
                className="w-full rounded-md px-3 py-[7px] text-xs outline-none transition-colors"
                style={{ background: '#050505', border: '1px solid #2A2A2A', color: '#E0E0E0', cursor: 'pointer' }}
                onFocus={e => e.currentTarget.style.borderColor = '#7C6CF0'}
                onBlur={e => e.currentTarget.style.borderColor = '#2A2A2A'}
              >
                {PROVIDERS.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: '#888' }}>Model</label>
              {isCustomModel ? (
                <input
                  type="text"
                  value={config.model}
                  onChange={e => update('model', e.target.value)}
                  placeholder="e.g. anthropic/claude-3.5-sonnet"
                  className="w-full rounded-md px-3 py-[7px] text-xs outline-none transition-colors"
                  style={{ background: '#050505', border: '1px solid #2A2A2A', color: '#E0E0E0' }}
                  onFocus={e => e.target.style.borderColor = '#7C6CF0'}
                  onBlur={e => e.target.style.borderColor = '#2A2A2A'}
                />
              ) : (
                <select
                  value={config.model}
                  onChange={e => update('model', e.target.value)}
                  className="w-full rounded-md px-3 py-[7px] text-xs outline-none transition-colors"
                  style={{ background: '#050505', border: '1px solid #2A2A2A', color: '#E0E0E0', cursor: 'pointer' }}
                  onFocus={e => e.currentTarget.style.borderColor = '#7C6CF0'}
                  onBlur={e => e.currentTarget.style.borderColor = '#2A2A2A'}
                >
                  {activeProv.models.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: '#888' }}>
              API Key
              {activeProv.freeNote && (
                <span style={{ color: '#4CAF50', marginLeft: 6, textTransform: 'none' }}>{activeProv.freeNote}</span>
              )}
              {activeProv.keyHint && (
                <a href={activeProv.keyHint} target="_blank" rel="noreferrer" style={{ color: '#7C6CF0', marginLeft: 6, textTransform: 'none' }}>
                  get key ↗
                </a>
              )}
            </label>
            <input
              type="password"
              value={config.apiKey}
              onChange={e => update('apiKey', e.target.value)}
              placeholder={activeProv.keyPlaceholder}
              className="w-full rounded-md px-3 py-[7px] text-xs outline-none transition-colors"
              style={{ background: '#050505', border: '1px solid #2A2A2A', color: '#E0E0E0' }}
              onFocus={e => e.target.style.borderColor = '#7C6CF0'}
              onBlur={e => e.target.style.borderColor = '#2A2A2A'}
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: '#888' }}>SFTP Host</label>
            <input
              type="text"
              value={config.host}
              onChange={e => update('host', e.target.value)}
              className="w-full rounded-md px-3 py-[7px] text-xs outline-none transition-colors"
              style={{ background: '#050505', border: '1px solid #2A2A2A', color: '#E0E0E0' }}
              onFocus={e => e.target.style.borderColor = '#7C6CF0'}
              onBlur={e => e.target.style.borderColor = '#2A2A2A'}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: '#888' }}>Port</label>
              <input
                type="number"
                value={config.port}
                onChange={e => update('port', parseInt(e.target.value) || 2022)}
                className="w-full rounded-md px-3 py-[7px] text-xs outline-none transition-colors"
                style={{ background: '#050505', border: '1px solid #2A2A2A', color: '#E0E0E0' }}
                onFocus={e => e.target.style.borderColor = '#7C6CF0'}
                onBlur={e => e.target.style.borderColor = '#2A2A2A'}
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: '#888' }}>User</label>
              <input
                type="text"
                value={config.user}
                onChange={e => update('user', e.target.value)}
                className="w-full rounded-md px-3 py-[7px] text-xs outline-none transition-colors"
                style={{ background: '#050505', border: '1px solid #2A2A2A', color: '#E0E0E0' }}
                onFocus={e => e.target.style.borderColor = '#7C6CF0'}
                onBlur={e => e.target.style.borderColor = '#2A2A2A'}
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: '#888' }}>SFTP Password</label>
            <input
              type="password"
              value={config.password}
              onChange={e => update('password', e.target.value)}
              className="w-full rounded-md px-3 py-[7px] text-xs outline-none transition-colors"
              style={{ background: '#050505', border: '1px solid #2A2A2A', color: '#E0E0E0' }}
              onFocus={e => e.target.style.borderColor = '#7C6CF0'}
              onBlur={e => e.target.style.borderColor = '#2A2A2A'}
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: '#888' }}>RCON Password</label>
            <input
              type="password"
              value={config.rconPass}
              onChange={e => update('rconPass', e.target.value)}
              className="w-full rounded-md px-3 py-[7px] text-xs outline-none transition-colors"
              style={{ background: '#050505', border: '1px solid #2A2A2A', color: '#E0E0E0' }}
              onFocus={e => e.target.style.borderColor = '#7C6CF0'}
              onBlur={e => e.target.style.borderColor = '#2A2A2A'}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: '#888' }}>Game Server IP</label>
              <input
                type="text"
                value={config.rconHost}
                onChange={e => update('rconHost', e.target.value)}
                className="w-full rounded-md px-3 py-[7px] text-xs outline-none transition-colors"
                style={{ background: '#050505', border: '1px solid #2A2A2A', color: '#E0E0E0' }}
                onFocus={e => e.target.style.borderColor = '#7C6CF0'}
                onBlur={e => e.target.style.borderColor = '#2A2A2A'}
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: '#888' }}>Game Port</label>
              <input
                type="number"
                value={config.gamePort}
                onChange={e => update('gamePort', parseInt(e.target.value) || 27015)}
                className="w-full rounded-md px-3 py-[7px] text-xs outline-none transition-colors"
                style={{ background: '#050505', border: '1px solid #2A2A2A', color: '#E0E0E0' }}
                onFocus={e => e.target.style.borderColor = '#7C6CF0'}
                onBlur={e => e.target.style.borderColor = '#2A2A2A'}
              />
            </div>
          </div>

          {/* Remember Me */}
          <label
            className="flex items-center gap-2 cursor-pointer select-none py-0.5"
            style={{ color: '#888' }}
          >
            <div
              onClick={() => setRemember(!remember)}
              className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center transition-colors"
              style={{
                background: remember ? '#7C6CF0' : 'transparent',
                border: remember ? 'none' : '1px solid #444',
                cursor: 'pointer',
              }}
            >
              {remember && <Check size={10} color="#fff" />}
            </div>
            <span
              className="text-[11px]"
              style={{ color: remember ? '#E0E0E0' : '#666' }}
            >
              Remember me — save all fields (including API key) for next time
            </span>
          </label>

          <button
            onClick={handleConnect}
            disabled={loading}
            className="w-full rounded-lg py-2.5 text-xs font-semibold text-white transition-all mt-2 flex items-center justify-center gap-2"
            style={{
              background: loading ? '#4A4A4A' : '#7C6CF0',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            {loading ? 'Connecting...' : 'Connect'}
          </button>

          {error && (
            <div className="text-xs px-3 py-2 rounded-md fade-in" style={{ background: '#2A1414', color: '#EF9A9A', border: '1px solid #C62828' }}>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── API Helper ───

async function api(method: string, endpoint: string, body?: any) {
  try {
    const opts: RequestInit = { method, headers: {} };
    if (body) {
      (opts.headers as Record<string, string>)['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const r = await fetch(endpoint, opts);
    return await r.json();
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ─── File Tree Component ───

function FileTree({ onFileOpen, refreshTrigger }: { onFileOpen: (path: string) => void; refreshTrigger: number }) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState('.');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadFiles = useCallback(async (path: string) => {
    setLoading(true);
    setError('');
    const r = await api('POST', '/api/sftp/ls', { path });
    if (r.ok) {
      setFiles(r.files || []);
      setCurrentPath(path);
    } else {
      setError(r.error || 'Failed to load');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadFiles(currentPath);
  }, [refreshTrigger]);

  const navigateUp = () => {
    if (currentPath !== '.') {
      const parts = currentPath.split('/');
      parts.pop();
      loadFiles(parts.length === 0 ? '.' : parts.join('/'));
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: '#111111' }}>
      <div className="flex items-center justify-between px-2.5 py-2" style={{ borderBottom: '1px solid #222' }}>
        <span className="text-[9px] uppercase tracking-widest font-medium" style={{ color: '#666' }}>Files</span>
        <div className="flex gap-1">
          {currentPath !== '.' && (
            <button
              onClick={navigateUp}
              className="p-1 rounded transition-colors hover:bg-[#1A1A1A]"
              title="Go up"
            >
              <ChevronRight size={12} style={{ color: '#888', transform: 'rotate(180deg)' }} />
            </button>
          )}
          <button
            onClick={() => loadFiles(currentPath)}
            className="p-1 rounded transition-colors hover:bg-[#1A1A1A]"
            title="Refresh"
          >
            <RefreshCw size={10} style={{ color: '#888' }} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-0.5">
        {loading ? (
          <div className="p-3 text-center text-xs" style={{ color: '#555' }}>Loading...</div>
        ) : error ? (
          <div className="p-3 text-xs" style={{ color: '#EF9A9A' }}>{error}</div>
        ) : (
          <>
            {currentPath !== '.' && (
              <div
                onClick={navigateUp}
                className="flex items-center gap-2 px-2.5 py-[3px] cursor-pointer transition-all"
                style={{ borderLeft: '2px solid transparent', color: '#999' }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#1A1A1A';
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.borderLeftColor = '#7C6CF0';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#999';
                  e.currentTarget.style.borderLeftColor = 'transparent';
                }}
              >
                <FolderOpen size={14} style={{ color: '#7C6CF0', transform: 'rotate(180deg)' }} />
                <span className="text-xs">..</span>
              </div>
            )}
            {files.map((f, i) => {
              const fp = (currentPath === '.' ? '' : currentPath) + '/' + f.name;
              return (
                <div
                  key={i}
                  onClick={() => f.dir ? loadFiles(fp) : onFileOpen(fp)}
                  className="flex items-center gap-2 px-2.5 py-[3px] cursor-pointer transition-all slide-in"
                  style={{
                    borderLeft: '2px solid transparent',
                    color: '#999',
                    animationDelay: `${i * 15}ms`,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#1A1A1A';
                    e.currentTarget.style.color = '#fff';
                    e.currentTarget.style.borderLeftColor = '#7C6CF0';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#999';
                    e.currentTarget.style.borderLeftColor = 'transparent';
                  }}
                >
                  {f.dir ? (
                    <FolderOpen size={14} style={{ color: '#7C6CF0' }} />
                  ) : (
                    <FileText size={14} style={{ color: '#777' }} />
                  )}
                  <span className="text-xs truncate flex-1">{f.name}</span>
                  {!f.dir && (
                    <span className="text-[10px] ml-auto" style={{ color: '#555' }}>
                      {f.size > 1024 ? Math.round(f.size / 1024) + 'KB' : f.size + 'B'}
                    </span>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Tool Card Component ───

function ToolCard({ tool }: { tool: ToolExecution }) {
  const [expanded, setExpanded] = useState(false);

  const borderColor = {
    pending: '#444',
    running: '#7C6CF0',
    done: '#2E7D32',
    error: '#C62828',
    question: '#E65100',
  }[tool.status];

  const statusBg = {
    pending: 'transparent',
    running: 'transparent',
    done: '#2E7D32',
    error: '#C62828',
    question: '#E65100',
  }[tool.status];

  return (
    <div
      className="rounded-md p-2 transition-all fade-in"
      style={{
        background: '#111111',
        border: `1px solid ${borderColor}`,
      }}
    >
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <span style={{ color: '#888' }}>{TOOL_ICONS[tool.action] || <Terminal size={14} />}</span>
        <span className="text-[10px] font-semibold uppercase min-w-[50px]" style={{ color: '#7C6CF0' }}>
          {tool.action}
        </span>
        <span className="text-[11px] font-mono truncate flex-1" style={{ color: '#AAA' }}>
          {tool.path}
        </span>
        <div className="flex items-center gap-2">
          {tool.elapsed && (
            <span className="text-[10px]" style={{ color: '#555' }}>{tool.elapsed}s</span>
          )}
          <div
            className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background: statusBg,
              border: tool.status === 'pending' ? '2px solid #444' :
                      tool.status === 'running' ? '2px solid #7C6CF0' :
                      'none',
              borderTopColor: tool.status === 'running' ? 'transparent' : undefined,
              animation: tool.status === 'running' ? 'spin 0.5s linear infinite' : 'none',
            }}
          >
            {tool.status === 'done' && <Check size={10} color="#fff" />}
            {tool.status === 'error' && <XCircle size={10} color="#fff" />}
            {tool.status === 'question' && <HelpCircle size={10} color="#fff" />}
          </div>
        </div>
      </div>

      {expanded && (tool.result || tool.error || tool.rconResponse) && (
        <div
          className="mt-1.5 p-1.5 rounded text-[11px] font-mono max-h-[100px] overflow-y-auto"
          style={{ background: '#0A0A0A', color: tool.error ? '#EF9A9A' : '#A5D6A7' }}
        >
          {tool.result}
          {tool.error && <span style={{ color: '#EF9A9A' }}>Error: {tool.error}</span>}
          {tool.rconResponse && (
            <div className="mt-1" style={{ color: '#FFD54F' }}>=&gt; {tool.rconResponse}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Plan Bar Component ───

function PlanBar({ steps }: { steps: PlanStep[] }) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="flex items-center flex-wrap gap-1 py-1 fade-in">
      <span className="text-[10px] mr-1" style={{ color: '#555' }}>Plan:</span>
      {steps.map((step, i) => (
        <React.Fragment key={i}>
          <div
            className="inline-flex items-center gap-1.5 rounded px-2 py-0.5"
            style={{ background: '#1A1A2E', border: '1px solid #2A2A4E' }}
          >
            <span className="text-[9px] font-semibold uppercase" style={{ color: '#7C6CF0' }}>
              {step.action}
            </span>
            <span className="text-[10px] font-mono truncate max-w-[140px]" style={{ color: '#999' }}>
              {step.content || step.path}
            </span>
          </div>
          {i < steps.length - 1 && (
            <span className="text-[10px]" style={{ color: '#444' }}>→</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Question Card Component ───

function QuestionCard({ question, onAnswer }: { question: QuestionData; onAnswer: (answer: string) => void }) {
  const [customAnswer, setCustomAnswer] = useState('');
  const [answered, setAnswered] = useState(false);

  const handleAnswer = (answer: string) => {
    setAnswered(true);
    onAnswer(answer);
  };

  return (
    <div
      className="rounded-lg p-4 my-2 fade-in"
      style={{
        background: 'linear-gradient(135deg, #1A1A2E, #0F0F1A)',
        border: '1px solid #7C6CF0',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <HelpCircle size={14} style={{ color: '#7C6CF0' }} />
        <span className="text-xs font-semibold" style={{ color: '#7C6CF0' }}>Question</span>
      </div>

      <p className="text-xs mb-1" style={{ color: '#888' }}>{question.context}</p>
      <p className="text-sm mb-3" style={{ color: '#E0E0E0' }}>{question.question}</p>

      {!answered ? (
        <div className="space-y-2">
          {question.options && question.options.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {question.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(opt)}
                  className="px-3 py-1.5 rounded-md text-xs transition-all"
                  style={{
                    background: '#111',
                    border: '1px solid #2A2A2A',
                    color: '#E0E0E0',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#7C6CF0';
                    e.currentTarget.style.background = '#1A1A2E';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = '#2A2A2A';
                    e.currentTarget.style.background = '#111';
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={customAnswer}
              onChange={e => setCustomAnswer(e.target.value)}
              placeholder={question.options && question.options.length > 0 ? 'Or type your answer...' : 'Type your answer...'}
              className="flex-1 rounded-md px-3 py-1.5 text-xs outline-none"
              style={{ background: '#050505', border: '1px solid #2A2A2A', color: '#E0E0E0' }}
              onKeyDown={e => {
                if (e.key === 'Enter' && customAnswer.trim()) {
                  handleAnswer(customAnswer.trim());
                }
              }}
            />
            <button
              onClick={() => customAnswer.trim() && handleAnswer(customAnswer.trim())}
              className="px-3 py-1.5 rounded-md text-xs font-semibold text-white transition-all"
              style={{ background: '#7C6CF0' }}
            >
              Send
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs" style={{ color: '#2E7D32' }}>
          <CheckCircle2 size={14} />
          <span>Answer submitted</span>
        </div>
      )}
    </div>
  );
}

// ─── Chat Message Component ───

function ChatMessageComponent({
  message,
  onQuestionAnswer,
}: {
  message: ChatMessage;
  onQuestionAnswer: (sessionId: string, answer: string) => void;
}) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end mb-2 fade-in">
        <div
          className="max-w-[92%] px-3.5 py-2 text-[13px] leading-relaxed"
          style={{
            background: '#7C6CF0',
            color: '#fff',
            borderRadius: '12px 12px 3px 12px',
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  if (message.role === 'system') {
    return (
      <div className="flex justify-center my-2 fade-in">
        <span className="text-[11px]" style={{ color: '#666' }}>
          {message.content}
        </span>
      </div>
    );
  }

  if (message.role === 'error') {
    return (
      <div
        className="mb-2 px-3 py-2 rounded-lg text-xs fade-in"
        style={{ background: '#2A1414', color: '#EF9A9A', border: '1px solid #C62828' }}
      >
        {message.content}
      </div>
    );
  }

  // Assistant message
  return (
    <div className="mb-3 fade-in">
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #7C6CF0, #5A4BD1)' }}
        >
          <Bot size={16} color="#fff" />
        </div>
        <span className="text-xs font-semibold" style={{ color: '#CCC' }}>Assistant</span>
        <span className="text-[10px]" style={{ color: '#666' }}>OMEGA</span>
      </div>

      {/* Thinking block */}
      {message.thinking && (
        <div className="text-[12px] leading-relaxed py-1" style={{ color: '#888' }}>
          <span className="italic">{message.thinking}</span>
          {!message.content && <span className="cursor-blink" />}
        </div>
      )}

      {/* Plan bar */}
      {message.plan && message.plan.length > 0 && <PlanBar steps={message.plan} />}

      {/* Tool executions */}
      {message.tools && message.tools.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-1">
          {message.tools.map(tool => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      )}

      {/* Question card */}
      {message.question && (
        <QuestionCard
          question={message.question}
          onAnswer={(ans) => onQuestionAnswer(message.question!.session_id, ans)}
        />
      )}

      {/* Final response */}
      {message.content && (
        <div className="text-[13px] leading-relaxed mt-1" style={{ color: '#E0E0E0' }}>
          {message.content}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───

function Dashboard({ config }: { config: ConnectionConfig }) {
  const [activeTab, setActiveTab] = useState<'chat' | 'editor'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', role: 'system', content: 'Connected to server. OMEGA is ready. Send a task.', timestamp: new Date() },
  ]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [refreshTrigger] = useState(0);
  const [editPath, setEditPath] = useState('');
  const [editContent, setEditContent] = useState('');
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [compilerStatus, setCompilerStatus] = useState<{
    amxxpc: string; amxxpc_exists: boolean;
    include_count: number; testsuite_count: number;
  } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  // Poll compiler status (every 30s)
  useEffect(() => {
    let cancelled = false;
    const fetchCompiler = async () => {
      try {
        const r = await fetch('/api/compiler/status');
        if (!cancelled && r.ok) {
          const j = await r.json();
          if (j.ok) setCompilerStatus(j);
        }
      } catch { /* ignore */ }
    };
    fetchCompiler();
    const iv = setInterval(fetchCompiler, 30000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const handleSend = async () => {
    if (!input.trim() || streaming) return;

    const task = input.trim();
    setInput('');
    setStreaming(true);

    // Add user message
    const userMsg: ChatMessage = {
      id: 'user-' + Date.now(),
      role: 'user',
      content: task,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    // Create assistant message placeholder
    const assistantId = 'assistant-' + Date.now();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      thinking: '',
      content: '',
      plan: [],
      tools: [],
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, assistantMsg]);

    abortControllerRef.current = new AbortController();

    try {
      const resp = await fetch('/api/agent/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: config.apiKey,
          provider: config.provider,
          model: config.model,
          task,
          host: config.host,
          port: config.port,
          user: config.user,
          password: config.password,
          rconPass: config.rconPass,
          rconHost: config.rconHost,
          gamePort: config.gamePort,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!resp.ok) {
        const text = await resp.text();
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, role: 'error', content: `Server ${resp.status}: ${text.slice(0, 200)}` }
            : m
        ));
        setStreaming(false);
        return;
      }

      if (!resp.body) {
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, role: 'error', content: 'No response body' }
            : m
        ));
        setStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      const currentTools: ToolExecution[] = [];
      let currentPlan: PlanStep[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';

        for (const line of lines) {
          const l = line.trim();
          if (!l || !l.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(l.slice(6));

            setMessages(prev => prev.map(m => {
              if (m.id !== assistantId) return m;

              switch (data.type) {
                case 'reasoning':
                  return { ...m, thinking: (m.thinking || '') + (data.reasoning || '') };

                case 'reasoning_end':
                  return { ...m, thinking: data.reasoning || m.thinking };

                case 'content':
                  return { ...m, content: (m.content || '') + (data.content || '') };

                case 'plan':
                  currentPlan = data.steps || [];
                  return { ...m, plan: currentPlan };

                case 'tool_start':
                  const newTool: ToolExecution = {
                    id: data.id,
                    action: data.action,
                    path: data.path,
                    status: 'running',
                  };
                  currentTools.push(newTool);
                  return { ...m, tools: [...currentTools] };

                case 'tool_end':
                  const idx = currentTools.findIndex(t => t.id === data.id);
                  if (idx !== -1) {
                    currentTools[idx] = {
                      ...currentTools[idx],
                      status: data.status === 'error' ? 'error' :
                              data.status === 'question' ? 'question' : 'done',
                      result: data.data,
                      error: data.error,
                      rconResponse: data.rconResponse,
                      elapsed: data.elapsed,
                    };
                  }
                  return { ...m, tools: [...currentTools] };

                case 'question':
                  return {
                    ...m,
                    question: {
                      question: data.question,
                      options: data.options,
                      context: data.context,
                      session_id: data.session_id,
                    },
                  };

                case 'done':
                  return {
                    ...m,
                    content: m.content + (data.explanation || ''),
                    thinking: m.thinking,
                  };

                case 'error':
                  return { ...m, role: 'error', content: data.content || 'Unknown error' };

                default:
                  return m;
              }
            }));
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, role: 'error', content: 'Stream error: ' + e.message }
            : m
        ));
      }
    }

    setStreaming(false);
    abortControllerRef.current = null;
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStreaming(false);
  };

  const handleQuestionAnswer = async (sessionId: string, answer: string) => {
    try {
      await api('POST', '/api/agent/answer', { session_id: sessionId, answer });
      // Update the message to show answered
      setMessages(prev => prev.map(m => {
        if (m.question?.session_id === sessionId) {
          return { ...m, question: undefined };
        }
        return m;
      }));
    } catch (e: any) {
      console.error('Failed to submit answer:', e);
    }
  };

  const handleFileOpen = async (path: string) => {
    setActiveTab('editor');
    setEditPath('Loading ' + path + '...');
    const r = await api('POST', '/api/sftp/read', { path });
    if (r.ok) {
      setEditPath(path);
      setEditContent(r.content || '');
    } else {
      setEditPath('Error: ' + (r.error || 'unknown'));
      setEditContent('');
    }
  };

  const handleSaveFile = async () => {
    if (!editPath || editPath.startsWith('Loading') || editPath.startsWith('Error')) return;
    const r = await api('POST', '/api/sftp/write', { path: editPath, content: editContent });
    if (r.ok) {
      const actionMsg: ChatMessage = {
        id: 'action-' + Date.now(),
        role: 'system',
        content: `Saved ${editPath} (${editContent.length} bytes)`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, actionMsg]);
    } else {
      const errorMsg: ChatMessage = {
        id: 'error-' + Date.now(),
        role: 'error',
        content: 'Save failed: ' + (r.error || ''),
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    }
  };

  return (
    <div className="flex flex-col h-screen" style={{ background: '#050505', color: '#E0E0E0' }}>
      {/* Header */}
      <header
        className="flex items-center gap-2.5 px-4 flex-shrink-0"
        style={{
          height: '36px',
          background: '#111111',
          borderBottom: '1px solid #222',
        }}
      >
        <Bot size={16} style={{ color: '#7C6CF0' }} />
        <h1 className="text-[13px] font-semibold text-white tracking-wide">CS 1.6 AI Agent</h1>
        <span
          className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
          style={{ background: '#7C6CF0', color: '#fff' }}
        >
          OMEGA
        </span>

        {config.rconPass && (
          <span
            className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
            style={{ background: '#1B5E20', color: '#fff' }}
          >
            RCON
          </span>
        )}

        {compilerStatus && (
          <span
            className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
            title={`amxxpc: ${compilerStatus.amxxpc}${compilerStatus.amxxpc_exists ? ' ✓' : ' ✗'} | SDK: ${compilerStatus.include_count} .inc | testsuite: ${compilerStatus.testsuite_count} plugins`}
            style={{
              background: compilerStatus.amxxpc_exists ? '#4A148C' : '#444',
              color: '#fff',
            }}
          >
            <Cpu size={9} style={{ display: 'inline', marginRight: '3px', verticalAlign: 'middle' }} />
            amxxpc
          </span>
        )}

        <span className="ml-auto text-[11px]" style={{ color: '#555' }}>
          {config.rconHost
            ? `SFTP: ${config.user}@${config.host}:${config.port} | RCON: ${config.rconHost}:${config.gamePort}`
            : `SFTP: ${config.user}@${config.host}:${config.port}`}
        </span>

        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className="text-[10px] px-2 py-0.5 rounded transition-colors ml-2"
          style={{
            background: '#1E1E1E',
            border: '1px solid #2A2A2A',
            color: autoScroll ? '#7C6CF0' : '#666',
          }}
        >
          {autoScroll ? '⬇ Auto' : '⬒ Paused'}
        </button>

        <button
          onClick={() => setSidebarVisible(!sidebarVisible)}
          className="text-[10px] px-2 py-0.5 rounded transition-colors"
          style={{
            background: '#1E1E1E',
            border: '1px solid #2A2A2A',
            color: '#888',
          }}
        >
          {sidebarVisible ? <EyeOff size={10} /> : <Eye size={10} />}
        </button>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar */}
        {sidebarVisible && (
          <div
            className="flex-shrink-0 overflow-hidden"
            style={{ width: '230px', borderRight: '1px solid #222' }}
          >
            <FileTree onFileOpen={handleFileOpen} refreshTrigger={refreshTrigger} />
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ background: '#0A0A0A' }}>
          {/* Tabs */}
          <div className="flex" style={{ background: '#111111', borderBottom: '1px solid #222' }}>
            <button
              onClick={() => setActiveTab('chat')}
              className="px-3 py-[7px] text-[11px] transition-all"
              style={{
                color: activeTab === 'chat' ? '#7C6CF0' : '#666',
                fontWeight: activeTab === 'chat' ? 600 : 400,
                borderBottom: activeTab === 'chat' ? '2px solid #7C6CF0' : '2px solid transparent',
              }}
            >
              <span className="flex items-center gap-1.5">
                <MessageSquare size={12} />
                Chat
              </span>
            </button>
            <button
              onClick={() => setActiveTab('editor')}
              className="px-3 py-[7px] text-[11px] transition-all"
              style={{
                color: activeTab === 'editor' ? '#7C6CF0' : '#666',
                fontWeight: activeTab === 'editor' ? 600 : 400,
                borderBottom: activeTab === 'editor' ? '2px solid #7C6CF0' : '2px solid transparent',
              }}
            >
              <span className="flex items-center gap-1.5">
                <Code2 size={12} />
                Editor
              </span>
            </button>
          </div>

          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <>
              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4"
                style={{ background: '#050505' }}
              >
                {messages.map(msg => (
                  <ChatMessageComponent
                    key={msg.id}
                    message={msg}
                    onQuestionAnswer={handleQuestionAnswer}
                  />
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Input Bar */}
              <div
                className="flex-shrink-0 flex items-end gap-2 px-3 py-2"
                style={{ background: '#111111', borderTop: '1px solid #222' }}
              >
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Type a task for OMEGA..."
                  disabled={streaming}
                  rows={1}
                  className="flex-1 rounded-lg px-3 py-2 text-[13px] outline-none resize-none transition-colors"
                  style={{
                    background: '#050505',
                    border: '1px solid #2A2A2A',
                    color: '#E0E0E0',
                    minHeight: '36px',
                    maxHeight: '120px',
                  }}
                  onFocus={e => e.target.style.borderColor = '#7C6CF0'}
                  onBlur={e => e.target.style.borderColor = '#2A2A2A'}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                {!streaming ? (
                  <button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className="flex-shrink-0 h-9 px-4 rounded-lg text-xs font-semibold text-white transition-all flex items-center gap-1.5"
                    style={{
                      background: input.trim() ? '#7C6CF0' : '#4A4A4A',
                      cursor: input.trim() ? 'pointer' : 'not-allowed',
                    }}
                  >
                    <Send size={12} />
                    Send
                  </button>
                ) : (
                  <button
                    onClick={handleStop}
                    className="flex-shrink-0 h-9 px-4 rounded-lg text-xs font-semibold text-white transition-all flex items-center gap-1.5"
                    style={{ background: '#C62828', cursor: 'pointer' }}
                  >
                    <Square size={12} />
                    Stop
                  </button>
                )}
              </div>
            </>
          )}

          {/* Editor Tab */}
          {activeTab === 'editor' && (
            <div className="flex-1 flex flex-col p-2.5 overflow-hidden">
              <div className="flex items-center justify-between mb-1.5 flex-shrink-0">
                <span className="text-[11px] truncate" style={{ color: '#999' }}>
                  {editPath || 'Select a file from sidebar'}
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => {
                      if (editPath && !editPath.startsWith('Loading') && !editPath.startsWith('Error')) {
                        handleFileOpen(editPath);
                      }
                    }}
                    className="text-[11px] px-2.5 py-1 rounded transition-colors flex items-center gap-1"
                    style={{ background: '#1E1E1E', border: '1px solid #2A2A2A', color: '#E0E0E0' }}
                  >
                    <RotateCcw size={10} />
                    Reload
                  </button>
                  <button
                    onClick={handleSaveFile}
                    className="text-[11px] px-2.5 py-1 rounded transition-colors flex items-center gap-1"
                    style={{ background: '#2E7D32', color: '#fff' }}
                  >
                    <Save size={10} />
                    Save
                  </button>
                </div>
              </div>
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                placeholder="Click a file in the sidebar to edit..."
                className="flex-1 w-full rounded-md p-2 text-[12px] font-mono outline-none resize-none"
                style={{
                  background: '#111111',
                  border: '1px solid #222',
                  color: '#E0E0E0',
                  lineHeight: '1.5',
                }}
                spellCheck={false}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── App ───

function App() {
  const [connected, setConnected] = useState(false);
  const [config, setConfig] = useState<ConnectionConfig | null>(null);

  // Try to load saved config on mount
  useEffect(() => {
    const loadSaved = async () => {
      try {
        const r = await fetch('/api/config');
        const saved = await r.json();
        if (saved.host) {
          // Config exists but we need the password too
          // User still needs to connect manually for security
        }
      } catch (e) {
        // ignore
      }
    };
    loadSaved();
  }, []);

  const handleConnect = (newConfig: ConnectionConfig) => {
    setConfig(newConfig);
    setConnected(true);
  };

  if (!connected || !config) {
    return <SetupScreen onConnect={handleConnect} />;
  }

  return <Dashboard config={config} />;
}

export default App;
