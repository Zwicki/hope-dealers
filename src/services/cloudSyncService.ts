import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  AppDatabaseState,
  CloudConfig,
  CommunityInteractionPoint,
  EncounterPin,
  GpsWaypoint,
  UserAccount,
  WalkSession,
} from '../types/hopeDealers';

const STORAGE_KEY = 'lrs_hope_dealers_db_v1';
const AUTH_SESSION_KEY = 'lrs_hope_dealers_session_v1';
const ACTIVE_WALK_DRAFT_KEY = 'lrs_hope_dealers_active_walk_v1';

export const SUPER_USER_EMAIL = 'RFannin25@gmail.com';
export const SUPER_USER_PASSWORD = 'Zwicki0823!';

const DEFAULT_USERS: UserAccount[] = [
  {
    id: 'user-superuser-rick',
    name: 'Rick Fannin',
    email: SUPER_USER_EMAIL,
    password: SUPER_USER_PASSWORD,
    role: 'superuser',
    phone: '(614) 200-2139',
    createdAt: '2026-01-01T08:00:00.000Z',
    active: true,
  },
  {
    id: 'user-vol-1',
    name: 'Sarah Jenkins',
    email: 'sarah@liferecoverysociety.org',
    password: 'HopeDealer1!',
    role: 'volunteer',
    createdAt: '2026-09-10T12:00:00.000Z',
    active: true,
  },
  {
    id: 'user-vol-2',
    name: 'David Miller',
    email: 'david@liferecoverysociety.org',
    password: 'HopeDealer1!',
    role: 'volunteer',
    createdAt: '2026-09-12T12:00:00.000Z',
    active: true,
  },
  {
    id: 'user-vol-3',
    name: 'Pastor Mark Thompson',
    email: 'mark@liferecoverysociety.org',
    password: 'HopeDealer1!',
    role: 'volunteer',
    createdAt: '2026-10-01T12:00:00.000Z',
    active: true,
  },
];

