# Widget Inventory








| Widget | Data source |
| --- | --- |
| LandingPage | `mcpClient.getRunningContainers`, `mcpClient.getOverviewFast`, `mcpClient.getCostsOverview` |
| TodaysUpdateCard | Parent props: `summary`, `timestamp`, `isLoading` |
| NavigationCard | Parent props: `title`, `description`, `status`, `onClick` |
| ClaudeUsageCard | `mcpClient.getClaudeCodeUsage`, `mcpClient.getApiTokens`, `mcpClient.getApiCredits`, `mcpClient.updateApiCredits`, localStorage plan |
| AnthropicUsageCard | `mcpClient.getApiTokens` (Admin API) |
| MetricCard | A2UI `component.props` |
| CardGroup | A2UI `component.props` |
| DataTable | A2UI `component.props` |
| AlertList | A2UI `component.props` |
| StatusIndicator | A2UI `component.props` |
| ProgressBar | A2UI `component.props` |
| ECRSummaryCard | A2UI `component.props` |
| DashboardCanvas | `state.components` (A2UI) + parent props (commands, voice, navigation) |
| VoiceOverlay | Parent props: `voiceState`, `transcript` from `useVoiceDictation` |
| VoiceButton | Parent props: `voiceState`, `onStart`, `onStop` |
| BlurBackground | Local static `circles` config |
| ErrorBoundary | Parent props: `children`, `fallback` |
