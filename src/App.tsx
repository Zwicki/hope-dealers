import React, { useEffect, useMemo, useState } from 'react';
import {
  AppDatabaseState,
  CloudConfig,
  EncounterPin,
  UserAccount,
  WalkSession,
} from './types/hopeDealers';
import {
  loadCurrentSession,
  loadDatabase,
  pullFromRemoteCloud,
  refineWalkPinsWithRouteGeocoding,
  saveCurrentSession,
  saveDatabase,
  SEED_PINS,
  SEED_WALKS,
  syncToRemoteCloud,
} from './services/cloudSyncService';
import { ActiveTab, Navbar } from './components/Navbar';
import { ActiveWalkTracker } from './components/ActiveWalkTracker';
import { CommunityImpactMap } from './components/CommunityImpactMap';
import { ImpactReportPublisher } from './components/ImpactReportPublisher';
import { SuperUserPanel } from './components/SuperUserPanel';
import { LoginModal } from './components/LoginModal';

export function App() {
  const [dbState, setDbState] = useState<AppDatabaseState>(() => loadDatabase());
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() =>
    loadCurrentSession()
  );
  const [activeTab, setActiveTab] = useState<ActiveTab>(() =>
    loadCurrentSession() ? 'walk' : 'impact'
  );
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [hasActiveWalkRunning, setHasActiveWalkRunning] = useState(false);

  // Pull from cloud on startup, refine pin route-segment placement, and listen for online/offline/sync events
  useEffect(() => {
    void pullFromRemoteCloud().then(async (remoteState) => {
      const base = remoteState || loadDatabase();
      setDbState(base);
      const refined = await refineWalkPinsWithRouteGeocoding(base);
      if (refined) setDbState(refined);
    });

    const handleOnline = () => {
      setIsOnline(true);
      const latest = loadDatabase();
      void syncToRemoteCloud(latest).then((res) => {
        setDbState(res.mergedState || loadDatabase());
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleStorageSync = () => {
      setDbState(loadDatabase());
    };

    const handleWindowFocus = () => {
      void pullFromRemoteCloud().then((remoteState) => {
        if (remoteState) setDbState(remoteState);
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('storage', handleStorageSync);
    window.addEventListener('hope-dealers-db-updated', handleStorageSync);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('storage', handleStorageSync);
      window.removeEventListener('hope-dealers-db-updated', handleStorageSync);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);

  // Refresh from cloud when switching tabs so Map and Walk Log always show latest cloud data
  useEffect(() => {
    if (isOnline) {
      void pullFromRemoteCloud().then((remoteState) => {
        if (remoteState) setDbState(remoteState);
      });
    }
  }, [activeTab, isOnline]);

  const handleLoginSuccess = (user: UserAccount) => {
    setCurrentUser(user);
    saveCurrentSession(user);
    setActiveTab('walk');
    // Also add walk-up volunteer to roster if not present
    setDbState((prev) => {
      const exists = prev.users.some(
        (u) => u.name.toLowerCase() === user.name.toLowerCase()
      );
      if (exists) return prev;
      const updated = saveDatabase({
        ...prev,
        users: [...prev.users, user],
      });
      return updated;
    });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    saveCurrentSession(null);
    if (activeTab === 'admin' || activeTab === 'walk') {
      setActiveTab('impact');
    }
  };

  const mergeMembersIntoUsers = (
    users: UserAccount[],
    names: string[]
  ): UserAccount[] => {
    const nextUsers = [...users];
    names.forEach((raw) => {
      const clean = (raw || '').trim();
      if (!clean) return;
      const exists = nextUsers.some(
        (u) => u.name.toLowerCase() === clean.toLowerCase()
      );
      if (!exists) {
        nextUsers.push({
          id: `vol-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: clean,
          email: `${clean.toLowerCase().replace(/[^a-z0-9]/g, '.')}@hopedealers.local`,
          role: 'volunteer',
          active: true,
          createdAt: new Date().toISOString(),
        });
      }
    });
    return nextUsers;
  };

  const handleAddNewPerson = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    setDbState((prev) => {
      const updatedUsers = mergeMembersIntoUsers(prev.users, [clean]);
      if (updatedUsers.length === prev.users.length) return prev;
      return saveDatabase({
        ...prev,
        users: updatedUsers,
      });
    });
  };

  const handleSaveWalk = (walk: WalkSession) => {
    const nowIso = new Date().toISOString();
    const walkWithTs: WalkSession = { ...walk, updatedAt: nowIso };
    setDbState((prev) => {
      const updatedWalks = [
        walkWithTs,
        ...prev.walks.filter((w) => w.id !== walk.id),
      ].sort((a, b) => b.startTime.localeCompare(a.startTime));
      const updatedUsers = mergeMembersIntoUsers(prev.users, [
        walk.recorderName,
        ...(walk.groupMembers || []),
      ]);
      const updated = saveDatabase({
        ...prev,
        users: updatedUsers,
        walks: updatedWalks,
        deletedWalkIds: (prev.deletedWalkIds || []).filter(
          (id) => id !== walk.id
        ),
      });
      return updated;
    });
  };

  const handleSavePin = (pin: EncounterPin) => {
    const nowIso = new Date().toISOString();
    const pinWithTs: EncounterPin = { ...pin, updatedAt: nowIso };
    setDbState((prev) => {
      const updated = saveDatabase({
        ...prev,
        pins: [pinWithTs, ...prev.pins.filter((p) => p.id !== pin.id)],
        deletedPinIds: (prev.deletedPinIds || []).filter((id) => id !== pin.id),
      });
      return updated;
    });
  };

  const handleSaveHistoricalWalk = (
    walk: WalkSession,
    newPins: EncounterPin[]
  ) => {
    const nowIso = new Date().toISOString();
    const walkWithTs: WalkSession = { ...walk, updatedAt: nowIso };
    const pinsWithTs: EncounterPin[] = newPins.map((p) => ({
      ...p,
      updatedAt: nowIso,
    }));
    setDbState((prev) => {
      const updatedWalks = [
        walkWithTs,
        ...prev.walks.filter((w) => w.id !== walk.id),
      ].sort((a, b) => b.startTime.localeCompare(a.startTime));
      const updatedPins = [...pinsWithTs, ...prev.pins].sort((a, b) =>
        b.timestamp.localeCompare(a.timestamp)
      );
      const updatedUsers = mergeMembersIntoUsers(prev.users, [
        walk.recorderName,
        ...(walk.groupMembers || []),
      ]);
      return saveDatabase({
        ...prev,
        users: updatedUsers,
        walks: updatedWalks,
        pins: updatedPins,
        deletedWalkIds: (prev.deletedWalkIds || []).filter(
          (id) => id !== walk.id
        ),
      });
    });
  };

  const handleDeleteWalk = (walkId: string) => {
    setDbState((prev) => {
      const nextDeleted = Array.from(
        new Set([...(prev.deletedWalkIds || []), walkId])
      );
      const updated = saveDatabase({
        ...prev,
        walks: prev.walks.filter((w) => w.id !== walkId),
        deletedWalkIds: nextDeleted,
      });
      return updated;
    });
  };

  const handleDeletePin = (pinId: string) => {
    setDbState((prev) => {
      const nextDeleted = Array.from(
        new Set([...(prev.deletedPinIds || []), pinId])
      );
      const updated = saveDatabase({
        ...prev,
        pins: prev.pins.filter((p) => p.id !== pinId),
        deletedPinIds: nextDeleted,
      });
      return updated;
    });
  };

  const handleUpdateCloudConfig = (config: CloudConfig) => {
    setDbState((prev) =>
      saveDatabase({
        ...prev,
        cloudConfig: config,
      })
    );
  };

  const handleAddUser = (user: UserAccount) => {
    setDbState((prev) =>
      saveDatabase({
        ...prev,
        users: [...prev.users, user],
        deletedUserIds: (prev.deletedUserIds || []).filter(
          (id) => id !== user.id
        ),
      })
    );
  };

  const handleRemoveUser = (userId: string) => {
    setDbState((prev) =>
      saveDatabase({
        ...prev,
        users: prev.users.filter((u) => u.id !== userId),
        deletedUserIds: Array.from(
          new Set([...(prev.deletedUserIds || []), userId])
        ),
      })
    );
  };

  const handleClearAllWalkData = () => {
    setDbState((prev) =>
      saveDatabase(
        {
          ...prev,
          walks: [],
          pins: [],
          deletedWalkIds: [],
          deletedPinIds: [],
        },
        { mode: 'replace' }
      )
    );
  };

  const handleRestoreDemoData = () => {
    setDbState((prev) =>
      saveDatabase({
        ...prev,
        walks: SEED_WALKS,
        pins: SEED_PINS,
      })
    );
  };

  const handleImportDatabase = (imported: AppDatabaseState) => {
    setDbState(saveDatabase(imported));
  };

  const handleManualSync = async () => {
    await syncToRemoteCloud(dbState);
    const pulled = await pullFromRemoteCloud();
    setDbState(pulled || loadDatabase());
  };

  const pendingSyncCount =
    dbState.walks.filter((w) => w.syncStatus === 'pending').length +
    dbState.pins.filter((p) => p.syncStatus === 'pending').length;

  // Compile all previous people who have walked (from users roster + all saved walks + pins)
  const allKnownPeople = useMemo(() => {
    const map = new Map<string, string>();
    const addName = (raw?: string) => {
      const clean = (raw || '').trim();
      if (!clean) return;
      const key = clean.toLowerCase();
      if (!map.has(key)) {
        map.set(key, clean);
      }
    };
    dbState.users.forEach((u) => addName(u.name));
    dbState.walks.forEach((w) => {
      addName(w.recorderName);
      (w.groupMembers || []).forEach((m) => addName(m));
    });
    dbState.pins.forEach((p) => {
      addName(p.loggedByRecorder);
      (p.groupMembers || []).forEach((m) => addName(m));
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [dbState.users, dbState.walks, dbState.pins]);

  return (
    <div className="min-h-screen bg-slateDark-950 text-slate-100 flex flex-col">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
        isOnline={isOnline}
        pendingSyncCount={pendingSyncCount}
        lastSyncedAt={dbState.cloudConfig.lastSyncedAt}
        onManualSync={handleManualSync}
        hasActiveWalkRunning={hasActiveWalkRunning}
      />

      <main className="flex-1">
        {activeTab === 'walk' && (
          currentUser ? (
            <ActiveWalkTracker
              currentUser={currentUser}
              allUsers={dbState.users}
              allKnownPeople={allKnownPeople}
              onAddNewPerson={handleAddNewPerson}
              lbsPerTrashBag={dbState.cloudConfig.lbsPerTrashBag}
              pins={dbState.pins}
              onOpenLogin={() => setIsLoginModalOpen(true)}
              onSaveWalk={handleSaveWalk}
              onSaveHistoricalWalk={handleSaveHistoricalWalk}
              onSavePin={handleSavePin}
              onViewMap={() => setActiveTab('map')}
              onViewImpact={() => setActiveTab('impact')}
              onActiveWalkStateChange={setHasActiveWalkRunning}
            />
          ) : (
            <div className="max-w-lg mx-auto px-4 py-14 text-center space-y-5">
              <img
                src="/hope-dealers-logo.png"
                alt="Hope Dealers Logo"
                className="h-36 w-auto mx-auto object-contain drop-shadow-2xl"
              />
              <div className="p-6 rounded-3xl bg-slateDark-900 border border-slate-800 shadow-2xl space-y-4">
                <span className="inline-block px-3 py-1 rounded-full bg-phoenix-500/20 border border-phoenix-500/30 text-phoenix-300 text-xs font-extrabold uppercase tracking-wider">
                  🔒 Volunteer Access Required
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-white">
                  Sign In to Log Walks & Counters
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Only signed-in Hope Dealers volunteers and Super Users can record street walks, GPS routes, interactions, prayer pins, and trash pickup.
                </p>
                <button
                  type="button"
                  onClick={() => setIsLoginModalOpen(true)}
                  className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-phoenix-500 via-phoenix-600 to-phoenix-red hover:from-phoenix-600 hover:to-phoenix-700 text-white font-extrabold text-sm shadow-lg shadow-phoenix-600/30 transition"
                >
                  Volunteer / Super User Sign In
                </button>
              </div>
            </div>
          )
        )}

        {activeTab === 'map' && (
          <CommunityImpactMap
            walks={dbState.walks}
            pins={dbState.pins}
            currentUser={currentUser}
            allUsers={dbState.users}
            allKnownPeople={allKnownPeople}
            onAddNewPerson={handleAddNewPerson}
            lbsPerTrashBag={dbState.cloudConfig.lbsPerTrashBag}
            onSaveWalk={handleSaveWalk}
            onSavePin={handleSavePin}
            onDeletePin={handleDeletePin}
            onDeleteWalk={handleDeleteWalk}
            onOpenLogin={() => setIsLoginModalOpen(true)}
          />
        )}

        {activeTab === 'impact' && (
          <ImpactReportPublisher
            walks={dbState.walks}
            pins={dbState.pins}
            currentUser={currentUser}
            allUsers={dbState.users}
            allKnownPeople={allKnownPeople}
            onAddNewPerson={handleAddNewPerson}
            lbsPerTrashBag={dbState.cloudConfig.lbsPerTrashBag}
            onSaveWalk={handleSaveWalk}
            onSavePin={handleSavePin}
            onDeletePin={handleDeletePin}
            onDeleteWalk={handleDeleteWalk}
            onViewMap={() => setActiveTab('map')}
          />
        )}

        {activeTab === 'admin' && currentUser?.role === 'superuser' && (
          <SuperUserPanel
            currentUser={currentUser}
            dbState={dbState}
            onSaveHistoricalWalk={handleSaveHistoricalWalk}
            onSaveStandalonePin={handleSavePin}
            onViewMap={() => setActiveTab('map')}
            onUpdateCloudConfig={handleUpdateCloudConfig}
            onAddUser={handleAddUser}
            onRemoveUser={handleRemoveUser}
            onClearAllWalkData={handleClearAllWalkData}
            onRestoreDemoData={handleRestoreDemoData}
            onImportDatabase={handleImportDatabase}
            onTriggerSync={handleManualSync}
          />
        )}
      </main>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        users={dbState.users}
        teamAccessCode={dbState.cloudConfig.teamAccessCode}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}

export default App;
