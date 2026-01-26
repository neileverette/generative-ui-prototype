/**
 * Utterance Router
 *
 * Maps user utterances/queries to widget configurations using the widget-routing.json schema.
 * This is the core routing engine that determines which widgets to display based on what the user says.
 */

import routingConfig from '../config/widget-routing.json';

export interface RouteMatch {
  routeId: string;
  displayName: string;
  view: 'landing' | 'home';
  action: string | null;
  widgets: string[];
  staticWidgets?: string[];
  confidence: number; // 0-100, how confident we are in this match
  matchType: 'exact' | 'keyword' | 'pattern' | 'semantic';
}

/**
 * Route an utterance to the appropriate widget configuration
 * @param utterance - The user's input (chat message, voice command, etc.)
 * @returns RouteMatch with the widgets to display, or null if no match
 */
export function routeUtterance(utterance: string): RouteMatch | null {
  const normalizedUtterance = utterance.toLowerCase().trim();

  console.log('[routeUtterance] Processing utterance:', utterance, '→', normalizedUtterance);

  // Special case: empty utterance, "overview", or direct home keywords return the landing page
  const homeKeywords = ['overview', 'home', 'back', 'clear', 'reset', 'main'];
  if (!normalizedUtterance || homeKeywords.includes(normalizedUtterance)) {
    console.log('[routeUtterance] Home keyword detected - returning landing page');
    return getOverviewRoute();
  }

  let bestMatch: RouteMatch | null = null;
  let highestConfidence = 0;

  // Check each route in the config
  for (const [routeId, route] of Object.entries(routingConfig.routes)) {
    const confidence = calculateMatchConfidence(normalizedUtterance, route);

    if (confidence > 0) {
      console.log(`[routeUtterance] Route "${routeId}" confidence:`, confidence);
    }

    if (confidence > highestConfidence) {
      highestConfidence = confidence;
      bestMatch = {
        routeId,
        displayName: route.displayName,
        view: route.view as 'landing' | 'home',
        action: route.action,
        widgets: route.widgets || [],
        staticWidgets: 'staticWidgets' in route ? route.staticWidgets : undefined,
        confidence,
        matchType: getMatchType(normalizedUtterance, route),
      };
    }
  }

  console.log('[routeUtterance] Best match:', bestMatch?.routeId, 'with confidence:', highestConfidence, 'view:', bestMatch?.view);

  // Only return a match if confidence is above threshold (40%)
  return (highestConfidence >= 40) ? bestMatch : null;
}

/**
 * Get the overview/landing page route
 */
function getOverviewRoute(): RouteMatch {
  const overviewRoute = routingConfig.routes.overview;
  return {
    routeId: 'overview',
    displayName: overviewRoute.displayName,
    view: 'landing',
    action: null,
    widgets: [],
    staticWidgets: overviewRoute.staticWidgets,
    confidence: 100,
    matchType: 'exact',
  };
}

/**
 * Calculate how well an utterance matches a route
 * Returns a confidence score from 0-100
 */
function calculateMatchConfidence(utterance: string, route: any): number {
  let confidence = 0;

  // Check for exact keyword matches
  const keywords = route.keywords || [];
  const matchedKeywords = keywords.filter((keyword: string) =>
    utterance.includes(keyword.toLowerCase())
  );
  if (matchedKeywords.length > 0) {
    confidence += 30 + (matchedKeywords.length * 10);
  }

  // Check for pattern matches
  const patterns = route.patterns || [];
  const matchedPatterns = patterns.filter((pattern: string) =>
    utterance.includes(pattern.toLowerCase())
  );
  if (matchedPatterns.length > 0) {
    confidence += 40 + (matchedPatterns.length * 15);
  }

  // Check for question pattern matches (more specific)
  const questionPatterns = route.questionPatterns || [];
  const matchedQuestions = questionPatterns.filter((q: string) =>
    utterance.includes(q.toLowerCase())
  );
  if (matchedQuestions.length > 0) {
    confidence += 50 + (matchedQuestions.length * 20);
  }

  // Cap at 100
  return Math.min(confidence, 100);
}

/**
 * Determine the type of match that was found
 */
function getMatchType(utterance: string, route: any): 'exact' | 'keyword' | 'pattern' | 'semantic' {
  const questionPatterns = route.questionPatterns || [];
  if (questionPatterns.some((q: string) => utterance.includes(q.toLowerCase()))) {
    return 'pattern';
  }

  const patterns = route.patterns || [];
  if (patterns.some((p: string) => utterance.includes(p.toLowerCase()))) {
    return 'pattern';
  }

  const keywords = route.keywords || [];
  if (keywords.some((k: string) => utterance.includes(k.toLowerCase()))) {
    return 'keyword';
  }

  return 'semantic';
}

/**
 * Get all available routes (for debugging/testing)
 */
export function getAllRoutes() {
  return Object.entries(routingConfig.routes).map(([id, route]) => ({
    id,
    displayName: route.displayName,
    keywords: route.keywords,
    patterns: route.patterns,
  }));
}
