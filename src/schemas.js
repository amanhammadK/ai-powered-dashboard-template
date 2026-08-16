import { z } from "zod";

export const GetMetricsSchema = z.object({
  metric: z.string().min(1, "Metric name is required"),
  timeRange: z
    .enum(["1h", "24h", "7d", "30d", "90d"])
    .optional()
    .default("24h"),
  source: z
    .enum(["api", "database", "file"])
    .optional()
    .default("api"),
  aggregation: z
    .enum(["sum", "avg", "min", "max", "count", "p50", "p95", "p99"])
    .optional()
    .default("avg"),
});

export const GetChartDataSchema = z.object({
  chartType: z.enum(["line", "bar", "pie", "doughnut", "area", "scatter"]),
  dataset: z.string().min(1, "Dataset name is required"),
  timeRange: z
    .enum(["1h", "24h", "7d", "30d", "90d"])
    .optional()
    .default("24h"),
  groupBy: z.string().optional(),
  filters: z.record(z.string()).optional(),
});

export const GetInsightsSchema = z.object({
  category: z.string().min(1, "Category is required"),
  depth: z.enum(["summary", "detailed", "predictive"]).optional().default("detailed"),
});

export const DrillDownSchema = z.object({
  metric: z.string().min(1, "Metric name is required"),
  dimension: z.string().min(1, "Dimension to drill down by"),
  filters: z.record(z.string()).optional(),
  limit: z.number().int().positive().optional().default(20),
});

export const ExportDataSchema = z.object({
  format: z.enum(["csv", "json", "pdf"]),
  dataset: z.string().min(1, "Dataset name is required"),
  timeRange: z
    .enum(["1h", "24h", "7d", "30d", "90d"])
    .optional()
    .default("24h"),
  filters: z.record(z.string()).optional(),
  columns: z.array(z.string()).optional(),
});

export const AggregateDataSchema = z.object({
  sources: z.array(z.enum(["api", "database", "file"])).min(1, "At least one source required"),
  metric: z.string().min(1, "Metric name is required"),
  timeRange: z
    .enum(["1h", "24h", "7d", "30d", "90d"])
    .optional()
    .default("24h"),
  method: z.enum(["merge", "union", "intersection"]).optional().default("merge"),
});
