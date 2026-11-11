import { generateId } from './db.js';

/**
 * Record an administrative security and operational audit log entry
 * @param {object} store - In-memory store
 * @param {object} entry - Log details { action, adminEmail, adminId, ip, details, metadata }
 */
export function recordAdminAuditLog(store, entry) {
  if (!store || !store.platformConfig) return;
  if (!Array.isArray(store.platformConfig.adminAuditLogs)) {
    store.platformConfig.adminAuditLogs = [];
  }

  const logItem = {
    id: generateId('aud'),
    timestamp: new Date().toISOString(),
    action: entry.action || 'admin_action',
    adminEmail: entry.adminEmail || 'admin@yaans.lk',
    adminId: entry.adminId || null,
    ip: entry.ip || '127.0.0.1',
    details: entry.details || '',
    metadata: entry.metadata || {}
  };

  store.platformConfig.adminAuditLogs.unshift(logItem);

  // Keep most recent 250 audit log events in memory and MongoDB
  if (store.platformConfig.adminAuditLogs.length > 250) {
    store.platformConfig.adminAuditLogs = store.platformConfig.adminAuditLogs.slice(0, 250);
  }

  return logItem;
}
