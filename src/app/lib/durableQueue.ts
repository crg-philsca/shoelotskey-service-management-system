/**
 * Shoelotskey Durable Pending Mutation Queue (Level 1 Protection)
 *
 * Persists pending mutations in localStorage under 'shoelotskey_pending_mutations'.
 * Guarantees that user mutations survive page refreshes, tab closures, network dropouts,
 * and backend crashes until explicit HTTP 200 database persistence is confirmed.
 */

export interface PendingMutation {
  operation_id: string;
  entity: 'inventory' | 'order' | 'expense' | 'payment' | 'historical';
  operation_type: 'CREATE' | 'UPDATE' | 'DELETE';
  endpoint: string;
  method: 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  payload: any;
  created_at: string;
  retry_count: number;
  status: 'LOCAL_PENDING' | 'SAVING' | 'LOCAL_PERSISTED' | 'FAILED';
  error?: string | null;
}

const STORAGE_KEY = 'shoelotskey_pending_mutations';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'opt-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
}

export function getPendingMutations(): PendingMutation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[DurableQueue] Failed to parse pending mutations:', err);
    return [];
  }
}

export function savePendingMutations(mutations: PendingMutation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mutations));
  } catch (err) {
    console.error('[DurableQueue] Failed to persist mutations to localStorage:', err);
  }
}

export function enqueueMutation(
  entity: PendingMutation['entity'],
  operation_type: PendingMutation['operation_type'],
  endpoint: string,
  method: PendingMutation['method'],
  payload: any,
  existing_op_id?: string
): PendingMutation {
  const mutations = getPendingMutations();
  const operation_id = existing_op_id || payload?.sync_uuid || generateUUID();

  // If payload doesn't have an operation_id or sync_uuid, attach it
  const enrichedPayload = {
    ...payload,
    operation_id,
    ...(payload?.sync_uuid ? {} : { sync_uuid: operation_id }),
  };

  const newMutation: PendingMutation = {
    operation_id,
    entity,
    operation_type,
    endpoint,
    method,
    payload: enrichedPayload,
    created_at: new Date().toISOString(),
    retry_count: 0,
    status: 'LOCAL_PENDING',
    error: null,
  };

  // Avoid duplicate enqueue of the same operation_id
  const filtered = mutations.filter((m) => m.operation_id !== operation_id);
  filtered.push(newMutation);
  savePendingMutations(filtered);

  return newMutation;
}

export function dequeueMutation(operation_id: string): void {
  const mutations = getPendingMutations();
  const filtered = mutations.filter((m) => m.operation_id !== operation_id);
  savePendingMutations(filtered);
}

export function updateMutationStatus(
  operation_id: string,
  status: PendingMutation['status'],
  error: string | null = null
): void {
  const mutations = getPendingMutations();
  const updated = mutations.map((m) => {
    if (m.operation_id === operation_id) {
      return {
        ...m,
        status,
        error,
        retry_count: status === 'FAILED' ? m.retry_count + 1 : m.retry_count,
      };
    }
    return m;
  });
  savePendingMutations(updated);
}

/**
 * Automatically replays pending mutations when connection or backend is restored.
 */
export async function replayPendingQueue(
  apiBase: string,
  token?: string
): Promise<{ successful: number; failed: number }> {
  const mutations = getPendingMutations();
  if (mutations.length === 0) return { successful: 0, failed: 0 };

  let successful = 0;
  let failed = 0;

  for (const mut of mutations) {
    if (mut.status === 'LOCAL_PERSISTED') {
      dequeueMutation(mut.operation_id);
      successful++;
      continue;
    }

    try {
      updateMutationStatus(mut.operation_id, 'SAVING');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Operation-ID': mut.operation_id,
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const url = mut.endpoint.startsWith('http')
        ? mut.endpoint
        : `${apiBase.replace(/\/$/, '')}/${mut.endpoint.replace(/^\//, '')}`;

      const res = await fetch(url, {
        method: mut.method,
        headers,
        body: mut.method !== 'DELETE' ? JSON.stringify(mut.payload) : undefined,
      });

      if (res.ok) {
        dequeueMutation(mut.operation_id);
        successful++;
      } else {
        const errText = await res.text();
        updateMutationStatus(mut.operation_id, 'FAILED', `HTTP ${res.status}: ${errText}`);
        failed++;
      }
    } catch (err: any) {
      updateMutationStatus(mut.operation_id, 'FAILED', err.message || 'Network error');
      failed++;
    }
  }

  return { successful, failed };
}