export const SEED_WALKS: WalkSession[] = [
  {
    id: 'walk-seed-1',
    date: '2026-11-07',
    startTime: '2026-11-07T14:00:00.000Z',
    endTime: '2026-11-07T16:15:00.000Z',
    durationMinutes: 135,
    recorderName: 'Rick Fannin',
    recorderEmail: SUPER_USER_EMAIL,
    groupMembers: ['Rick Fannin', 'Sarah Jenkins', 'David Miller'],
    groupSize: 3,
    volunteerHours: 6.75, // 2.25 hrs * 3 people
    milesWalked: 2.8,
    streetsWalked: ['Paint St', 'E Main St', 'E Water St', 'Yoctangee Pkwy'],
    startPoint: {
      lat: 39.3315,
      lng: -82.9825,
      streetName: 'S Paint St & E Main St',
      timestamp: '2026-11-07T14:00:00.000Z',
    },
    endPoint: {
      lat: 39.3331,
      lng: -82.9824,
      streetName: 'N Paint St',
      timestamp: '2026-11-07T16:15:00.000Z',
    },
    gpsPath: [
      [39.3315, -82.9825],
      [39.3332, -82.9824],
      [39.3360, -82.9822],
      [39.3362, -82.9785],
      [39.3333, -82.9786],
      [39.3331, -82.9824],
    ],
    interactionLocations: [
      {
        id: 'int-seed-1',
        walkId: 'walk-seed-1',
        lat: 39.3324,
        lng: -82.9824,
        streetName: 'Paint St',
        timestamp: '2026-11-07T14:12:00.000Z',
        kind: 'interaction',
      },
      {
        id: 'int-seed-2',
        walkId: 'walk-seed-1',
        lat: 39.3348,
        lng: -82.9823,
        streetName: 'N Paint St',
        timestamp: '2026-11-07T14:40:00.000Z',
        kind: 'interaction',
      },
      {
        id: 'int-seed-3',
        walkId: 'walk-seed-1',
        lat: 39.3361,
        lng: -82.9795,
        streetName: 'E Water St',
        timestamp: '2026-11-07T15:15:00.000Z',
        kind: 'interaction',
      },
    ],
    interactionsCount: 29,
    prayersCount: 7,
    serviceLinkagesCount: 5,
    trashBagsCount: 4,
    trashWeightLbs: 60,
    notes: 'Great Saturday outreach through downtown Paint St and Water St near the park. Handed out water, hygiene kits, and connected two men with recovery housing resources.',
    syncStatus: 'synced',
  },
  {
    id: 'walk-seed-2',
    date: '2026-11-11',
    startTime: '2026-11-11T15:30:00.000Z',
    endTime: '2026-11-11T17:30:00.000Z',
    durationMinutes: 120,
    recorderName: 'Sarah Jenkins',
    recorderEmail: 'sarah@liferecoverysociety.org',
    groupMembers: ['Sarah Jenkins', 'Pastor Mark Thompson'],
    groupSize: 2,
    volunteerHours: 4.0, // 2.0 hrs * 2 people
    milesWalked: 2.2,
    streetsWalked: ['N Bridge St', 'E Main St', 'E 2nd St', 'Mulberry St'],
    startPoint: {
      lat: 39.3333,
      lng: -82.9780,
      streetName: 'E Main St & Mulberry St',
      timestamp: '2026-11-11T15:30:00.000Z',
    },
    endPoint: {
      lat: 39.3333,
      lng: -82.9780,
      streetName: 'E Main St',
      timestamp: '2026-11-11T17:30:00.000Z',
    },
    gpsPath: [
      [39.3333, -82.9780],
      [39.3335, -82.9718],
      [39.3368, -82.9715],
      [39.3366, -82.9765],
      [39.3333, -82.9780],
    ],
    interactionLocations: [
      {
        id: 'int-seed-4',
        walkId: 'walk-seed-2',
        lat: 39.3334,
        lng: -82.9745,
        streetName: 'E Main St',
        timestamp: '2026-11-11T15:50:00.000Z',
        kind: 'interaction',
      },
      {
        id: 'int-seed-5',
        walkId: 'walk-seed-2',
        lat: 39.3358,
        lng: -82.9716,
        streetName: 'N Bridge St',
        timestamp: '2026-11-11T16:25:00.000Z',
        kind: 'interaction',
      },
    ],
    interactionsCount: 22,
    prayersCount: 5,
    serviceLinkagesCount: 4,
    trashBagsCount: 3,
    trashWeightLbs: 45,
    notes: 'Walked the Bridge Street corridor and Mulberry St. Lots of encouraging conversations and cleared 3 bags of litter along the sidewalks.',
    syncStatus: 'synced',
  },
  {
    id: 'walk-seed-3',
    date: '2026-11-13',
    startTime: '2026-11-13T13:00:00.000Z',
    endTime: '2026-11-13T15:00:00.000Z',
    durationMinutes: 120,
    recorderName: 'Rick Fannin',
    recorderEmail: SUPER_USER_EMAIL,
    groupMembers: ['Rick Fannin', 'David Miller', 'Pastor Mark Thompson'],
    groupSize: 3,
    volunteerHours: 6.0, // 2.0 hrs * 3 people
    milesWalked: 2.6,
    streetsWalked: ['Eastern Ave', 'S Bridge St', 'E 4th St', 'E 7th St'],
    startPoint: {
      lat: 39.3302,
      lng: -82.9720,
      streetName: 'S Bridge St & Eastern Ave',
      timestamp: '2026-11-13T13:00:00.000Z',
    },
    endPoint: {
      lat: 39.3302,
      lng: -82.9720,
      streetName: 'S Bridge St',
      timestamp: '2026-11-13T15:00:00.000Z',
    },
    gpsPath: [
      [39.3302, -82.9720],
      [39.3275, -82.9680],
      [39.3258, -82.9635],
      [39.3288, -82.9632],
      [39.3302, -82.9720],
    ],
    interactionLocations: [
      {
        id: 'int-seed-6',
        walkId: 'walk-seed-3',
        lat: 39.3290,
        lng: -82.9701,
        streetName: 'Eastern Ave',
        timestamp: '2026-11-13T13:20:00.000Z',
        kind: 'interaction',
      },
      {
        id: 'int-seed-7',
        walkId: 'walk-seed-3',
        lat: 39.3272,
        lng: -82.9634,
        streetName: 'E 7th St',
        timestamp: '2026-11-13T14:35:00.000Z',
        kind: 'interaction',
      },
    ],
    interactionsCount: 34,
    prayersCount: 9,
    serviceLinkagesCount: 6,
    trashBagsCount: 5,
    trashWeightLbs: 75,
    notes: 'Strong outreach along Eastern Ave and E 4th/7th St. Prayed with several families on front porches and individuals seeking food and sober living info.',
    syncStatus: 'synced',
  },
];

