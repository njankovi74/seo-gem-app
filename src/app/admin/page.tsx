/**
 * Admin Analytics Dashboard v2
 * 
 * Fixes: period filtering, custom calendar, column alignment,
 * tooltips with data source, published date column.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Types ──
interface PortalOverview {
  portal_id: string;
  portal_name: string;
  seo_gem_articles: number;
  gsc: {
    total_impressions: number;
    total_clicks: number;
    ctr: number;
    web_impressions: number;
    discover_impressions: number;
  };
  ga4: {
    pageviews: number;
    sessions: number;
    avg_engagement_sec: number;
    pages_per_session: number;
    top_countries: Array<{ country: string; sessions: number }>;
  };
}

interface Article {
  url: string;
  seo_title: string | null;
  style: string | null;
  published_at: string | null;
  age_days: number | null;
  has_seo_gem: boolean;
  impressions: number;
  clicks: number;
  ctr: number;
  avg_position: number | null;
  discover_impressions: number;
  top_queries: Array<{ query: string; impressions: number; clicks: number }>;
  pageviews: number;
  sessions: number;
  avg_engagement_sec: number;
  pages_per_session: number;
  organic_pct: number;
  status: 'early' | 'ok' | 'warning' | 'top';
}

// ── Constants ──
const PRESETS = [
  { label: 'Juče', days: 1 },
  { label: '7 dana', days: 7 },
  { label: '14 dana', days: 14 },
  { label: '30 dana', days: 30 },
];

const STATUS_ICONS: Record<string, string> = {
  early: '🕐', ok: '✅', warning: '⚠️', top: '🔥',
};

const STATUS_LABELS: Record<string, string> = {
  early: 'Rani podaci (<7d)',
  ok: 'OK',
  warning: 'Nizak CTR',
  top: 'Top performer',
};

const PORTAL_FLAGS: Record<string, string> = {
  newsmax: '🇷🇸', newsmax_pl: '🇵🇱', newsmax_al: '🇦🇱',
};

const COLUMNS = [
  { key: 'status', label: '', tooltip: 'Status članka', width: 40 },
  { key: 'published', label: 'Objav.', tooltip: 'Datum objave (iz SEO GEM)', width: 70 },
  { key: 'title', label: 'SEO Naslov / URL', tooltip: 'Naslov generisan kroz SEO GEM', width: 320 },
  { key: 'age', label: 'Star.', tooltip: 'Starost članka u danima od objave', width: 50 },
  { key: 'impressions', label: 'Impr.', tooltip: 'Impressions — broj prikaza u Google rezultatima (GSC)', width: 70 },
  { key: 'clicks', label: 'Clicks', tooltip: 'Clicks — broj klikova iz Google rezultata (GSC)', width: 60 },
  { key: 'ctr', label: 'CTR', tooltip: 'Click-Through Rate — procenat klikova od prikaza (GSC)', width: 55 },
  { key: 'position', label: 'Poz.', tooltip: 'Prosečna pozicija u Google pretrazi (GSC)', width: 50 },
  { key: 'discover', label: 'Disc.', tooltip: 'Impressions iz Google Discover (GSC)', width: 55 },
  { key: 'pageviews', label: 'Views', tooltip: 'Pageviews — ukupno pregleda stranice (GA4)', width: 60 },
  { key: 'engagement', label: 'Eng.', tooltip: 'Prosečno vreme zadržavanja korisnika (GA4)', width: 55 },
  { key: 'pps', label: 'Str/S', tooltip: 'Strane po sesiji — interlinking signal (GA4)', width: 50 },
];

// ── Helpers ──
function getDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function formatNum(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function formatSec(sec: number): string {
  if (sec >= 60) return Math.floor(sec / 60) + ':' + String(Math.floor(sec % 60)).padStart(2, '0');
  return sec + 's';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('sr-Latn', { day: '2-digit', month: '2-digit' });
}

export default function AdminDashboard() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Data
  const [overview, setOverview] = useState<PortalOverview[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [totalArticles, setTotalArticles] = useState(0);
  const [seoGemCount, setSeoGemCount] = useState(0);
  const [selectedPortal, setSelectedPortal] = useState('newsmax');

  // Period
  const [activePreset, setActivePreset] = useState(7);
  const [startDate, setStartDate] = useState(getDaysAgo(7));
  const [endDate, setEndDate] = useState(getDaysAgo(0));
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState(getDaysAgo(7));
  const [customEnd, setCustomEnd] = useState(getDaysAgo(0));

  const [view, setView] = useState<'overview' | 'articles'>('overview');

  const apiBase = '/api/admin/analytics';

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const ovRes = await fetch(`${apiBase}/overview?start=${startDate}&end=${endDate}&admin_key=${password}`);
      const ovData = await ovRes.json();
      if (!ovData.success) throw new Error(ovData.error);
      setOverview(ovData.portals);

      const artRes = await fetch(
        `${apiBase}/articles?portal=${selectedPortal}&start=${startDate}&end=${endDate}&limit=200&admin_key=${password}`
      );
      const artData = await artRes.json();
      if (!artData.success) throw new Error(artData.error);
      setArticles(artData.articles);
      setTotalArticles(artData.total);
      setSeoGemCount(artData.seo_gem_count);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [password, startDate, endDate, selectedPortal]);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/status?admin_key=${password}`);
      const data = await res.json();
      if (data.success) {
        setAuthed(true);
        setError('');
      } else {
        setError('Pogrešna lozinka');
      }
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  const selectPreset = (days: number) => {
    setActivePreset(days);
    setStartDate(getDaysAgo(days));
    setEndDate(getDaysAgo(0));
    setShowCustom(false);
  };

  const applyCustom = () => {
    setActivePreset(0);
    setStartDate(customStart);
    setEndDate(customEnd);
    setShowCustom(false);
  };

  useEffect(() => {
    if (authed) fetchData();
  }, [authed, fetchData]);

  // ── Login ──
  if (!authed) {
    return (
      <div style={S.loginContainer}>
        <div style={S.loginCard}>
          <h1 style={S.loginTitle}>🔐 SEO GEM Admin</h1>
          <p style={S.loginSub}>Analytics Dashboard</p>
          <input
            type="password" placeholder="Admin lozinka" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={S.input}
          />
          <button onClick={handleLogin} disabled={loading} style={S.loginBtn}>
            {loading ? '...' : 'Pristupi'}
          </button>
          {error && <p style={S.errText}>{error}</p>}
        </div>
      </div>
    );
  }

  // ── Dashboard ──
  return (
    <div style={S.page}>
      {/* Header */}
      <header style={S.header}>
        <h1 style={S.h1}>📊 SEO GEM Analytics</h1>
        <div style={S.periodWrap}>
          {PRESETS.map(p => (
            <button key={p.days} onClick={() => selectPreset(p.days)}
              style={{ ...S.presetBtn, ...(activePreset === p.days ? S.presetActive : {}) }}>
              {p.label}
            </button>
          ))}
          <button onClick={() => setShowCustom(!showCustom)}
            style={{ ...S.presetBtn, ...(activePreset === 0 ? S.presetActive : {}) }}>
            📅 Custom
          </button>
        </div>
      </header>

      {/* Custom date picker */}
      {showCustom && (
        <div style={S.customBar}>
          <label style={S.dateLabel}>Od:
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={S.dateInput} />
          </label>
          <label style={S.dateLabel}>Do:
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={S.dateInput} />
          </label>
          <button onClick={applyCustom} style={S.applyBtn}>Primeni</button>
        </div>
      )}

      {/* Period display */}
      <div style={S.periodInfo}>
        📅 Period: <strong>{startDate}</strong> → <strong>{endDate}</strong>
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        <button onClick={() => setView('overview')}
          style={{ ...S.tab, ...(view === 'overview' ? S.tabActive : {}) }}>
          📊 Overview
        </button>
        <button onClick={() => setView('articles')}
          style={{ ...S.tab, ...(view === 'articles' ? S.tabActive : {}) }}>
          📝 Članci
        </button>
      </div>

      {loading && <div style={S.loading}>⏳ Učitavanje...</div>}
      {error && <div style={S.error}>{error}</div>}

      {/* ═══ OVERVIEW ═══ */}
      {view === 'overview' && !loading && (
        <div style={S.overGrid}>
          {overview.map(p => (
            <div key={p.portal_id} style={S.card}>
              <div style={S.cardHead}>
                <span style={{ fontSize: 28 }}>{PORTAL_FLAGS[p.portal_id] || '🌐'}</span>
                <h2 style={S.cardTitle}>{p.portal_name}</h2>
              </div>
              <div style={S.mGrid}>
                <MBox label="Impressions" value={formatNum(p.gsc.total_impressions)} src="GSC" />
                <MBox label="Clicks" value={formatNum(p.gsc.total_clicks)} src="GSC" />
                <MBox label="CTR" value={p.gsc.ctr + '%'} src="GSC" hi={p.gsc.ctr > 4} />
                <MBox label="Discover" value={formatNum(p.gsc.discover_impressions)} src="GSC" />
                <MBox label="Pageviews" value={formatNum(p.ga4.pageviews)} src="GA4" />
                <MBox label="Sessions" value={formatNum(p.ga4.sessions)} src="GA4" />
                <MBox label="Engagement" value={formatSec(p.ga4.avg_engagement_sec)} src="GA4" />
                <MBox label="Pages/Ses" value={String(p.ga4.pages_per_session)} src="GA4" />
              </div>
              {p.ga4.top_countries.length > 0 && (
                <div style={S.countries}>
                  🌍 {p.ga4.top_countries.map((c, i) => (
                    <span key={i} style={S.chip}>{c.country} {formatNum(c.sessions)}</span>
                  ))}
                </div>
              )}
              <div style={S.gemBadge}>SEO GEM članaka: <strong>{p.seo_gem_articles}</strong></div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ ARTICLES ═══ */}
      {view === 'articles' && !loading && (
        <div>
          {/* Portal picker */}
          <div style={S.portalPick}>
            {overview.map(p => (
              <button key={p.portal_id} onClick={() => setSelectedPortal(p.portal_id)}
                style={{ ...S.pBtn, ...(selectedPortal === p.portal_id ? S.pBtnActive : {}) }}>
                {PORTAL_FLAGS[p.portal_id]} {p.portal_name}
              </button>
            ))}
            <span style={S.artCount}>
              {totalArticles} URL-ova │ {seoGemCount} SEO GEM
            </span>
          </div>

          {/* Table */}
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead>
                <tr>
                  {COLUMNS.map(col => (
                    <th key={col.key} title={col.tooltip}
                      style={{ ...S.th, width: col.width, minWidth: col.width, cursor: 'help' }}>
                      {col.label}
                      {col.tooltip.includes('GSC') && <span style={S.srcTag}>GSC</span>}
                      {col.tooltip.includes('GA4') && <span style={S.srcTagGA}>GA4</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {articles.map((a, i) => (
                  <tr key={i} style={i % 2 === 0 ? S.rowE : S.rowO}
                    title={STATUS_LABELS[a.status]}>
                    {/* Status */}
                    <td style={S.tdC}>{STATUS_ICONS[a.status]}</td>
                    {/* Published */}
                    <td style={S.tdC}>{formatDate(a.published_at)}</td>
                    {/* Title */}
                    <td style={S.tdTitle}>
                      <div style={S.titleRow}>
                        <span style={S.titleTxt}>{a.seo_title || '(bez naslova)'}</span>
                        {a.style && <span style={S.badge}>{a.style}</span>}
                        {!a.has_seo_gem && <span style={S.badgeNo}>—</span>}
                      </div>
                      <div style={S.urlTxt}>{a.url}</div>
                      {a.top_queries.length > 0 && (
                        <div style={S.qRow}>
                          🔑 {a.top_queries.slice(0, 3).map((q, qi) => (
                            <span key={qi} style={S.qChip}>{q.query}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    {/* Age */}
                    <td style={S.tdR}>{a.age_days !== null ? `${a.age_days}d` : '—'}</td>
                    {/* Impressions */}
                    <td style={S.tdR}>{formatNum(a.impressions)}</td>
                    {/* Clicks */}
                    <td style={S.tdR}>{formatNum(a.clicks)}</td>
                    {/* CTR */}
                    <td style={{
                      ...S.tdR,
                      color: a.ctr > 6 ? '#10b981' : (a.ctr < 2 && a.status !== 'early') ? '#ef4444' : '#e2e8f0',
                      fontWeight: 600,
                    }}>
                      {a.ctr}%
                    </td>
                    {/* Position */}
                    <td style={S.tdR}>{a.avg_position ?? '—'}</td>
                    {/* Discover */}
                    <td style={S.tdR}>{a.discover_impressions > 0 ? formatNum(a.discover_impressions) : '—'}</td>
                    {/* Pageviews */}
                    <td style={S.tdR}>{formatNum(a.pageviews)}</td>
                    {/* Engagement */}
                    <td style={S.tdR}>{formatSec(a.avg_engagement_sec)}</td>
                    {/* PPS */}
                    <td style={S.tdR}>{a.pages_per_session}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={S.legend}>
            🕐 Rani podaci (&lt;7d) &nbsp;│&nbsp; ✅ OK &nbsp;│&nbsp; ⚠️ Nizak CTR &nbsp;│&nbsp; 🔥 Top performer
          </div>
        </div>
      )}
    </div>
  );
}

// ── Metric Box ──
function MBox({ label, value, src, hi }: { label: string; value: string; src: string; hi?: boolean }) {
  return (
    <div style={S.mBox} title={`${label} — izvor: ${src}`}>
      <div style={S.mLabel}>{label}</div>
      <div style={{ ...S.mVal, ...(hi ? { color: '#10b981' } : {}) }}>{value}</div>
      <div style={S.mSrc}>{src}</div>
    </div>
  );
}

// ── Styles ──
const S: Record<string, React.CSSProperties> = {
  // Login
  loginContainer: {
    minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center',
    background: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  loginCard: {
    background: '#1e293b', borderRadius: 16, padding: 48, textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)', border: '1px solid #334155', maxWidth: 400,
  },
  loginTitle: { color: '#e2e8f0', margin: '0 0 8px', fontSize: 28 },
  loginSub: { color: '#64748b', margin: '0 0 24px' },
  input: {
    width: '100%', padding: '12px 16px', borderRadius: 8, border: '1px solid #475569',
    background: '#0f172a', color: '#e2e8f0', fontSize: 16, marginBottom: 16, boxSizing: 'border-box',
  },
  loginBtn: {
    width: '100%', padding: '12px 24px', borderRadius: 8, border: 'none',
    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#fff', fontSize: 16,
    cursor: 'pointer', fontWeight: 600,
  },
  errText: { color: '#ef4444', marginTop: 12 },

  // Page
  page: {
    minHeight: '100vh', background: '#0f172a', color: '#e2e8f0',
    fontFamily: 'system-ui, -apple-system, sans-serif', padding: '0 24px 48px',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '20px 0', borderBottom: '1px solid #1e293b', flexWrap: 'wrap', gap: 12,
  },
  h1: { margin: 0, fontSize: 22, fontWeight: 700 },
  periodWrap: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  presetBtn: {
    padding: '7px 14px', borderRadius: 6, border: '1px solid #334155',
    background: '#1e293b', color: '#94a3b8', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap',
  },
  presetActive: { background: '#3b82f6', color: '#fff', borderColor: '#3b82f6' },

  // Custom date
  customBar: {
    display: 'flex', gap: 12, alignItems: 'center', padding: '12px 0',
    borderBottom: '1px solid #1e293b', flexWrap: 'wrap',
  },
  dateLabel: { color: '#94a3b8', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 },
  dateInput: {
    padding: '6px 10px', borderRadius: 6, border: '1px solid #475569',
    background: '#0f172a', color: '#e2e8f0', fontSize: 13,
  },
  applyBtn: {
    padding: '7px 16px', borderRadius: 6, border: 'none',
    background: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },

  // Period info
  periodInfo: {
    padding: '10px 0', fontSize: 13, color: '#64748b',
  },

  // Tabs
  tabs: { display: 'flex', gap: 4, marginTop: 12 },
  tab: {
    padding: '9px 20px', borderRadius: '8px 8px 0 0', border: '1px solid #334155',
    borderBottom: 'none', background: '#1e293b', color: '#94a3b8', cursor: 'pointer', fontSize: 14,
  },
  tabActive: { background: '#334155', color: '#e2e8f0' },

  // Loading/Error
  loading: { textAlign: 'center', padding: 40, color: '#64748b', fontSize: 18 },
  error: { textAlign: 'center', padding: 16, color: '#ef4444', background: '#1e1e2e', borderRadius: 8, margin: '16px 0' },

  // Overview
  overGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16, marginTop: 16 },
  card: { background: '#1e293b', borderRadius: 12, padding: 20, border: '1px solid #334155' },
  cardHead: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 },
  cardTitle: { margin: 0, fontSize: 17, fontWeight: 600 },
  mGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 },
  mBox: { background: '#0f172a', borderRadius: 8, padding: '10px 6px', textAlign: 'center' },
  mLabel: { fontSize: 10, color: '#64748b', marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
  mVal: { fontSize: 18, fontWeight: 700, color: '#e2e8f0' },
  mSrc: { fontSize: 9, color: '#475569', marginTop: 2, textTransform: 'uppercase' as const },
  countries: { marginTop: 14, fontSize: 12, color: '#94a3b8' },
  chip: {
    display: 'inline-block', background: '#0f172a', borderRadius: 4,
    padding: '2px 7px', margin: '2px 3px', fontSize: 11,
  },
  gemBadge: {
    marginTop: 14, padding: '7px 12px', background: '#0f172a', borderRadius: 8,
    fontSize: 12, color: '#94a3b8', textAlign: 'center',
  },

  // Articles
  portalPick: { display: 'flex', gap: 8, margin: '16px 0', alignItems: 'center', flexWrap: 'wrap' },
  pBtn: {
    padding: '8px 16px', borderRadius: 8, border: '1px solid #334155',
    background: '#1e293b', color: '#94a3b8', cursor: 'pointer', fontSize: 13,
  },
  pBtnActive: { background: '#3b82f6', color: '#fff', borderColor: '#3b82f6' },
  artCount: { marginLeft: 'auto', fontSize: 12, color: '#64748b' },

  // Table
  tableWrap: {
    overflowX: 'auto', borderRadius: 10, border: '1px solid #334155', background: '#1e293b',
  },
  table: {
    width: '100%', borderCollapse: 'collapse', fontSize: 12,
    tableLayout: 'fixed',
  },
  th: {
    padding: '10px 8px', textAlign: 'left', background: '#0f172a',
    color: '#64748b', fontWeight: 600, fontSize: 10, textTransform: 'uppercase' as const,
    borderBottom: '2px solid #334155', whiteSpace: 'nowrap', position: 'sticky' as const, top: 0,
    letterSpacing: '0.3px',
  },
  srcTag: {
    display: 'inline-block', marginLeft: 4, padding: '0 4px', borderRadius: 3,
    background: '#3b82f620', color: '#60a5fa', fontSize: 8, verticalAlign: 'middle',
  },
  srcTagGA: {
    display: 'inline-block', marginLeft: 4, padding: '0 4px', borderRadius: 3,
    background: '#10b98120', color: '#34d399', fontSize: 8, verticalAlign: 'middle',
  },
  rowE: { background: '#1e293b' },
  rowO: { background: '#1a2332' },
  tdC: {
    padding: '8px', borderBottom: '1px solid #1e293b55', textAlign: 'center',
    whiteSpace: 'nowrap', overflow: 'hidden',
  },
  tdR: {
    padding: '8px', borderBottom: '1px solid #1e293b55', textAlign: 'right',
    fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden',
  },
  tdTitle: {
    padding: '8px', borderBottom: '1px solid #1e293b55',
    overflow: 'hidden',
  },
  titleRow: { display: 'flex', alignItems: 'center', gap: 6 },
  titleTxt: { fontWeight: 600, color: '#e2e8f0', fontSize: 12, lineHeight: 1.3 },
  badge: {
    flexShrink: 0, padding: '1px 5px', borderRadius: 3,
    background: '#3b82f620', color: '#60a5fa', fontSize: 9, whiteSpace: 'nowrap',
  },
  badgeNo: { color: '#475569', fontSize: 10 },
  urlTxt: { fontSize: 10, color: '#475569', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  qRow: { marginTop: 4, fontSize: 10, color: '#94a3b8' },
  qChip: {
    display: 'inline-block', background: '#0f172a', borderRadius: 3,
    padding: '1px 5px', margin: '1px 2px', fontSize: 10,
  },

  legend: { textAlign: 'center', padding: '14px 0', color: '#64748b', fontSize: 12 },
};
