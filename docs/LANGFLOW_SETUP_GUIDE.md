# LangFlow Datadog Agent Setup Guide

This guide shows you how to configure your LangFlow agent to query all infrastructure metrics dynamically using the centralized metrics configuration.

## Architecture Overview

```
User Question → CopilotKit → Express Server → LangFlow Agent → Datadog API
                                    ↓
                          Metrics Config (metrics-config.ts)
```

## Step 1: Fetch Metrics Configuration

Your Express server now exposes an endpoint that LangFlow can use to fetch available metrics:

**Endpoint**: `GET http://localhost:4000/api/metrics/config`

This returns all available metrics with their:
- ID and display name
- Datadog query string
- Keywords for matching
- Thresholds (warning/critical)
- Category (system, docker, network)

## Step 2: Update Python Interpreter Component

Replace the Python Interpreter code in your LangFlow flow with this dynamic version:

```python
import json
from datetime import datetime, timedelta
from urllib.request import urlopen, Request

# Fetch metrics configuration from server
config_url = "http://localhost:4000/api/metrics/config"
req = Request(config_url)
with urlopen(req) as response:
    config = json.loads(response.read().decode())

# Get user query from Chat Input
user_query = input_value.lower() if 'input_value' in globals() else ""

# Calculate time window (last hour)
now = datetime.utcnow()
one_hour_ago = now - timedelta(hours=1)
from_ts = int(one_hour_ago.timestamp())
to_ts = int(now.timestamp())

# Find matching metrics based on keywords
matches = []
for metric in config['metrics']:
    score = 0
    for keyword in metric['keywords']:
        if keyword.lower() in user_query:
            score += 10

    if metric['category'] in user_query:
        score += 5

    if score > 0:
        matches.append((metric, score))

# Sort by score and get best match
if matches:
    matches.sort(key=lambda x: x[1], reverse=True)
    selected_metric = matches[0][0]
    query_str = selected_metric['query']
    metric_info = {
        "id": selected_metric['id'],
        "name": selected_metric['displayName'],
        "unit": selected_metric['unit'],
        "thresholds": selected_metric['thresholds']
    }
else:
    # Default to CPU if no match
    query_str = f"avg:system.cpu.user{{host:{config['host']}}} + avg:system.cpu.system{{host:{config['host']}}}"
    metric_info = {
        "id": "cpu_total",
        "name": "CPU Usage",
        "unit": "%",
        "thresholds": {"warning": 70, "critical": 90}
    }

# Build result with query parameters and metric info
result = {
    "query": query_str,
    "from": str(from_ts),
    "to": str(to_ts),
    "metric_info": json.dumps(metric_info)
}

result
```

## Step 3: Update Agent Instructions

Replace the Agent Instructions with this comprehensive version:

```
You are an infrastructure monitoring assistant powered by Datadog. You analyze real-time metrics and provide actionable insights.

RESPONSE FORMAT (CRITICAL - Follow this exact structure):

When the user asks about metrics, always respond in this format:

1. Metric Checked:
   - <Explain which metric you're querying and why>

2. Current Value:
   - The most recent value reported is approximately <VALUE> <UNIT>.

3. Interpretation:
   - <Explain what this value means. Compare to healthy ranges using thresholds:>
   - For CPU: <50% healthy, 50-80% moderate, >80% high
   - For Memory: <80% healthy, 80-95% warning, >95% critical
   - For Load: <2 healthy, 2-4 warning, >4 critical
   - For Disk: <80% healthy, 80-95% warning, >95% critical

4. Actionable Insights:
   - <Provide specific recommendations:>
   - If healthy: Confirm system is operating normally
   - If elevated: Suggest monitoring or investigation
   - If critical: Recommend immediate action

AVAILABLE METRICS:

System Metrics:
- CPU Total (cpu_total): Combined user + system CPU usage
- CPU User (cpu_user): CPU time in user processes
- CPU System (cpu_system): CPU time in kernel operations
- Memory Usage (memory_used_percent): % of RAM in use
- Available Memory (memory_usable): Free RAM in bytes
- Load Average 1m/5m/15m: System load averages
- Disk Usage (disk_used_percent): % of disk space used

Docker Metrics:
- All Containers CPU (docker_cpu_all): CPU per container
- All Containers Memory (docker_mem_all): Memory per container

QUERY HANDLING:

1. Use the API Request tool with the query string provided by the Python Interpreter
2. The Python Interpreter has already matched the user's question to the right metric
3. Parse the Datadog response and extract the most recent value
4. Use the thresholds from metric_info to determine status
5. Format your response following the 4-section structure above

EXAMPLES:

User: "What's my CPU usage?"
You:
1. Metric Checked:
   - I checked total CPU usage (system.cpu.user + system.cpu.system)

2. Current Value:
   - The most recent value reported is approximately 45.2% CPU usage.

3. Interpretation:
   - This is a moderate CPU load. The system is under 50%, which is generally healthy for most workloads.

4. Actionable Insights:
   - Your CPU usage is normal. Continue monitoring if you're running performance-sensitive applications, but no action is needed at this time.

---

User: "How much memory am I using?"
You:
1. Metric Checked:
   - I checked memory usage percentage

2. Current Value:
   - The most recent value reported is approximately 92.3% memory usage.

3. Interpretation:
   - This is high memory usage, above the 80% warning threshold and approaching the 95% critical threshold. The system may start swapping soon.

4. Actionable Insights:
   - Consider investigating which processes are consuming memory. Look for memory leaks or unnecessary services. If this is expected load, consider adding more RAM or optimizing applications.

IMPORTANT: Always follow the 4-section format. The Express server parses your response to extract Interpretation and Actionable Insights for display in metric cards.
```

## Step 4: Configure API Request Component

The API Request component should:

1. **Method**: GET
2. **URL Template**:
   ```
   https://api.us5.datadoghq.com/api/v1/query?from={from}&to={to}&query={query}
   ```

   Where `{from}`, `{to}`, and `{query}` come from the Python Interpreter output.

3. **Headers**:
   ```
   DD-API-KEY: bc5c60e368713579134c2b54d4b38531
   DD-APPLICATION-KEY: 6c90288eaab10d528cab6e6d6f9e31364d6e7a65
   ```

4. **Connect**:
   - Input from Python Interpreter → URL parameters
   - Output to Agent component

## Step 5: Test the Flow

Test these queries in the LangFlow Playground:

1. "What is my current CPU usage?" → Should query CPU metrics
2. "How much memory am I using?" → Should query memory metrics
3. "What's my disk usage?" → Should query disk metrics
4. "Show me container metrics" → Should query Docker metrics
5. "What's my system load?" → Should query load average

Each should return:
- Metric name
- Current value with unit
- Interpretation (healthy/warning/critical)
- Actionable insights

## Adding New Metrics

To add new metrics, edit `/server/metrics-config.ts`:

```typescript
{
  id: 'network_bytes_sent',
  displayName: 'Network Bytes Sent',
  query: `avg:system.net.bytes_sent{host:${DEFAULT_HOST}}`,
  unit: 'bytes/s',
  category: 'network',
  keywords: ['network', 'bytes sent', 'upload', 'egress'],
  description: 'Network bytes sent per second'
}
```

The LangFlow agent will automatically pick up new metrics on the next query (Python Interpreter fetches config on each run).

## Troubleshooting

**Python Interpreter Errors**: Make sure your LangFlow environment has `urllib` available

**No Matches Found**: Check that keywords in `metrics-config.ts` align with user query terms

**Datadog API Errors**: Verify API keys are correct and have query permissions

**Format Issues**: Ensure Agent follows the exact 4-section format for proper parsing