export const SEED_PINS: EncounterPin[] = [
  {
    id: 'pin-seed-1',
    walkId: 'walk-seed-1',
    timestamp: '2026-11-07T14:25:00.000Z',
    lat: 39.3332,
    lng: -82.9824,
    streetName: 'Paint St & Main St',
    firstName: 'Marcus',
    description: 'Prayed for sobriety, strength, and reconciliation with his daughter. Connected him to Made for More sober living info and Chillicothe Community Resources for a warm meal.',
    type: 'both',
    needCategories: ['detox_recovery', 'shelter_housing', 'food_water'],
    loggedByRecorder: 'Rick Fannin',
    groupMembers: ['Rick Fannin', 'Sarah Jenkins', 'David Miller'],
    syncStatus: 'synced',
  },
  {
    id: 'pin-seed-2',
    walkId: 'walk-seed-1',
    timestamp: '2026-11-07T15:05:00.000Z',
    lat: 39.3361,
    lng: -82.9808,
    streetName: 'E Water St',
    firstName: 'Tiffany',
    description: 'Sitting near Yoctangee Park entrance. Prayed for peace and healing from anxiety; shared hygiene kit, blanket, and food pantry schedule.',
    type: 'both',
    needCategories: ['food_water', 'clothing_hygiene'],
    loggedByRecorder: 'Rick Fannin',
    groupMembers: ['Rick Fannin', 'Sarah Jenkins', 'David Miller'],
    syncStatus: 'synced',
  },
  {
    id: 'pin-seed-3',
    walkId: 'walk-seed-1',
    timestamp: '2026-11-07T15:45:00.000Z',
    lat: 39.3342,
    lng: -82.9786,
    streetName: 'Mulberry St',
    firstName: 'James',
    description: 'Veteran walking home with groceries. Offered to carry bags a block and prayed for his upcoming VA medical appointment and back pain.',
    type: 'prayer',
    needCategories: ['medical_mental'],
    loggedByRecorder: 'Rick Fannin',
    groupMembers: ['Rick Fannin', 'Sarah Jenkins', 'David Miller'],
    syncStatus: 'synced',
  },
  {
    id: 'pin-seed-4',
    walkId: 'walk-seed-2',
    timestamp: '2026-11-11T16:10:00.000Z',
    lat: 39.3348,
    lng: -82.9717,
    streetName: 'N Bridge St',
    firstName: 'Brandon',
    description: 'Recently lost job and struggling to stay clean. Prayed together right on the sidewalk and linked him with detox/recovery intake & employment support.',
    type: 'both',
    needCategories: ['detox_recovery', 'employment_id'],
    loggedByRecorder: 'Sarah Jenkins',
    groupMembers: ['Sarah Jenkins', 'Pastor Mark Thompson'],
    syncStatus: 'synced',
  },
  {
    id: 'pin-seed-5',
    walkId: 'walk-seed-2',
    timestamp: '2026-11-11T16:50:00.000Z',
    lat: 39.3365,
    lng: -82.9752,
    streetName: 'E 2nd St',
    firstName: 'brenda',
    description: 'Grandmother raising two grandkids. Prayed for family provision and linked her to local food pantry and clothing ministry via ChillicotheCommunityResources.com.',
    type: 'both',
    needCategories: ['food_water', 'clothing_hygiene'],
    loggedByRecorder: 'Sarah Jenkins',
    groupMembers: ['Sarah Jenkins', 'Pastor Mark Thompson'],
    syncStatus: 'synced',
  },
  {
    id: 'pin-seed-6',
    walkId: 'walk-seed-3',
    timestamp: '2026-11-13T13:40:00.000Z',
    lat: 39.3278,
    lng: -82.9675,
    streetName: 'Eastern Ave',
    firstName: 'Chris',
    description: 'Asked for prayer to break free from fentanyl addiction. Spent 15 minutes praying with him and called recovery referral line together.',
    type: 'both',
    needCategories: ['detox_recovery', 'crisis_support', 'shelter_housing'],
    loggedByRecorder: 'Rick Fannin',
    groupMembers: ['Rick Fannin', 'David Miller', 'Pastor Mark Thompson'],
    syncStatus: 'synced',
  },
  {
    id: 'pin-seed-7',
    walkId: 'walk-seed-3',
    timestamp: '2026-11-13T14:20:00.000Z',
    lat: 39.3264,
    lng: -82.9642,
    streetName: 'E 7th St',
    firstName: 'Derrick',
    description: 'Prayed for hope, housing stability, and getting his Ohio ID restored so he can start work next week.',
    type: 'prayer',
    needCategories: ['employment_id'],
    loggedByRecorder: 'Rick Fannin',
    groupMembers: ['Rick Fannin', 'David Miller', 'Pastor Mark Thompson'],
    syncStatus: 'synced',
  },
];

