import { getStore } from '@netlify/blobs';
import type { Context } from '@netlify/functions';

const STORE_NAME = 'hope-dealers-cloud-db';
const MASTER_KEY = 'master-state-v1';

interface SyncEntity {
  id: string;
  updatedAt?: string;
  startTime?: string;
  timestamp?: string;
  name?: string;
  email?: string;
  [key: string]: unknown;
}

interface CloudMasterRecord {
  users: SyncEntity[];
  walks: SyncEntity[];
  pins: SyncEntity[];
  deletedWalkIds: string[];
  deletedPinIds: string[];
  deletedUserIds: string[];
  teamAccessCode?: string;
  lbsPerTrashBag?: number;
  updatedAt: string;
}

const NO_CACHE_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
};

function mergeById(
  existingList: SyncEntity[],
  incomingList: SyncEntity[],
  deletedIdsSet: Set<string>
): SyncEntity[] {
  const map = new Map<string, SyncEntity>();

  for (const item of existingList || []) {
    if (!item?.id || deletedIdsSet.has(item.id)) continue;
    map.set(item.id, item);
  }

  for (const item of incomingList || []) {
    if (!item?.id || deletedIdsSet.has(item.id)) continue;
    const prev = map.get(item.id);
    if (!prev) {
      map.set(item.id, item);
    } else {
      const prevTime = prev.updatedAt || '';
      const nextTime = item.updatedAt || '';
      if (!prevTime || nextTime >= prevTime) {
        map.set(item.id, item);
      }
    }
  }

  return Array.from(map.values());
}

function mergeUsers(
  existingUsers: SyncEntity[],
  incomingUsers: SyncEntity[],
  deletedUserIdsSet: Set<string>
): SyncEntity[] {
  const byName = new Map<string, SyncEntity>();

  for (const u of [...(existingUsers || []), ...(incomingUsers || [])]) {
    if (!u || !u.name) continue;
    if (u.id && deletedUserIdsSet.has(u.id)) continue;
    const key = String(u.name).trim().toLowerCase();
    if (!key) continue;
    const prev = byName.get(key);
    if (!prev || u.role === 'superuser') {
      byName.set(key, u);
    }
  }

  return Array.from(byName.values());
}

export default async (req: Request, _context: Context) => {
  try {
    const store = getStore({ name: STORE_NAME, consistency: 'strong' });

    if (req.method === 'GET') {
      const existing = (await store.get(MASTER_KEY, {
        type: 'json',
        consistency: 'strong',
      })) as CloudMasterRecord | null;

      return new Response(
        JSON.stringify({
          ok: true,
          record: existing || null,
        }),
        { status: 200, headers: NO_CACHE_HEADERS }
      );
    }

    if (req.method === 'POST') {
      const body = (await req.json()) as {
        mode?: 'merge' | 'replace';
        users?: SyncEntity[];
        walks?: SyncEntity[];
        pins?: SyncEntity[];
        deletedWalkIds?: string[];
        deletedPinIds?: string[];
        deletedUserIds?: string[];
        teamAccessCode?: string;
        lbsPerTrashBag?: number;
      };

      const nowIso = new Date().toISOString();

      if (body.mode === 'replace') {
        const replaced: CloudMasterRecord = {
          users: body.users || [],
          walks: body.walks || [],
          pins: body.pins || [],
          deletedWalkIds: body.deletedWalkIds || [],
          deletedPinIds: body.deletedPinIds || [],
          deletedUserIds: body.deletedUserIds || [],
          teamAccessCode: body.teamAccessCode || 'HOPE2026',
          lbsPerTrashBag: body.lbsPerTrashBag || 15,
          updatedAt: nowIso,
        };
        await store.setJSON(MASTER_KEY, replaced);
        return new Response(
          JSON.stringify({ ok: true, record: replaced }),
          { status: 200, headers: NO_CACHE_HEADERS }
        );
      }

      const existing = ((await store.get(MASTER_KEY, {
        type: 'json',
        consistency: 'strong',
      })) as CloudMasterRecord | null) || {
        users: [],
        walks: [],
        pins: [],
        deletedWalkIds: [],
        deletedPinIds: [],
        deletedUserIds: [],
        updatedAt: nowIso,
      };

      const deletedWalksSet = new Set<string>([
        ...(existing.deletedWalkIds || []),
        ...(body.deletedWalkIds || []),
      ]);
      const deletedPinsSet = new Set<string>([
        ...(existing.deletedPinIds || []),
        ...(body.deletedPinIds || []),
      ]);
      const deletedUsersSet = new Set<string>([
        ...(existing.deletedUserIds || []),
        ...(body.deletedUserIds || []),
      ]);

      const mergedWalks = mergeById(
        existing.walks || [],
        body.walks || [],
        deletedWalksSet
      ).sort((a, b) =>
        String(b.startTime || '').localeCompare(String(a.startTime || ''))
      );

      const mergedPins = mergeById(
        existing.pins || [],
        body.pins || [],
        deletedPinsSet
      ).sort((a, b) =>
        String(b.timestamp || '').localeCompare(String(a.timestamp || ''))
      );

      const mergedUsers = mergeUsers(
        existing.users || [],
        body.users || [],
        deletedUsersSet
      );

      const mergedRecord: CloudMasterRecord = {
        users: mergedUsers,
        walks: mergedWalks,
        pins: mergedPins,
        deletedWalkIds: Array.from(deletedWalksSet),
        deletedPinIds: Array.from(deletedPinsSet),
        deletedUserIds: Array.from(deletedUsersSet),
        teamAccessCode:
          body.teamAccessCode || existing.teamAccessCode || 'HOPE2026',
        lbsPerTrashBag:
          body.lbsPerTrashBag ?? existing.lbsPerTrashBag ?? 15,
        updatedAt: nowIso,
      };

      await store.setJSON(MASTER_KEY, mergedRecord);

      return new Response(
        JSON.stringify({
          ok: true,
          record: mergedRecord,
        }),
        { status: 200, headers: NO_CACHE_HEADERS }
      );
    }

    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405,
      headers: NO_CACHE_HEADERS,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : 'Netlify Cloud Store error',
      }),
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
};
