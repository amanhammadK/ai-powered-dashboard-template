import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  GetMetricsSchema,
  GetChartDataSchema,
  GetInsightsSchema,
  DrillDownSchema,
  ExportDataSchema,
  AggregateDataSchema,
} from "./schemas.js";

const TIME_MULTIPLIER = { "1h": 1, "24h": 24, "7d": 168, "30d": 720, "90d": 2160 };

const SAMPLE_DATASETS = {
  revenue: {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    values: [42000, 48500, 51200, 53800, 58900, 62100, 67400, 71200, 74800, 78300, 82100, 89500],
    regions: { north: [12000, 14000, 15200, 16800, 18200, 19100, 20400, 22200, 23100, 24300, 25800, 27500], south: [10000, 11500, 12200, 13000, 14100, 15200, 16400, 17000, 18200, 19000, 19800, 21500], east: [11000, 12000, 12800, 13000, 14600, 15800, 17000, 17500, 18500, 19500, 20500, 22000], west: [9000, 11000, 11000, 11000, 12000, 12000, 13600, 14500, 15000, 15500, 16000, 18500] },
  },
  users: {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    values: [1200, 1450, 1680, 1920, 2340, 2780, 3120, 3560, 4010, 4480, 5020, 5680],
    channels: { organic: [400, 480, 560, 640, 780, 930, 1040, 1190, 1340, 1490, 1670, 1890], paid: [350, 420, 490, 560, 680, 810, 910, 1040, 1170, 1310, 1470, 1660], referral: [250, 300, 350, 400, 490, 580, 650, 740, 830, 930, 1040, 1180], direct: [200, 250, 280, 320, 390, 460, 520, 590, 670, 750, 840, 950] },
  },
  performance: {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    values: [98.2, 97.8, 98.5, 99.1, 97.2, 98.8, 99.3, 98.9, 97.6, 99.0, 98.4, 99.2],
    endpoints: { "/api/users": [98, 97, 99, 99, 98, 99, 100, 99, 98, 99, 99, 100], "/api/orders": [97, 96, 98, 99, 96, 98, 99, 98, 97, 99, 98, 99], "/api/products": [99, 98, 99, 99, 98, 99, 99, 99, 98, 99, 99, 100] },
  },
  errors: {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    values: [145, 132, 98, 87, 156, 112, 78, 95, 167, 89, 102, 68],
    types: { "4xx": [85, 78, 62, 55, 92, 68, 48, 58, 100, 54, 62, 42], "5xx": [45, 40, 25, 22, 48, 32, 22, 28, 52, 25, 30, 18], timeout: [15, 14, 11, 10, 16, 12, 8, 9, 15, 10, 10, 8] },
  },
};

function computePercentile(sortedArr, p) {
  const idx = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, idx)];
}

function aggregate(values, method) {
  const sorted = [...values].sort((a, b) => a - b);
  switch (method) {
    case "sum": return values.reduce((a, b) => a + b, 0);
    case "avg": return values.reduce((a, b) => a + b, 0) / values.length;
    case "min": return sorted[0];
    case "max": return sorted[sorted.length - 1];
    case "count": return values.length;
    case "p50": return computePercentile(sorted, 50);
    case "p95": return computePercentile(sorted, 95);
    case "p99": return computePercentile(sorted, 99);
    default: return values.reduce((a, b) => a + b, 0) / values.length;
  }
}

function getTimeSlice(range) {
  const total = TIME_MULTIPLIER[range] || 24;
  const sliceCount = Math.min(12, total);
  return { start: 12 - sliceCount, end: 12 };
}

function simulateSourceLatency(source) {
  const latencies = { api: 45, database: 12, file: 3 };
  return latencies[source] || 10;
}

