/**
 * Admin Analytics Dashboard
 * 
 * Password-protected page showing combined GSC + GA4 data.
 * Client-side rendered — fetches data from admin API endpoints.
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
const PERIODS = [
  { label: 'Juče', days: 1 },
  { label: '7 dana', days: 7 },
  { label: '14 dana', days: 14 },
  { label: '30 dana', days: 30 },
];

const STATUS_ICONS: Record<string, string> = {
  early: '🕐',
  ok: '✅',
  warning: '⚠️',
  top: '🔥',
};

const PORTAL_FLAGS: Record<string, string> = {
  newsmax: '🇷🇸',
  newsmax_pl: '🇵🇱',
  newsmax_al: '🇦🇱',
};

// ── Helpers ──
function getDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function formatNum(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

function formatSec(sec: number): string {
  if (sec >= 60) return Math.floor(sec / 60) + ':' + String(Math.floor(sec % 60)).padStart(2, '0');
  return sec + 's';
}

export default function AdminDashboard() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Data
  const [overview, setOverview] = useState<PortalOverview[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedPortal, setSelectedPortal] = useState('newsmax');
  const [periodDays, setPeriodDays] = useState(7);
  const [view, setView] = useState<'overview' | 'articles'>('overview');

  const apiBase = '/api/admin/analytics';

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    const start = getDaysAgo(periodDays);
    const end = getDaysAgo(0);

    try {
      // Fetch overview
      const ovRes = await fetch(`${apiBase}/overview?start=${start}&end=${end}&admin_key=${password}`);
      const ovData = await ovRes.json();
      if (!ovData.success) throw new Error(ovData.error);
      setOverview(ovData.portals);

      // Fetch articles for selected portal
      const artRes = await fetch(
        `${apiBase}/articles?portal=${selectedPortal}&start=${start}&end=${end}&limit=200&admin_key=${password}`
      );
      const artData = await artRes.json();
      if (!artData.success) throw new Error(artData.error);
      setArticles(artData.articles);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [password, periodDays, selectedPortal]);

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

  useEffect(() => {
    if (authed) fetchData();
  }, [authed, fetchData]);

  // ── Login Screen ──
  if (!authed) {
    return (
      <div style={styles.loginContainer}>
        <div style={styles.loginCard}>
          <h1 style={styles.loginTitle}>🔐 SEO GEM Admin</h1>
          <p style={styles.loginSubtitle}>Analytics Dashboard</p>
          <input
            type="password"
            placeholder="Admin lozinka"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={styles.input}
          />
          <button onClick={handleLogin} disabled={loading} style={styles.loginBtn}>
            {loading ? '...' : 'Pristupi'}
          </button>
          {error && <p style={styles.errorText}>{error}</p>}
        </div>
      </div>
    );
  }

  // ── Dashboard ──
  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.headerTitle}>📊 SEO GEM Analytics</h1>
        </div>
        <div style={styles.headerRight}>
          {/* Period selector */}
          <div style={styles.periodBar}>
            {PERIODS.map(p => (
              <button
                key={p.days}
                onClick={() => setPeriodDays(p.days)}
                style={{
                  ...styles.periodBtn,
                  ...(periodDays === p.days ? styles.periodBtnActive : {}),
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* View tabs */}
      <div style={styles.tabs}>
        <button
          onClick={() => setView('overview')}
          style={{ ...styles.tab, ...(view === 'overview' ? styles.tabActive : {}) }}
        >
          📊 Overview
        </button>
        <button
          onClick={() => setView('articles')}
          style={{ ...styles.tab, ...(view === 'articles' ? styles.tabActive : {}) }}
        >
          📝 Članci
        </button>
      </div>

      {loading && <div style={styles.loading}>Učitavanje...</div>}
      {error && <div style={styles.error}>{error}</div>}

      {/* Overview */}
      {view === 'overview' && !loading && (
        <div style={styles.overviewGrid}>
          {overview.map(portal => (
            <div key={portal.portal_id} style={styles.portalCard}>
              <div style={styles.portalHeader}>
                <span style={styles.portalFlag}>{PORTAL_FLAGS[portal.portal_id] || '🌐'}</span>
                <h2 style={styles.portalName}>{portal.portal_name}</h2>
              </div>

              <div style={styles.metricsGrid}>
                <MetricBox label="Impressions" value={formatNum(portal.gsc.total_impressions)} sub="GSC" />
                <MetricBox label="Clicks" value={formatNum(portal.gsc.total_clicks)} sub="GSC" />
                <MetricBox label="CTR" value={portal.gsc.ctr + '%'} sub="GSC" highlight={portal.gsc.ctr > 4} />
                <MetricBox label="Discover" value={formatNum(portal.gsc.discover_impressions)} sub="GSC" />
                <MetricBox label="Pageviews" value={formatNum(portal.ga4.pageviews)} sub="GA4" />
                <MetricBox label="Sessions" value={formatNum(portal.ga4.sessions)} sub="GA4" />
                <MetricBox label="Engagement" value={formatSec(portal.ga4.avg_engagement_sec)} sub="GA4" />
                <MetricBox label="Pages/Ses" value={portal.ga4.pages_per_session.toString()} sub="GA4" />
              </div>

              {portal.ga4.top_countries.length > 0 && (
                <div style={styles.countries}>
                  🌍{' '}
                  {portal.ga4.top_countries.map((c, i) => (
                    <span key={i} style={styles.countryChip}>
                      {c.country} {formatNum(c.sessions)}
                    </span>
                  ))}
                </div>
              )}

              <div style={styles.seoGemBadge}>
                SEO GEM članaka: <strong>{portal.seo_gem_articles}</strong>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Articles */}
      {view === 'articles' && !loading && (
        <div>
          {/* Portal selector */}
          <div style={styles.portalSelector}>
            {overview.map(p => (
              <button
                key={p.portal_id}
                onClick={() => setSelectedPortal(p.portal_id)}
                style={{
                  ...styles.portalBtn,
                  ...(selectedPortal === p.portal_id ? styles.portalBtnActive : {}),
                }}
              >
                {PORTAL_FLAGS[p.portal_id]} {p.portal_name}
              </button>
            ))}
          </div>

          {/* Articles table */}
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Status</th>
                  <th style={{ ...styles.th, minWidth: 300 }}>SEO Naslov / URL</th>
                  <th style={styles.th}>Starost</th>
                  <th style={styles.th}>Impr.</th>
                  <th style={styles.th}>Clicks</th>
                  <th style={styles.th}>CTR</th>
                  <th style={styles.th}>Pos.</th>
                  <th style={styles.th}>Views</th>
                  <th style={styles.th}>Eng.</th>
                  <th style={styles.th}>Str/Ses</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((art, i) => (
                  <tr key={i} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                    <td style={styles.td}>{STATUS_ICONS[art.status]}</td>
                    <td style={styles.tdTitle}>
                      <div style={styles.titleText}>
                        {art.seo_title || art.url}
                        {art.style && <span style={styles.styleBadge}>{art.style}</span>}
                      </div>
                      <div style={styles.urlText}>{art.url}</div>
                      {art.top_queries.length > 0 && (
                        <div style={styles.queries}>
                          🔑{' '}
                          {art.top_queries.slice(0, 3).map((q, qi) => (
                            <span key={qi} style={styles.queryChip}>{q.query}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={styles.td}>
                      {art.age_days !== null ? `${art.age_days}d` : '—'}
                    </td>
                    <td style={styles.tdNum}>{formatNum(art.impressions)}</td>
                    <td style={styles.tdNum}>{formatNum(art.clicks)}</td>
                    <td style={{
                      ...styles.tdNum,
                      color: art.ctr > 6 ? '#10b981' : art.ctr < 2 && art.status !== 'early' ? '#ef4444' : '#e2e8f0',
                    }}>
                      {art.ctr}%
                    </td>
                    <td style={styles.tdNum}>{art.avg_position || '—'}</td>
                    <td style={styles.tdNum}>{formatNum(art.pageviews)}</td>
                    <td style={styles.tdNum}>{formatSec(art.avg_engagement_sec)}</td>
                    <td style={styles.tdNum}>{art.pages_per_session}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={styles.legend}>
            🕐 Rani podaci (&lt;7d) &nbsp;│&nbsp; ✅ OK &nbsp;│&nbsp; ⚠️ Nizak CTR &nbsp;│&nbsp; 🔥 Top performer
          </div>
        </div>
      )}
    </div>
  );
}

// ── Metric Box Component ──
function MetricBox({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div style={styles.metricBox}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={{ ...styles.metricValue, ...(highlight ? { color: '#10b981' } : {}) }}>{value}</div>
      <div style={styles.metricSub}>{sub}</div>
    </div>
  );
}

// ── Styles ──
const styles: Record<string, React.CSSProperties> = {
  // Login
  loginContainer: {
    minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center',
    background: '#0f172a', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  loginCard: {
    background: '#1e293b', borderRadius: 16, padding: 48, textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)', border: '1px solid #334155', maxWidth: 400,
  },
  loginTitle: { color: '#e2e8f0', margin: '0 0 8px', fontSize: 28 },
  loginSubtitle: { color: '#64748b', margin: '0 0 24px' },
  input: {
    width: '100%', padding: '12px 16px', borderRadius: 8, border: '1px solid #475569',
    background: '#0f172a', color: '#e2e8f0', fontSize: 16, marginBottom: 16,
    boxSizing: 'border-box',
  },
  loginBtn: {
    width: '100%', padding: '12px 24px', borderRadius: 8, border: 'none',
    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#fff', fontSize: 16,
    cursor: 'pointer', fontWeight: 600,
  },
  errorText: { color: '#ef4444', marginTop: 12 },

  // Dashboard
  container: {
    minHeight: '100vh', background: '#0f172a', color: '#e2e8f0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', padding: '0 24px 48px',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '24px 0', borderBottom: '1px solid #1e293b',
  },
  headerLeft: {},
  headerRight: {},
  headerTitle: { margin: 0, fontSize: 24, fontWeight: 700 },
  periodBar: { display: 'flex', gap: 4 },
  periodBtn: {
    padding: '8px 16px', borderRadius: 8, border: '1px solid #334155',
    background: '#1e293b', color: '#94a3b8', cursor: 'pointer', fontSize: 14,
  },
  periodBtnActive: {
    background: '#3b82f6', color: '#fff', borderColor: '#3b82f6',
  },

  // Tabs
  tabs: { display: 'flex', gap: 4, marginTop: 20 },
  tab: {
    padding: '10px 24px', borderRadius: '8px 8px 0 0', border: '1px solid #334155',
    borderBottom: 'none', background: '#1e293b', color: '#94a3b8', cursor: 'pointer', fontSize: 15,
  },
  tabActive: { background: '#334155', color: '#e2e8f0' },

  // Loading/Error
  loading: { textAlign: 'center', padding: 40, color: '#64748b', fontSize: 18 },
  error: { textAlign: 'center', padding: 20, color: '#ef4444', background: '#1e1e2e', borderRadius: 8, margin: '20px 0' },

  // Overview
  overviewGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 20, marginTop: 20 },
  portalCard: {
    background: '#1e293b', borderRadius: 12, padding: 24,
    border: '1px solid #334155',
  },
  portalHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 },
  portalFlag: { fontSize: 28 },
  portalName: { margin: 0, fontSize: 18, fontWeight: 600 },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 },
  metricBox: {
    background: '#0f172a', borderRadius: 8, padding: '12px 8px', textAlign: 'center',
  },
  metricLabel: { fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase' as const },
  metricValue: { fontSize: 20, fontWeight: 700, color: '#e2e8f0' },
  metricSub: { fontSize: 10, color: '#475569', marginTop: 2 },
  countries: { marginTop: 16, fontSize: 13, color: '#94a3b8' },
  countryChip: {
    display: 'inline-block', background: '#0f172a', borderRadius: 4,
    padding: '2px 8px', margin: '2px 4px', fontSize: 12,
  },
  seoGemBadge: {
    marginTop: 16, padding: '8px 12px', background: '#0f172a', borderRadius: 8,
    fontSize: 13, color: '#94a3b8', textAlign: 'center',
  },

  // Articles
  portalSelector: { display: 'flex', gap: 8, margin: '20px 0' },
  portalBtn: {
    padding: '10px 20px', borderRadius: 8, border: '1px solid #334155',
    background: '#1e293b', color: '#94a3b8', cursor: 'pointer', fontSize: 14,
  },
  portalBtnActive: { background: '#3b82f6', color: '#fff', borderColor: '#3b82f6' },

  tableContainer: {
    overflowX: 'auto' as const, borderRadius: 12, border: '1px solid #334155',
    background: '#1e293b',
  },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
  th: {
    padding: '12px 10px', textAlign: 'left' as const, background: '#0f172a',
    color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' as const,
    borderBottom: '1px solid #334155', whiteSpace: 'nowrap' as const,
  },
  trEven: { background: '#1e293b' },
  trOdd: { background: '#1a2332' },
  td: { padding: '10px', borderBottom: '1px solid #1e293b33', whiteSpace: 'nowrap' as const },
  tdTitle: { padding: '10px', borderBottom: '1px solid #1e293b33', maxWidth: 400 },
  titleText: { fontWeight: 600, color: '#e2e8f0', marginBottom: 4 },
  urlText: { fontSize: 11, color: '#475569', wordBreak: 'break-all' as const },
  styleBadge: {
    display: 'inline-block', marginLeft: 8, padding: '1px 6px', borderRadius: 4,
    background: '#3b82f633', color: '#60a5fa', fontSize: 10,
  },
  queries: { marginTop: 6, fontSize: 11, color: '#94a3b8' },
  queryChip: {
    display: 'inline-block', background: '#0f172a', borderRadius: 3,
    padding: '1px 6px', margin: '1px 3px', fontSize: 11,
  },
  tdNum: { padding: '10px', borderBottom: '1px solid #1e293b33', textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' },
  legend: { textAlign: 'center', padding: '16px 0', color: '#64748b', fontSize: 13 },
};
