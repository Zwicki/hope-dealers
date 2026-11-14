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
  const [activeTab, setActiveTab] = useState<ActiveTab>('walk');
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
    if (activeTab === 'admin') {
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
          <ActiveWalkTracker
            currentUser={currentUser}
            allUsers={dbState.users}
            lbsPerTrashBag={dbState.cloudConfig.lbsPerTrashBag}
            pins={dbState.pins}
            onOpenLogin={() => setIsLoginModalOpen(true)}
            onSaveWalk={handleSaveWalk}
            onSavePin={handleSavePin}
            onViewMap={() => setActiveTab('map')}
            onActiveWalkStateChange={setHasActiveWalkRunning}
          />
        )}

        {activeTab === 'map' && (
          <CommunityImpactMap
            walks={dbState.walks}
            pins={dbState.pins}
            currentUser={currentUser}
            onSavePin={handleSavePin}
            onDeletePin={handleDeletePin}
            onOpenLogin={() => setIsLoginModalOpen(true)}
          />
        )}

        {activeTab === 'impact' && (
          <ImpactReportPublisher
            walks={dbState.walks}
            pins={dbState.pins}
            currentUser={currentUser}
            onDeleteWalk={handleDeleteWalk}
            onViewMap={() => setActiveTab('map')}
          />
        )}

        {activeTab === 'admin' && currentUser?.role === 'superuser' && (
          <SuperUserPanel
            dbState={dbState}
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
