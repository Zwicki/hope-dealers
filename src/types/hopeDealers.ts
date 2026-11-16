export type UserRole = 'superuser' | 'volunteer';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  phone?: string;
  createdAt: string;
  active: boolean;
}

export type NeedCategoryId =
  | 'food_water'
  | 'shelter_housing'
  | 'detox_recovery'
  | 'clothing_hygiene'
  | 'medical_mental'
  | 'crisis_support'
  | 'employment_id';

export interface NeedCategoryOption {
  id: NeedCategoryId;
  label: string;
  shortLabel: string;
  emoji: string;
  colorClass: string;
}

export const NEED_CATEGORIES: NeedCategoryOption[] = [
  {
    id: 'food_water',
    label: 'Food / Water / Meal',
    shortLabel: 'Food & Water',
    emoji: '🍞',
    colorClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  {
    id: 'shelter_housing',
    label: 'Shelter / Sober Living',
    shortLabel: 'Shelter / Housing',
    emoji: '🏠',
    colorClass: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  },
  {
    id: 'detox_recovery',
    label: 'Detox / Addiction Recovery',
    shortLabel: 'Detox / Recovery',
    emoji: '🕊️',
    colorClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  {
    id: 'clothing_hygiene',
    label: 'Clothing / Blankets / Hygiene',
    shortLabel: 'Clothing & Hygiene',
    emoji: '👕',
    colorClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  },
  {
    id: 'medical_mental',
    label: 'Medical / Mental Health',
    shortLabel: 'Medical / Mental',
    emoji: '🩺',
    colorClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  },
  {
    id: 'crisis_support',
    label: 'Immediate Crisis Support',
    shortLabel: 'Crisis Support',
    emoji: '🆘',
    colorClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  },
  {
    id: 'employment_id',
    label: 'Jobs / ID / Transportation',
    shortLabel: 'Jobs / ID / Transit',
    emoji: '🪪',
    colorClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  },
];

export type EncounterType = 'prayer' | 'service' | 'both';

export interface EncounterPin {
  id: string;
  walkId: string;
  timestamp: string;
  lat: number;
  lng: number;
  streetName: string;
  firstName: string;
  peopleCount?: number; // Number of people prayed for / helped at this pin (default 1)
  description: string;
  type: EncounterType;
  needCategories: NeedCategoryId[];
  loggedByRecorder: string;
  groupMembers: string[];
  syncStatus: 'synced' | 'pending';
  updatedAt?: string;
}

export interface GpsWaypoint {
  lat: number;
  lng: number;
  streetName?: string;
  timestamp: string;
}

export interface CommunityInteractionPoint {
  id: string;
  walkId: string;
  lat: number;
  lng: number;
  streetName?: string;
  timestamp: string;
  kind: 'interaction' | 'prayer' | 'service';
  peopleCount?: number; // Number of people in this interaction / prayer (default 1)
}

export interface WalkSession {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // ISO
  endTime?: string; // ISO
  durationMinutes: number;
  recorderName: string;
  recorderEmail?: string;
  groupMembers: string[]; // All 2-3 members in the walking group (including recorder)
  groupSize: number;
  volunteerHours: number; // (durationMinutes / 60) * groupSize
  milesWalked: number;
  streetsWalked: string[];
  startPoint?: GpsWaypoint;
  endPoint?: GpsWaypoint;
  gpsPath: [number, number][];
  interactionLocations?: CommunityInteractionPoint[];
  interactionsCount: number;
  prayersCount: number;
  serviceLinkagesCount: number;
  trashBagsCount: number;
  trashWeightLbs: number;
  notes?: string;
  syncStatus: 'synced' | 'pending';
  updatedAt?: string;
}

export interface CloudConfig {
  enabled: boolean;
  provider: 'supabase' | 'custom_webhook' | 'cloud_storage';
  supabaseUrl: string;
  supabaseAnonKey: string;
  customWebhookUrl?: string;
  teamAccessCode: string;
  lbsPerTrashBag: number;
  lastSyncedAt?: string;
}

export interface AppDatabaseState {
  users: UserAccount[];
  walks: WalkSession[];
  pins: EncounterPin[];
  deletedWalkIds?: string[];
  deletedPinIds?: string[];
  deletedUserIds?: string[];
  cloudConfig: CloudConfig;
}

export const CHILLICOTHE_CENTER: [number, number] = [39.3331, -82.9824];

export const COMMON_STREETS_PRESETS: string[] = [
  'Paint St',
  'E Main St',
  'W Main St',
  'N Bridge St',
  'S Bridge St',
  'E Water St',
  'W Water St',
  'Eastern Ave',
  'Western Ave',
  'N High St',
  'S High St',
  'Mulberry St',
  'E 2nd St',
  'W 2nd St',
  'E 4th St',
  'E 7th St',
  'Yoctangee Pkwy',
  'Scioto Ave',
  'Watt St',
  'Ewing St',
];
