/**
 * Cost data types for AWS Cost Explorer integration
 */

export interface CostBreakdownItem {
  name: string;
  cost: number;
  percentage: number;
}

export interface AWSCostData {
  totalCost: number;
  currency: string;
  breakdown: CostBreakdownItem[];
  period: { start: string; end: string };
  queriedAt: string;
  source: string;
}

export interface AWSForecastData {
  forecastedCost: number;
  currency: string;
  period: { start: string; end: string };
  queriedAt: string;
}

export interface CostsOverviewResult {
  aws: AWSCostData | { error: string };
  forecast: AWSForecastData | null;
  totalCurrentCost: number;
  currency: string;
  queriedAt: string;
}
