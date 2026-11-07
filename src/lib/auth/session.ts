const LEGACY_SESSION_KEY = 'dsm.session';
export const SIGNED_IN_KEY = 'dsm.signedIn';
const BRANCH_KEY = 'dsm.branch';
const LAST_USER_KEY = 'dsm.lastUser';

export interface StoredSession {
  accessToken: string;
  expiresAt: number | null;
}

export const ALL_BRANCHES = 'all';

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}

write(LEGACY_SESSION_KEY, null);

let current: StoredSession | null = null;

export const sessionStore = {
  get: () => current,
  hasSession: () => read<boolean>(SIGNED_IN_KEY) === true,
  set: (session: StoredSession | null) => {
    current = session;
    if (session) write(SIGNED_IN_KEY, true);
  },
  clear: () => {
    current = null;
    write(SIGNED_IN_KEY, null);
    write(BRANCH_KEY, null);
  },
};

export const lastUserStore = {
  get: () => read<string>(LAST_USER_KEY),
  set: (userId: string) => write(LAST_USER_KEY, userId),
};

let superAdmin = false;
let warehouseId: string | null = null;

const VIEW_BRANCH_KEY = 'dsm.viewBranch';

function viewBranch() {
  try {
    return window.sessionStorage.getItem(VIEW_BRANCH_KEY);
  } catch {
    return null;
  }
}

export const branchStore = {
  get: () => read<string>(BRANCH_KEY) ?? ALL_BRANCHES,
  set: (branchId: string) => write(BRANCH_KEY, branchId),
  setSuperAdmin: (value: boolean) => {
    superAdmin = value;
  },
  setWarehouse: (id: string | null) => {
    warehouseId = id;
  },
  inWarehouse: () =>
    superAdmin && !viewBranch() && warehouseId !== null && read<string>(BRANCH_KEY) === warehouseId,
  setViewBranch: (branchId: string | null) => {
    try {
      if (branchId) window.sessionStorage.setItem(VIEW_BRANCH_KEY, branchId);
      else window.sessionStorage.removeItem(VIEW_BRANCH_KEY);
    } catch {
      return;
    }
  },
  queryValue: () => {
    if (!superAdmin) return null;
    const viewing = viewBranch();
    if (viewing) return viewing;
    const value = read<string>(BRANCH_KEY);
    return value && value !== ALL_BRANCHES ? value : null;
  },
};
