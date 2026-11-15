import React, { useEffect, useState } from 'react';
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

  // Pull from cloud on startup and listen for online/offline events
  useEffect(() => {
    void pullFromRemoteCloud().then((remoteState) => {
      if (remoteState) setDbState(remoteState);
    });

    const handleOnline = () => {
      setIsOnline(true);
      const latest = loadDatabase();
      void syncToRemoteCloud(latest).then(() => {
        setDbState(loadDatabase());
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleStorageSync = () => {
      setDbState(loadDatabase());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('storage', handleStorageSync);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('storage', handleStorageSync);
    };
  }, []);

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

  const handleSaveWalk = (walk: WalkSession) => {
    setDbState((prev) => {
      const updated = saveDatabase({
        ...prev,
        walks: [walk, ...prev.walks.filter((w) => w.id !== walk.id)],
      });
      return updated;
    });
  };

  const handleSavePin = (pin: EncounterPin) => {
    setDbState((prev) => {
      const updated = saveDatabase({
        ...prev,
        pins: [pin, ...prev.pins.filter((p) => p.id !== pin.id)],
      });
      return updated;
    });
  };

  const handleSaveHistoricalWalk = (
    walk: WalkSession,
    newPins: EncounterPin[]
  ) => {
    setDbState((prev) => {
      const updatedWalks = [walk, ...prev.walks.filter((w) => w.id !== walk.id)].sort(
        (a, b) => b.startTime.localeCompare(a.startTime)
      );
      const updatedPins = [...newPins, ...prev.pins].sort((a, b) =>
        b.timestamp.localeCompare(a.timestamp)
      );
      return saveDatabase({
        ...prev,
        walks: updatedWalks,
        pins: updatedPins,
      });
    });
  };

  const handleDeleteWalk = (walkId: string) => {
    setDbState((prev) => {
      const updated = saveDatabase({
        ...prev,
        walks: prev.walks.filter((w) => w.id !== walkId),
      });
      return updated;
    });
  };

  const handleDeletePin = (pinId: string) => {
    setDbState((prev) => {
      const updated = saveDatabase({
        ...prev,
        pins: prev.pins.filter((p) => p.id !== pinId),
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
      })
    );
  };

  const handleRemoveUser = (userId: string) => {
    setDbState((prev) =>
      saveDatabase({
        ...prev,
        users: prev.users.filter((u) => u.id !== userId),
      })
    );
  };

  const handleClearAllWalkData = () => {
    setDbState((prev) =>
      saveDatabase({
        ...prev,
        walks: [],
        pins: [],
      })
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
              lbsPerTrashBag={dbState.cloudConfig.lbsPerTrashBag}
              pins={dbState.pins}
              onOpenLogin={() => setIsLoginModalOpen(true)}
              onSaveWalk={handleSaveWalk}
              onSaveHistoricalWalk={handleSaveHistoricalWalk}
              onSavePin={handleSavePin}
              onViewMap={() => setActiveTab('map')}
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
