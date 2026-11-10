import { useCallback, useEffect, useState } from 'react';
import { apiRequest, getCachedApiResponse } from '../utils/api.js';

// Read fresh cached content during render instead of flashing a loading screen
// on every visit. A key change never displays the previous product/store.
export function useCatalogResource(endpoint) {
  const cached = getCachedApiResponse(endpoint);
  const [resource, setResource] = useState(() => ({ key: endpoint, data: cached, loading: !cached }));
  const current = resource.key === endpoint ? resource : { data: cached, loading: !cached };

  useEffect(() => {
    let active = true;
    const data = getCachedApiResponse(endpoint);
    setResource({ key: endpoint, data, loading: !data });
    apiRequest(endpoint)
      .then((result) => {
        if (active) setResource({ key: endpoint, data: result, loading: false });
      })
      .catch(() => {
        if (active) setResource({ key: endpoint, data, loading: false });
      });
    return () => { active = false; };
  }, [endpoint]);

  const setData = useCallback((update) => {
    setResource((previous) => previous.key === endpoint
      ? { ...previous, data: typeof update === 'function' ? update(previous.data) : update }
      : previous);
  }, [endpoint]);

  return { data: current.data, loading: current.loading, setData };
}
