import type { CalendarEvent } from '@/types';

/**
 * Search for events matching a query string
 * Uses fuzzy matching on title and description
 */
export function searchEvents(events: CalendarEvent[], query: string): CalendarEvent[] {
  const normalizedQuery = query.toLowerCase().trim();

  if (!normalizedQuery) {
    return [];
  }

  const queryWords = normalizedQuery.split(/\s+/);

  return events.filter(event => {
    const searchText = `${event.title} ${event.description || ''}`.toLowerCase();

    // Match if any query word is found in the event text
    return queryWords.some(word => searchText.includes(word));
  }).sort((a, b) => {
    // Sort by relevance: exact title matches first, then partial matches
    const aTitle = a.title.toLowerCase();
    const bTitle = b.title.toLowerCase();

    if (aTitle === normalizedQuery && bTitle !== normalizedQuery) return -1;
    if (bTitle === normalizedQuery && aTitle !== normalizedQuery) return 1;

    // Then by proximity to query
    const aScore = queryWords.filter(word => aTitle.includes(word)).length;
    const bScore = queryWords.filter(word => bTitle.includes(word)).length;

    return bScore - aScore;
  });
}

/**
 * Find the best matching event for a query
 */
export function findBestMatch(events: CalendarEvent[], query: string): CalendarEvent | null {
  const matches = searchEvents(events, query);
  return matches[0] || null;
}