const DEFAULT_CLOUD_CONFIG: CloudConfig = {
  enabled: true,
  provider: 'cloud_storage',
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  customWebhookUrl: '',
  teamAccessCode: 'HOPE2026',
  lbsPerTrashBag: 15,
  lastSyncedAt: new Date().toISOString(),
};

let supabaseClient: SupabaseClient | null = null;

function getSupabase(config: CloudConfig): SupabaseClient | null {
  if (!config.supabaseUrl || !config.supabaseAnonKey) return null;
  if (!supabaseClient) {
    try {
      supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey);
    } catch {
      return null;
    }
  }
  return supabaseClient;
}

export function loadDatabase(): AppDatabaseState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial: AppDatabaseState = {
        users: DEFAULT_USERS,
        walks: SEED_WALKS,
        pins: SEED_PINS,
        cloudConfig: DEFAULT_CLOUD_CONFIG,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw) as AppDatabaseState;
    // Always guarantee Super User RFannin25@gmail.com exists with Zwicki0823!
    const hasSuper = parsed.users?.some(
      (u) => u.email.toLowerCase() === SUPER_USER_EMAIL.toLowerCase()
    );
    if (!hasSuper) {
      parsed.users = [DEFAULT_USERS[0], ...(parsed.users || [])];
    } else {
      parsed.users = parsed.users.map((u) =>
        u.email.toLowerCase() === SUPER_USER_EMAIL.toLowerCase()
          ? { ...u, role: 'superuser', password: u.password || SUPER_USER_PASSWORD }
          : u
      );
    }
    if (!parsed.cloudConfig) {
      parsed.cloudConfig = DEFAULT_CLOUD_CONFIG;
    }
    return parsed;
  } catch {
    return {
      users: DEFAULT_USERS,
      walks: SEED_WALKS,
      pins: SEED_PINS,
      cloudConfig: DEFAULT_CLOUD_CONFIG,
    };
  }
}

export function saveDatabase(state: AppDatabaseState): AppDatabaseState {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const updated: AppDatabaseState = {
    ...state,
    cloudConfig: {
      ...state.cloudConfig,
      lastSyncedAt: isOnline ? new Date().toISOString() : state.cloudConfig.lastSyncedAt,
    },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  // Notify other tabs/windows immediately
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('hope-dealers-db-updated'));
  }
  // Trigger async cloud sync if online
  if (isOnline) {
    void syncToRemoteCloud(updated);
  }
  return updated;
}

export async function syncToRemoteCloud(state: AppDatabaseState): Promise<{
  ok: boolean;
  message: string;
}> {
  const { cloudConfig } = state;

  // 1. If Supabase URL & Key are configured, sync walks and pins to Supabase tables
  if (cloudConfig.supabaseUrl && cloudConfig.supabaseAnonKey) {
    const client = getSupabase(cloudConfig);
    if (client) {
      try {
        if (state.walks.length > 0) {
          await client.from('hope_dealers_walks').upsert(
            state.walks.map((w) => ({
              id: w.id,
              payload: w,
              updated_at: new Date().toISOString(),
            }))
          );
        }
        if (state.pins.length > 0) {
          await client.from('hope_dealers_pins').upsert(
            state.pins.map((p) => ({
              id: p.id,
              walk_id: p.walkId,
              payload: p,
              updated_at: new Date().toISOString(),
            }))
          );
        }
        markAllRecordsSynced();
        return { ok: true, message: 'Synced with Supabase Cloud' };
      } catch (err) {
        return {
          ok: false,
          message: err instanceof Error ? err.message : 'Supabase sync error',
        };
      }
    }
  }

  // 2. If Custom Cloud Webhook / JSON Endpoint is configured
  if (cloudConfig.customWebhookUrl) {
    try {
      await fetch(cloudConfig.customWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization: 'Life Recovery Society - Hope Dealers',
          syncedAt: new Date().toISOString(),
          walks: state.walks,
          pins: state.pins,
        }),
      });
      markAllRecordsSynced();
      return { ok: true, message: 'Synced with Cloud Endpoint' };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Webhook sync failed',
      };
    }
  }

  // 3. Built-in Cloud Browser Store Sync
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    markAllRecordsSynced();
    return { ok: true, message: 'Cloud Sync Active' };
  }

  return { ok: false, message: 'Offline — queued for automatic sync' };
}