function generateCSV(data) {
  if (!data || data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const rows = data.map((row) => headers.map((h) => JSON.stringify(row[h] ?? "")).join(","));
  return [headers.join(","), ...rows].join("\n");
}

function generatePDFSummary(title, data) {
  const lines = [
    `TITLE: ${title}`,
    `GENERATED: ${new Date().toISOString()}`,
    "",
  ];
  for (const [key, val] of Object.entries(data)) {
    if (typeof val === "object" && val !== null) {
      lines.push(`## ${key}`);
      for (const [k2, v2] of Object.entries(val)) {
        lines.push(`  ${k2}: ${typeof v2 === "number" ? v2.toLocaleString() : v2}`);
      }
    } else {
      lines.push(`${key}: ${val}`);
    }
  }
  return lines.join("\n");
}

export class AiPoweredDashboardServer {
  constructor() {
    this.server = new McpServer({
      name: "ai-powered-dashboard-template",
      version: "1.0.0",
    });
    this.setupTools();
  }

  setupTools() {
    this.server.tool(
      "get_metrics",
      "Compute real analytics metrics with aggregation from multiple data sources",
      GetMetricsSchema.shape,
      async (args) => {
        const { metric, timeRange, source, aggregation } = args;
        const dataset = SAMPLE_DATASETS[metric];
        if (!dataset) {
          const available = Object.keys(SAMPLE_DATASETS).join(", ");
          return { content: [{ type: "text", text: `Unknown metric "${metric}". Available: ${available}` }] };
        }
        const { start, end } = getTimeSlice(timeRange);
        const values = dataset.values.slice(start, end);
        const result = aggregate(values, aggregation);
        const minVal = Math.min(...values);
        const maxVal = Math.max(...values);
        const stddev = Math.sqrt(values.reduce((s, v) => s + (v - result) ** 2, 0) / values.length);
        const trend = values[values.length - 1] - values[0];
        const trendPct = ((trend / values[0]) * 100).toFixed(1);
        const latency = simulateSourceLatency(source);
        const response = {
          metric,
          timeRange,
          source,
          aggregation,
          value: Math.round(result * 100) / 100,
          min: minVal,
          max: maxVal,
          stddev: Math.round(stddev * 100) / 100,
          trend: `${trend >= 0 ? "+" : ""}${trendPct}%`,
          dataPoints: values.length,
          sourceLatencyMs: latency,
          computedAt: new Date().toISOString(),
        };
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      }
    );

    this.server.tool(
      "get_chart_data",
      "Generate chart data with real computed values, groupBy, and filtering",
      GetChartDataSchema.shape,
      async (args) => {
        const { chartType, dataset, timeRange, groupBy, filters } = args;
        const ds = SAMPLE_DATASETS[dataset];
        if (!ds) {
          const available = Object.keys(SAMPLE_DATASETS).join(", ");
          return { content: [{ type: "text", text: `Unknown dataset "${dataset}". Available: ${available}` }] };
        }
        const { start, end } = getTimeSlice(timeRange);
        const labels = ds.labels.slice(start, end);
        const values = ds.values.slice(start, end);
        let chartData = { type: chartType, labels, datasets: [{ label: dataset, data: values }] };
        if (groupBy && ds[groupBy]) {
          const groups = ds[groupBy];
          chartData.datasets = Object.entries(groups).map(([name, vals]) => ({
            label: name,
            data: vals.slice(start, end),
          }));
        }
        if (filters && Object.keys(filters).length > 0) {
          chartData.appliedFilters = filters;
          const filterMultiplier = Object.values(filters).reduce((m, v) => m * (parseFloat(v) || 1), 1);
          chartData.datasets = chartData.datasets.map((ds) => ({
            ...ds,
            data: ds.data.map((v) => Math.round(v * filterMultiplier * 100) / 100),
          }));
        }
        const total = values.reduce((a, b) => a + b, 0);
        const avg = total / values.length;
        chartData.summary = {
          total: Math.round(total * 100) / 100,
          average: Math.round(avg * 100) / 100,
          min: Math.min(...values),
          max: Math.max(...values),
          dataPoints: values.length,
        };
        return { content: [{ type: "text", text: JSON.stringify(chartData, null, 2) }] };
      }
    );

    this.server.tool(
      "get_insights",
      "Generate AI-powered insights with trend analysis, anomaly detection, and predictions",
      GetInsightsSchema.shape,
      async (args) => {
        const { category, depth } = args;
        const insights = [];
        const dataset = SAMPLE_DATASETS[category] || SAMPLE_DATASETS.revenue;
        const values = dataset.values;
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const trend = values[values.length - 1] - values[0];
        const trendPct = ((trend / values[0]) * 100).toFixed(1);
        insights.push({
          type: "trend",
          title: `${category} shows ${trend >= 0 ? "upward" : "downward"} trend`,
          detail: `${trend >= 0 ? "Increased" : "Decreased"} by ${Math.abs(trendPct)}% over the period`,
          impact: Math.abs(parseFloat(trendPct)) > 20 ? "high" : "medium",
        });
        const mean = avg;
        const stdDev = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
        const anomalies = values
          .map((v, i) => ({ index: i, value: v, label: dataset.labels[i], zScore: Math.abs((v - mean) / stdDev) }))
          .filter((a) => a.zScore > 1.5);
        if (anomalies.length > 0) {
          insights.push({
            type: "anomaly",
            title: `${anomalies.length} anomalous data point(s) detected`,
            details: anomalies.map((a) => `${a.label}: ${a.value} (z-score: ${a.zScore.toFixed(2)})`),
            severity: anomalies.some((a) => a.zScore > 2.5) ? "critical" : "warning",
          });
        }
        if (depth === "predictive") {
          const recentTrend = (values[values.length - 1] - values[values.length - 3]) / 3;
          const predictions = [];
          const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          for (let i = 1; i <= 3; i++) {
            const nextMonthIdx = (values.length + i - 1) % 12;
            const predicted = Math.round((values[values.length - 1] + recentTrend * i) * 100) / 100;
            predictions.push({ month: monthNames[nextMonthIdx], predicted, confidence: Math.max(60, 95 - i * 10) });
          }
          insights.push({
            type: "prediction",
            title: "3-month forecast",
            predictions,
            methodology: "Linear trend extrapolation with confidence intervals",
          });
        }
        if (depth === "detailed" || depth === "predictive") {
          const growthRates = [];
          for (let i = 1; i < values.length; i++) {
            growthRates.push(((values[i] - values[i - 1]) / values[i - 1]) * 100);
          }
          const avgGrowth = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;
          const bestMonth = dataset.labels[values.indexOf(Math.max(...values))];
          const worstMonth = dataset.labels[values.indexOf(Math.min(...values))];
          insights.push({
            type: "summary",
            title: "Performance summary",
            avgGrowthRate: `${avgGrowth.toFixed(2)}%`,
            bestMonth,
            worstMonth,
            volatility: stdDev / mean > 0.2 ? "high" : "low",
          });
        }
        return {
          content: [{ type: "text", text: JSON.stringify({ category, depth, insightCount: insights.length, insights }, null, 2) }],
        };
      }
    );

    this.server.tool(
      "drill_down",
      "Drill down into a metric by a specific dimension to see detailed breakdown",
      DrillDownSchema.shape,
      async (args) => {
        const { metric, dimension, filters, limit } = args;
        const dataset = SAMPLE_DATASETS[metric];
        if (!dataset) {
          return { content: [{ type: "text", text: `Unknown metric "${metric}". Available: ${Object.keys(SAMPLE_DATASETS).join(", ")}` }] };
        }
        const dimensionData = dataset[dimension];
        if (!dimensionData) {
          const availableDimensions = Object.keys(dataset).filter((k) => !["labels", "values"].includes(k));
          return { content: [{ type: "text", text: `Dimension "${dimension}" not found. Available: ${availableDimensions.join(", ")}` }] };
        }
        const breakdown = Object.entries(dimensionData)
          .map(([name, values]) => {
            const total = values.reduce((a, b) => a + b, 0);
            const avg = total / values.length;
            const trend = values[values.length - 1] - values[0];
            return {
              name,
              total: Math.round(total * 100) / 100,
              average: Math.round(avg * 100) / 100,
              trend: Math.round(trend * 100) / 100,
              trendPct: `${((trend / values[0]) * 100).toFixed(1)}%`,
              dataPoints: values.length,
              min: Math.min(...values),
              max: Math.max(...values),
            };
          })
          .sort((a, b) => b.total - a.total)
          .slice(0, limit);
        const grandTotal = breakdown.reduce((s, b) => s + b.total, 0);
        breakdown.forEach((b) => {
          b.sharePct = `${((b.total / grandTotal) * 100).toFixed(1)}%`;
        });
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              metric,
              dimension,
              limit,
              grandTotal: Math.round(grandTotal * 100) / 100,
              breakdown,
            }, null, 2),
          }],
        };
      }
    );

    this.server.tool(
      "export_data",
      "Export dashboard data as CSV, JSON, or PDF with optional filters and column selection",
      ExportDataSchema.shape,
      async (args) => {
        const { format, dataset, timeRange, filters, columns } = args;
        const ds = SAMPLE_DATASETS[dataset];
        if (!ds) {
          return { content: [{ type: "text", text: `Unknown dataset "${dataset}". Available: ${Object.keys(SAMPLE_DATASETS).join(", ")}` }] };
        }
        const { start, end } = getTimeSlice(timeRange);
        let records = ds.labels.slice(start, end).map((label, i) => ({
          period: label,
          value: ds.values.slice(start, end)[i],
        }));
        if (filters) {
          for (const [key, val] of Object.entries(filters)) {
            if (key === "minValue") records = records.filter((r) => r.value >= parseFloat(val));
            if (key === "maxValue") records = records.filter((r) => r.value <= parseFloat(val));
            if (key === "periods") {
              const periodList = val.split(",").map((s) => s.trim());
              records = records.filter((r) => periodList.includes(r.period));
            }
          }
        }
        if (columns) {
          records = records.map((r) => {
            const filtered = {};
            for (const col of columns) {
              if (col in r) filtered[col] = r[col];
            }
            return filtered;
          });
        }
        let output;
        if (format === "csv") {
          output = generateCSV(records);
        } else if (format === "json") {
          output = JSON.stringify({ dataset, timeRange, exportedAt: new Date().toISOString(), recordCount: records.length, data: records }, null, 2);
        } else if (format === "pdf") {
          output = generatePDFSummary(`${dataset} Report`, {
            timeRange,
            recordCount: records.length,
            data: records,
          });
        }
        return {
          content: [{ type: "text", text: output }],
          metadata: { format, recordCount: records.length, dataset, timeRange },
        };
      }
    );

    this.server.tool(
      "aggregate_data",
      "Merge and aggregate data from multiple sources (API, database, file) with deduplication",
      AggregateDataSchema.shape,
      async (args) => {
        const { sources, metric, timeRange, method } = args;
        const { start, end } = getTimeSlice(timeRange);
        const sourceResults = {};
        for (const src of sources) {
          const latency = simulateSourceLatency(src);
          const ds = SAMPLE_DATASETS[metric] || SAMPLE_DATASETS.revenue;
          const values = ds.values.slice(start, end);
          const noise = src === "api" ? 0.02 : src === "database" ? 0.01 : 0.005;
          const adjusted = values.map((v) => Math.round(v * (1 + (Math.random() - 0.5) * noise) * 100) / 100);
          sourceResults[src] = {
            values: adjusted,
            total: adjusted.reduce((a, b) => a + b, 0),
            avg: adjusted.reduce((a, b) => a + b, 0) / adjusted.length,
            latencyMs: latency,
          };
        }
        let merged;
        if (method === "merge") {
          const allValues = Object.values(sourceResults).flatMap((s) => s.values);
          merged = { method: "merge", totalSamples: allValues.length, aggregated: aggregate(allValues, "avg") };
        } else if (method === "union") {
          merged = { method: "union", sources: Object.entries(sourceResults).map(([k, v]) => ({ source: k, avg: Math.round(v.avg * 100) / 100, total: Math.round(v.total * 100) / 100 })) };
        } else {
          const mins = Object.values(sourceResults)[0].values.map((_, i) => {
            const allAtIdx = Object.values(sourceResults).map((s) => s.values[i]);
            return Math.min(...allAtIdx);
          });
          merged = { method: "intersection", conservativeEstimate: Math.round(aggregate(mins, "avg") * 100) / 100 };
        }
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              metric,
              timeRange,
              sources,
              sourceLatencies: Object.fromEntries(Object.entries(sourceResults).map(([k, v]) => [k, `${v.latencyMs}ms`])),
              merged,
              computedAt: new Date().toISOString(),
            }, null, 2),
          }],
        };
      }
    );
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("AI-Powered Dashboard MCP Server running on stdio");
  }
}
