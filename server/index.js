var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import express from 'express';
import { CopilotRuntime, OpenAIAdapter, copilotRuntimeNodeHttpEndpoint, } from '@copilotkit/runtime';
// Load environment variables
var OPENAI_API_KEY = process.env.OPENAI_API_KEY;
var DATADOG_API_KEY = process.env.DATADOG_API_KEY;
var DATADOG_APP_KEY = process.env.DATADOG_APP_KEY;
var DATADOG_SITE = process.env.DATADOG_SITE || 'us5.datadoghq.com';
if (!OPENAI_API_KEY) {
    console.error('Missing OPENAI_API_KEY environment variable');
    process.exit(1);
}
if (!DATADOG_API_KEY || !DATADOG_APP_KEY) {
    console.error('Missing DATADOG_API_KEY or DATADOG_APP_KEY environment variable');
    process.exit(1);
}
var app = express();
app.use(express.json());
// Serve static files in production
import path from 'path';
import { fileURLToPath } from 'url';
var __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, '../dist')));
// Datadog API helper
function queryDatadog(query, from, to) {
    return __awaiter(this, void 0, void 0, function () {
        var url, response, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    url = new URL("https://api.".concat(DATADOG_SITE, "/api/v1/query"));
                    url.searchParams.set('query', query);
                    url.searchParams.set('from', from.toString());
                    url.searchParams.set('to', to.toString());
                    return [4 /*yield*/, fetch(url.toString(), {
                            headers: {
                                'DD-API-KEY': DATADOG_API_KEY,
                                'DD-APPLICATION-KEY': DATADOG_APP_KEY,
                                'Content-Type': 'application/json',
                            },
                        })];
                case 1:
                    response = _a.sent();
                    if (!!response.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, response.text()];
                case 2:
                    error = _a.sent();
                    throw new Error("Datadog API error: ".concat(response.status, " - ").concat(error));
                case 3: return [2 /*return*/, response.json()];
            }
        });
    });
}
// Format bytes to human readable
function formatBytes(bytes) {
    if (bytes === 0)
        return '0 B';
    var k = 1024;
    var sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
// CopilotKit Actions - these are the tools the agent can use
var datadogActions = [
    {
        name: 'fetchMetrics',
        description: "Fetch metrics from Datadog for the monitored EC2 host. Available metrics:\n    - cpuTotal: Combined CPU usage percentage\n    - memUsedPercent: Memory usage percentage  \n    - loadAvg1: 1-minute load average\n    - loadAvg5: 5-minute load average\n    - containersRunning: Number of running Docker containers\n    - networkBytesIn: Network bytes received per second\n    - networkBytesOut: Network bytes sent per second\n    - diskUsedPercent: Disk usage percentage\n    The timeRange can be: 1h, 3h, 6h, 12h, 24h",
        parameters: [
            {
                name: 'metrics',
                type: 'string[]',
                description: 'Array of metric names to fetch (e.g., ["cpuTotal", "memUsedPercent"])',
                required: true,
            },
            {
                name: 'timeRange',
                type: 'string',
                description: 'Time range for the query (e.g., "1h", "24h")',
                required: false,
            },
        ],
        handler: function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var now, hours, from, metricQueries, results, _i, metrics_1, metricName, config, data, series, points, currentValue, previousValue, change, status_1, timeSeries, error_1;
            var metrics = _b.metrics, _c = _b.timeRange, timeRange = _c === void 0 ? '1h' : _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        now = Math.floor(Date.now() / 1000);
                        hours = parseInt(timeRange) || 1;
                        from = now - (hours * 3600);
                        metricQueries = {
                            cpuTotal: {
                                query: 'avg:system.cpu.user{host:i-040ac6026761030ac} + avg:system.cpu.system{host:i-040ac6026761030ac}',
                                displayName: 'CPU Usage',
                                unit: '%',
                                warning: 70,
                                critical: 90,
                            },
                            memUsedPercent: {
                                query: '100 * (avg:system.mem.total{host:i-040ac6026761030ac} - avg:system.mem.usable{host:i-040ac6026761030ac}) / avg:system.mem.total{host:i-040ac6026761030ac}',
                                displayName: 'Memory Usage',
                                unit: '%',
                                warning: 80,
                                critical: 95,
                            },
                            loadAvg1: {
                                query: 'avg:system.load.1{host:i-040ac6026761030ac}',
                                displayName: 'Load Average (1m)',
                                unit: '',
                                warning: 2,
                                critical: 4,
                            },
                            loadAvg5: {
                                query: 'avg:system.load.5{host:i-040ac6026761030ac}',
                                displayName: 'Load Average (5m)',
                                unit: '',
                                warning: 2,
                                critical: 4,
                            },
                            containersRunning: {
                                query: 'avg:docker.containers.running{host:i-040ac6026761030ac}',
                                displayName: 'Running Containers',
                                unit: 'containers',
                            },
                            networkBytesIn: {
                                query: 'avg:system.net.bytes_rcvd{host:i-040ac6026761030ac}',
                                displayName: 'Network In',
                                unit: 'B/s',
                            },
                            networkBytesOut: {
                                query: 'avg:system.net.bytes_sent{host:i-040ac6026761030ac}',
                                displayName: 'Network Out',
                                unit: 'B/s',
                            },
                            diskUsedPercent: {
                                query: 'avg:system.disk.in_use{host:i-040ac6026761030ac} * 100',
                                displayName: 'Disk Usage',
                                unit: '%',
                                warning: 80,
                                critical: 95,
                            },
                        };
                        results = [];
                        _i = 0, metrics_1 = metrics;
                        _d.label = 1;
                    case 1:
                        if (!(_i < metrics_1.length)) return [3 /*break*/, 6];
                        metricName = metrics_1[_i];
                        config = metricQueries[metricName];
                        if (!config) {
                            results.push({ metric: metricName, error: 'Unknown metric' });
                            return [3 /*break*/, 5];
                        }
                        _d.label = 2;
                    case 2:
                        _d.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, queryDatadog(config.query, from, now)];
                    case 3:
                        data = _d.sent();
                        if (data.series && data.series.length > 0) {
                            series = data.series[0];
                            points = series.pointlist || [];
                            currentValue = points.length > 0 ? points[points.length - 1][1] : null;
                            previousValue = points.length > 1 ? points[0][1] : null;
                            change = null;
                            if (currentValue !== null && previousValue !== null && previousValue !== 0) {
                                change = ((currentValue - previousValue) / previousValue) * 100;
                            }
                            status_1 = 'healthy';
                            if (config.critical !== undefined && currentValue >= config.critical) {
                                status_1 = 'critical';
                            }
                            else if (config.warning !== undefined && currentValue >= config.warning) {
                                status_1 = 'warning';
                            }
                            timeSeries = points.map(function (_a) {
                                var ts = _a[0], val = _a[1];
                                return ({
                                    timestamp: new Date(ts).toISOString(),
                                    value: val,
                                });
                            });
                            results.push({
                                metric: metricName,
                                displayName: config.displayName,
                                currentValue: currentValue !== null ? parseFloat(currentValue.toFixed(2)) : null,
                                previousValue: previousValue !== null ? parseFloat(previousValue.toFixed(2)) : null,
                                change: change !== null ? parseFloat(change.toFixed(2)) : null,
                                unit: config.unit,
                                status: status_1,
                                timeSeries: timeSeries,
                                timeRange: timeRange,
                                thresholds: {
                                    warning: config.warning,
                                    critical: config.critical,
                                },
                            });
                        }
                        else {
                            results.push({ metric: metricName, error: 'No data available' });
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _d.sent();
                        results.push({
                            metric: metricName,
                            error: error_1 instanceof Error ? error_1.message : 'Unknown error'
                        });
                        return [3 /*break*/, 5];
                    case 5:
                        _i++;
                        return [3 /*break*/, 1];
                    case 6: return [2 /*return*/, { metrics: results, queriedAt: new Date().toISOString() }];
                }
            });
        }); },
    },
    {
        name: 'getSystemOverview',
        description: 'Get a comprehensive overview of the system health including all key metrics. Use this when the user asks for a general dashboard or system status.',
        parameters: [],
        handler: function () { return __awaiter(void 0, void 0, void 0, function () {
            var now, from, overviewMetrics, results, _i, overviewMetrics_1, metric, data, series, points, currentValue, previousValue, status_2, change, timeSeries, error_2, priorityOrder;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        now = Math.floor(Date.now() / 1000);
                        from = now - 3600;
                        overviewMetrics = [
                            { name: 'cpuTotal', query: 'avg:system.cpu.user{host:i-040ac6026761030ac} + avg:system.cpu.system{host:i-040ac6026761030ac}', displayName: 'CPU Usage', unit: '%', warning: 70, critical: 90 },
                            { name: 'memUsedPercent', query: '100 * (avg:system.mem.total{host:i-040ac6026761030ac} - avg:system.mem.usable{host:i-040ac6026761030ac}) / avg:system.mem.total{host:i-040ac6026761030ac}', displayName: 'Memory Usage', unit: '%', warning: 80, critical: 95 },
                            { name: 'loadAvg1', query: 'avg:system.load.1{host:i-040ac6026761030ac}', displayName: 'Load (1m)', unit: '', warning: 2, critical: 4 },
                            { name: 'containersRunning', query: 'avg:docker.containers.running{host:i-040ac6026761030ac}', displayName: 'Containers', unit: '' },
                            { name: 'diskUsedPercent', query: 'avg:system.disk.in_use{host:i-040ac6026761030ac} * 100', displayName: 'Disk Usage', unit: '%', warning: 80, critical: 95 },
                            { name: 'networkBytesIn', query: 'avg:system.net.bytes_rcvd{host:i-040ac6026761030ac}', displayName: 'Network In', unit: 'B/s' },
                        ];
                        results = [];
                        _i = 0, overviewMetrics_1 = overviewMetrics;
                        _a.label = 1;
                    case 1:
                        if (!(_i < overviewMetrics_1.length)) return [3 /*break*/, 6];
                        metric = overviewMetrics_1[_i];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, queryDatadog(metric.query, from, now)];
                    case 3:
                        data = _a.sent();
                        if (data.series && data.series.length > 0) {
                            series = data.series[0];
                            points = series.pointlist || [];
                            currentValue = points.length > 0 ? points[points.length - 1][1] : null;
                            previousValue = points.length > 1 ? points[0][1] : null;
                            status_2 = 'healthy';
                            if (metric.critical !== undefined && currentValue >= metric.critical) {
                                status_2 = 'critical';
                            }
                            else if (metric.warning !== undefined && currentValue >= metric.warning) {
                                status_2 = 'warning';
                            }
                            change = null;
                            if (currentValue !== null && previousValue !== null && previousValue !== 0) {
                                change = ((currentValue - previousValue) / previousValue) * 100;
                            }
                            timeSeries = points.map(function (_a) {
                                var ts = _a[0], val = _a[1];
                                return ({
                                    timestamp: new Date(ts).toISOString(),
                                    value: val,
                                });
                            });
                            results.push({
                                metric: metric.name,
                                displayName: metric.displayName,
                                currentValue: currentValue !== null ? parseFloat(currentValue.toFixed(2)) : null,
                                change: change !== null ? parseFloat(change.toFixed(2)) : null,
                                unit: metric.unit,
                                status: status_2,
                                timeSeries: timeSeries,
                                thresholds: metric.warning ? { warning: metric.warning, critical: metric.critical } : undefined,
                            });
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        error_2 = _a.sent();
                        console.error("Error fetching ".concat(metric.name, ":"), error_2);
                        return [3 /*break*/, 5];
                    case 5:
                        _i++;
                        return [3 /*break*/, 1];
                    case 6:
                        priorityOrder = { critical: 0, warning: 1, healthy: 2 };
                        results.sort(function (a, b) { return (priorityOrder[a.status] || 2) - (priorityOrder[b.status] || 2); });
                        return [2 /*return*/, {
                                overview: results,
                                host: 'i-040ac6026761030ac',
                                queriedAt: new Date().toISOString(),
                            }];
                }
            });
        }); },
    },
];
// System prompt for the agent
var systemPrompt = "You are an intelligent observability assistant helping users monitor their infrastructure. You have access to real-time metrics from Datadog for an EC2 host running Docker containers (including n8n and langflow).\n\nYour job is to:\n1. Fetch relevant metrics when users ask about system health\n2. Analyze the data and identify any concerning trends\n3. Present the information in a clear, prioritized way\n\nWhen presenting metrics, you should emit structured A2UI components that the frontend will render. After fetching metrics, respond with a JSON block containing the components to display.\n\nFor each metric you want to display, create a component like this:\n\n```a2ui\n{\n  \"components\": [\n    {\n      \"id\": \"unique-id\",\n      \"component\": \"metric_card\",\n      \"source\": \"datadog\",\n      \"priority\": \"high\",\n      \"timestamp\": \"ISO timestamp\",\n      \"props\": {\n        \"title\": \"Metric Name\",\n        \"value\": 42.5,\n        \"unit\": \"%\",\n        \"status\": \"healthy|warning|critical\",\n        \"description\": \"Brief description\"\n      }\n    },\n    {\n      \"id\": \"unique-id-2\", \n      \"component\": \"time_series_chart\",\n      \"source\": \"datadog\",\n      \"priority\": \"medium\",\n      \"timestamp\": \"ISO timestamp\",\n      \"props\": {\n        \"title\": \"CPU Usage Over Time\",\n        \"series\": [{\"name\": \"CPU\", \"data\": [...], \"color\": \"#6366f1\"}],\n        \"yAxisLabel\": \"%\",\n        \"timeRange\": \"1h\"\n      }\n    }\n  ]\n}\n```\n\nPriority should be based on:\n- \"critical\": Metrics exceeding critical thresholds or requiring immediate attention\n- \"high\": Metrics in warning state or showing concerning trends\n- \"medium\": Normal metrics that are important to show\n- \"low\": Supporting or contextual information\n\nAlways prioritize showing the most concerning metrics first. If everything is healthy, mention that and still show the key metrics.\n\nComponent types available:\n- metric_card: Single value with status indicator\n- time_series_chart: Line chart for trends\n- data_table: Tabular data\n- status_indicator: Simple status display\n- progress_bar: Utilization bars\n\nKeep your explanations concise but helpful. Point out any anomalies or trends worth noting.";
import OpenAI from 'openai';
var openai = new OpenAI({ apiKey: OPENAI_API_KEY });
var serviceAdapter = new OpenAIAdapter({
    openai: openai,
    model: 'gpt-4-turbo',
});
// Create CopilotKit runtime
var copilotKit = new CopilotRuntime({
    actions: datadogActions,
    systemPrompt: systemPrompt,
});
// CopilotKit endpoint
app.use('/api/copilotkit', function (req, res) {
    copilotRuntimeNodeHttpEndpoint({
        endpoint: '/api/copilotkit',
        runtime: copilotKit,
        serviceAdapter: serviceAdapter,
    })(req, res);
});
// Direct Datadog API endpoint for testing
app.post('/api/datadog/query', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, query, from, to, result, error_3;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                _a = req.body, query = _a.query, from = _a.from, to = _a.to;
                return [4 /*yield*/, queryDatadog(query, from, to)];
            case 1:
                result = _b.sent();
                res.json(result);
                return [3 /*break*/, 3];
            case 2:
                error_3 = _b.sent();
                res.status(500).json({ error: error_3 instanceof Error ? error_3.message : 'Unknown error' });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Health check
app.get('/api/health', function (req, res) {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// SPA fallback - serve index.html for all non-API routes
app.get('*', function (req, res) {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});
var PORT = process.env.PORT || 4000;
app.listen(PORT, function () {
    console.log("Server running on http://localhost:".concat(PORT));
    console.log("CopilotKit endpoint: http://localhost:".concat(PORT, "/api/copilotkit"));
});