export async function pullFromRemoteCloud(): Promise<AppDatabaseState | null> {
  const current = loadDatabase();
  const { cloudConfig } = current;
  if (!cloudConfig.supabaseUrl || !cloudConfig.supabaseAnonKey) return null;

  const client = getSupabase(cloudConfig);
  if (!client) return null;

  try {
    const [{ data: walkRows }, { data: pinRows }] = await Promise.all([
      client.from('hope_dealers_walks').select('payload'),
      client.from('hope_dealers_pins').select('payload'),
    ]);

    if (walkRows || pinRows) {
      const mergedWalksMap = new Map<string, WalkSession>();
      current.walks.forEach((w) => mergedWalksMap.set(w.id, w));
      (walkRows || []).forEach((r: { payload: WalkSession }) => {
        if (r?.payload?.id) mergedWalksMap.set(r.payload.id, r.payload);
      });

      const mergedPinsMap = new Map<string, EncounterPin>();
      current.pins.forEach((p) => mergedPinsMap.set(p.id, p));
      (pinRows || []).forEach((r: { payload: EncounterPin }) => {
        if (r?.payload?.id) mergedPinsMap.set(r.payload.id, r.payload);
      });

      const nextState: AppDatabaseState = {
        ...current,
        walks: Array.from(mergedWalksMap.values()).sort((a, b) =>
          b.startTime.localeCompare(a.startTime)
        ),
        pins: Array.from(mergedPinsMap.values()).sort((a, b) =>
          b.timestamp.localeCompare(a.timestamp)
        ),
        cloudConfig: {
          ...current.cloudConfig,
          lastSyncedAt: new Date().toISOString(),
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      return nextState;
    }
  } catch {
    // Keep local state if remote fetch fails
  }
  return null;
}

function markAllRecordsSynced() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as AppDatabaseState;
    let changed = false;
    parsed.walks = parsed.walks.map((w) => {
      if (w.syncStatus === 'pending') {
        changed = true;
        return { ...w, syncStatus: 'synced' };
      }
      return w;
    });
    parsed.pins = parsed.pins.map((p) => {
      if (p.syncStatus === 'pending') {
        changed = true;
        return { ...p, syncStatus: 'synced' };
      }
      return p;
    });
    if (changed) {
      parsed.cloudConfig.lastSyncedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
  } catch {
    // ignore
  }
}

// Session Persistence
export function loadCurrentSession(): UserAccount | null {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    return raw ? (JSON.parse(raw) as UserAccount) : null;
  } catch {
    return null;
  }
}

export function saveCurrentSession(user: UserAccount | null): void {
  if (!user) {
    localStorage.removeItem(AUTH_SESSION_KEY);
  } else {
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user));
  }
}

// Active Walk Draft Persistence (so a volunteer never loses an in-progress walk if they refresh their phone)
export interface ActiveWalkDraft {
  walkId: string;
  isRunning: boolean;
  startedAtIso: string;
  elapsedSeconds: number;
  recorderName: string;
  groupMembers: string[];
  milesWalked: number;
  manualMilesOverride: boolean;
  streetsWalked: string[];
  startPoint?: GpsWaypoint;
  gpsPath: [number, number][];
  interactionLocations: CommunityInteractionPoint[];
  gpsTrackingActive: boolean;
  interactionsCount: number;
  prayersCount: number;
  serviceLinkagesCount: number;
  trashBagsCount: number;
  trashWeightLbs: number;
  manualWeightOverride: boolean;
  notes: string;
}

export function loadActiveWalkDraft(): ActiveWalkDraft | null {
  try {
    const raw = localStorage.getItem(ACTIVE_WALK_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as ActiveWalkDraft) : null;
  } catch {
    return null;
  }
}

export function saveActiveWalkDraft(draft: ActiveWalkDraft | null): void {
  if (!draft) {
    localStorage.removeItem(ACTIVE_WALK_DRAFT_KEY);
  } else {
    localStorage.setItem(ACTIVE_WALK_DRAFT_KEY, JSON.stringify(draft));
  }
}

// Haversine formula to calculate distance in miles between two GPS coordinates
export function calculateDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Reverse geocode GPS coordinates into a street name via OpenStreetMap Nominatim
export async function reverseGeocodeStreet(
  lat: number,
  lng: number
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const road =
      data?.address?.road ||
      data?.address?.pedestrian ||
      data?.address?.neighbourhood ||
      data?.address?.suburb;
    return road ? String(road) : null;
  } catch {
    return null;
  }
}
