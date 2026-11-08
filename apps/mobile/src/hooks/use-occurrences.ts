import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api';

/** Powers the Calendar tab: every reminder occurrence due in [from, to), used for an
 * agenda-style (grouped by day) view — see docs/API_DESIGN.md "Dashboard / My Day"
 * section, which documents this endpoint as shared by Calendar + Dashboard. */
export function useOccurrencesInRange(from: string, to: string) {
  return useQuery({
    queryKey: ['occurrences', from, to],
    queryFn: () => apiClient.listOccurrences({ from, to }),
  });
}
