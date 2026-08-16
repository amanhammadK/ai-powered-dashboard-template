import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler);

async function callTool(tool: string, args: Record<string, unknown>) {
  const res = await fetch('/api/dashboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, args }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Tool ${tool} failed`);
  }
  return res.json();
}

const fmtCurrency = (v: unknown) => `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const fmtNumber = (v: unknown) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 });

export default function Dashboard() {
  const [activeSection, setActiveSection] = useState('overview');
  const [generating, setGenerating] = useState(false);
  const [insightText, setInsightText] = useState('');

  const [kpis, setKpis] = useState<Array<{ label: string; value: string; change: string; up: boolean }> | null>(null);
  const [revenueChart, setRevenueChart] = useState<any>(null);
  const [usersChart, setUsersChart] = useState<any>(null);
  const [trafficChart, setTrafficChart] = useState<any>(null);
  const [insights, setInsights] = useState<Array<Record<string, any>> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError('');

        const [metricsRes, usersRes, perfRes, errorsRes] = await Promise.all([
          callTool('get_metrics', { metric: 'revenue', timeRange: '30d', source: 'api', aggregation: 'sum' }),
          callTool('get_metrics', { metric: 'users', timeRange: '30d', source: 'api', aggregation: 'sum' }),
          callTool('get_metrics', { metric: 'performance', timeRange: '30d', source: 'api', aggregation: 'avg' }),
          callTool('get_metrics', { metric: 'errors', timeRange: '30d', source: 'api', aggregation: 'sum' }),
        ]);

        const [chartData, insights, drill] = await Promise.all([
          callTool('get_chart_data', { chartType: 'line', dataset: 'revenue', timeRange: '30d' }),
          callTool('get_insights', { category: 'revenue', depth: 'predictive' }),
          callTool('drill_down', { metric: 'users', dimension: 'channels', limit: 4 }),
        ]);

        if (cancelled) return;

        const kpiDefs = [
          { label: 'Total Revenue', value: fmtCurrency(metricsRes.value), change: metricsRes.trend, up: !metricsRes.trend.startsWith('-') },
          { label: 'Active Users', value: fmtNumber(usersRes.value), change: usersRes.trend, up: !usersRes.trend.startsWith('-') },
          { label: 'Avg Uptime', value: `${Number(perfRes.value).toFixed(1)}%`, change: perfRes.trend, up: !perfRes.trend.startsWith('-') },
          { label: 'Total Errors', value: fmtNumber(errorsRes.value), change: errorsRes.trend, up: errorsRes.trend.startsWith('-') },
        ];
        setKpis(kpiDefs);

        setRevenueChart({
          labels: chartData.labels,
          datasets: chartData.datasets.map((d: any, i: number) => ({
            label: d.label,
            data: d.data,
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.12)',
            fill: i === 0,
            tension: 0.4,
            pointRadius: 3,
          })),
        });

        const channelData = await callTool('get_chart_data', { chartType: 'bar', dataset: 'users', timeRange: '30d', groupBy: 'channels' });
        const trafficByChannel = drill.breakdown || [];
        setUsersChart({
          labels: channelData.labels,
          datasets: channelData.datasets.map((d: any) => ({
            label: d.label,
            data: d.data,
            backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6'][channelData.datasets.indexOf(d) % 4],
            borderRadius: 4,
          })),
        });
        setTrafficChart({
          labels: trafficByChannel.map((b: any) => b.name),
          datasets: [{
            data: trafficByChannel.map((b: any) => b.total),
            backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6'],
            borderWidth: 0,
          }],
        });

        setInsights(insights.insights || []);
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const generateInsight = async () => {
    setGenerating(true);
    setInsightText('');
    try {
      const res = await callTool('get_insights', { category: activeSection === 'errors' ? 'errors' : activeSection === 'users' ? 'users' : 'revenue', depth: 'predictive' });
      const first = res.insights?.[0];
      setInsightText(first ? `${first.title} — ${first.detail || first.details?.join(', ') || ''}` : 'No insight returned.');
    } catch (e: any) {
      setInsightText(`Could not generate insight: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const navItems = [
    ['overview', 'Overview'],
    ['revenue', 'Revenue'],
    ['users', 'Users'],
    ['performance', 'Performance'],
    ['errors', 'Errors'],
  ];

  const sectionIcons: Record<string, string> = {
    overview: '📊', revenue: '💰', users: '👥', performance: '⚡', errors: '🚨',
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f1f5f9', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <aside style={{ width: 240, background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)', color: '#e2e8f0', padding: '2rem 0', flexShrink: 0, position: 'relative', boxShadow: '4px 0 24px rgba(0,0,0,0.15)' }}>
        <div style={{ padding: '0 1.5rem', marginBottom: '2.5rem' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>Pulse</div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Analytics Dashboard</div>
        </div>
        <nav style={{ padding: '0 0.75rem' }}>
          {navItems.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', textAlign: 'left', padding: '0.7rem 1rem',
                background: activeSection === key ? 'rgba(99,102,241,0.15)' : 'transparent',
                color: activeSection === key ? '#c7d2fe' : '#94a3b8', border: 'none', cursor: 'pointer',
                borderLeft: activeSection === key ? '3px solid #818cf8' : '3px solid transparent',
                fontSize: '0.875rem', fontWeight: activeSection === key ? 600 : 400,
                borderRadius: '0 6px 6px 0', transition: 'all 0.15s ease',
              }}
            >
              <span style={{ fontSize: '1rem' }}>{sectionIcons[key]}</span>
              {label}
            </button>
          ))}
        </nav>
        <div style={{ position: 'absolute', bottom: '1.5rem', left: '1.5rem', fontSize: '0.65rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
          Live &middot; v1.0.0
        </div>
      </aside>

      <main style={{ flex: 1, padding: '2rem 2.5rem', maxWidth: 1200 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: '#0f172a', letterSpacing: '-0.02em' }}>
              {activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.8rem', margin: '0.35rem 0 0' }}>
              Live data via MCP server &middot; tools: get_metrics, get_chart_data, get_insights, drill_down
            </p>
          </div>
          <button
            onClick={generateInsight}
            disabled={generating}
            style={{
              padding: '0.6rem 1.5rem', background: generating ? '#94a3b8' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: '#fff', border: 'none',
              borderRadius: 8, cursor: generating ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.85rem',
              boxShadow: generating ? 'none' : '0 2px 8px rgba(99,102,241,0.3)', transition: 'all 0.2s ease',
            }}
          >
            {generating ? 'Analyzing...' : 'Generate AI Insight'}
          </button>
        </div>

        {error && (
          <div style={{
            marginBottom: '1.5rem', padding: '1rem 1.25rem', background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 8, fontSize: '0.9rem', color: '#b91c1c',
          }}>
            Could not reach the MCP server. Start it with <code>node src/index.js</code> (or run <code>npm run dev</code>). Error: {error}
          </div>
        )}

        {insightText && (
          <div style={{
            marginBottom: '1.5rem', padding: '1rem 1.25rem', background: '#eef2ff', border: '1px solid #c7d2fe',
            borderRadius: 8, fontSize: '0.9rem', color: '#3730a3',
          }}>
            <strong>AI Insight:</strong> {insightText}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b', fontSize: '0.95rem' }}>
            Fetching live data from the MCP server...
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
              {(kpis || []).map((k, i) => (
                <div key={k.label} style={{
                  background: '#fff', borderRadius: 12, padding: '1.25rem 1.5rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
                  borderLeft: `3px solid ${['#6366f1', '#10b981', '#f59e0b', '#ef4444'][i]}`,
                  transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                }}>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>{k.label}</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', marginTop: '0.35rem', letterSpacing: '-0.02em' }}>{k.value}</div>
                  <div style={{
                    color: k.up ? '#10b981' : '#ef4444', fontSize: '0.75rem', fontWeight: 600, marginTop: '0.25rem',
                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                  }}>
                    {k.up ? '↑' : '↓'} {k.change}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginBottom: '1.25rem' }}>Revenue Over Time</div>
                {revenueChart ? (
                  <Line data={revenueChart} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 } } }, x: { grid: { display: false }, ticks: { font: { size: 11 } } } } }} />
                ) : <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No data</div>}
              </div>
              <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginBottom: '1.25rem' }}>Traffic Share</div>
                {trafficChart ? (
                  <Doughnut data={trafficChart} options={{ responsive: true, plugins: { legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, font: { size: 11 } } } }, cutout: '68%' }} />
                ) : <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No data</div>}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
              <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginBottom: '1.25rem' }}>Users by Channel</div>
                {usersChart ? (
                  <Bar data={usersChart} options={{ responsive: true, plugins: { legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, font: { size: 11 } } } }, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 } } } } }} />
                ) : <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No data</div>}
              </div>
              <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>AI Insights</div>
                {(insights || []).length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No insights</div>
                ) : (insights || []).slice(0, 3).map(ins => (
                  <div key={ins.title} style={{ padding: '0.75rem 0', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{
                        display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: 4,
                        fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 700,
                        background: ins.type === 'anomaly' ? '#fef2f2' : ins.type === 'prediction' ? '#f0fdf4' : '#eef2ff',
                        color: ins.type === 'anomaly' ? '#ef4444' : ins.type === 'prediction' ? '#16a34a' : '#6366f1',
                      }}>
                        {ins.type}
                      </span>
                      {ins.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.3rem', lineHeight: 1.4 }}>
                      {ins.detail || ins.details?.join(', ') || (ins.predictions ? ins.predictions.map((p: any) => `${p.month}: $${Math.round(p.predicted).toLocaleString()}`).join(' → ') : '')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}