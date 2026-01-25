/**
 * Widget Loader Hook
 *
 * Manages dynamic loading/unloading of widgets based on utterance routing.
 * Handles the lifecycle of widgets: load, display, clear.
 */

import { useCallback, useEffect, useRef } from 'react';
import { routeUtterance, RouteMatch } from '../services/utterance-router';

export interface WidgetLoaderOptions {
  onRouteMatch: (match: RouteMatch) => void;
  onRouteNotFound: (utterance: string) => void;
  onLoadStart: () => void;
  onLoadComplete: () => void;
  autoLoadOverview?: boolean; // Automatically load "overview" on mount
}

export function useWidgetLoader(options: WidgetLoaderOptions) {
  const {
    onRouteMatch,
    onRouteNotFound,
    onLoadStart,
    onLoadComplete,
    autoLoadOverview = true,
  } = options;

  const hasAutoLoaded = useRef(false);

  /**
   * Process an utterance and trigger widget loading
   */
  const processUtterance = useCallback((utterance: string) => {
    console.log('[WidgetLoader] Processing utterance:', utterance);

    onLoadStart();

    // Route the utterance
    const match = routeUtterance(utterance);

    if (match) {
      console.log('[WidgetLoader] Route matched:', {
        routeId: match.routeId,
        confidence: match.confidence,
        matchType: match.matchType,
        widgetCount: match.widgets.length + (match.staticWidgets?.length || 0),
      });

      onRouteMatch(match);
      onLoadComplete();
    } else {
      console.log('[WidgetLoader] No route found for utterance');
      onRouteNotFound(utterance);
      onLoadComplete();
    }
  }, [onRouteMatch, onRouteNotFound, onLoadStart, onLoadComplete]);

  /**
   * Load the overview route (landing page)
   */
  const loadOverview = useCallback(() => {
    console.log('[WidgetLoader] Loading overview route');
    processUtterance('overview');
  }, [processUtterance]);

  /**
   * Auto-load overview on mount (silent initial load)
   */
  useEffect(() => {
    if (autoLoadOverview && !hasAutoLoaded.current) {
      console.log('[WidgetLoader] Auto-loading overview on initial mount');
      hasAutoLoaded.current = true;

      // Small delay to ensure components are ready
      setTimeout(() => {
        loadOverview();
      }, 100);
    }
  }, [autoLoadOverview, loadOverview]);

  return {
    processUtterance,
    loadOverview,
  };
}
