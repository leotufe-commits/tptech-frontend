// src/services/dashboard-profit.ts
import { apiFetch } from "../lib/api";

export type ProfitGroupBy = "day" | "week" | "month";

export type ProfitSeriesPoint = {
  date: string;
  revenue: number;
  cost: number;
  margin: number;
};

export type ProfitTopArticle = {
  articleId: string;
  articleName: string;
  revenue: number;
  cost: number;
  margin: number;
  marginPercent: number;
  quantity: number;
};

export type ProfitTotals = {
  revenue: number;
  cost: number;
  margin: number;
  marginPercent: number;
  linesCount: number;
  linesWithCost: number;
  linesWithoutCost: number;
  linesNegativeMargin: number;
  salesWithNegativeMargin: number;
};

export type ProfitSummary = {
  period: { from: string; to: string; groupBy: ProfitGroupBy };
  totals: ProfitTotals;
  series: ProfitSeriesPoint[];
  topArticles: ProfitTopArticle[];
};

export type ProfitParams = {
  from: string;  // YYYY-MM-DD
  to: string;    // YYYY-MM-DD
  groupBy?: ProfitGroupBy;
};

export const dashboardProfitApi = {
  get: (params: ProfitParams) => {
    const qs = new URLSearchParams();
    qs.set("from", params.from);
    qs.set("to", params.to);
    if (params.groupBy) qs.set("groupBy", params.groupBy);
    return apiFetch<{ ok: true; data: ProfitSummary }>(`/dashboard/profit?${qs}`, {
      on401: "throw",
    });
  },
};
