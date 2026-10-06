const SESSION_KEY = 'dsm.session';
const BRANCH_KEY = 'dsm.branch';
const LAST_USER_KEY = 'dsm.lastUser';

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
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

export const sessionStore = {
  get: () => read<StoredSession>(SESSION_KEY),
  set: (session: StoredSession | null) => write(SESSION_KEY, session),
  clear: () => {
    write(SESSION_KEY, null);
    write(BRANCH_KEY, null);
  },
};

export const lastUserStore = {
  get: () => read<string>(LAST_USER_KEY),
  set: (userId: string) => write(LAST_USER_KEY, userId),
};

let superAdmin = false;
let warehouseId: string | null = null;

export const branchStore = {
  get: () => read<string>(BRANCH_KEY) ?? ALL_BRANCHES,
  set: (branchId: string) => write(BRANCH_KEY, branchId),
  setSuperAdmin: (value: boolean) => {
    superAdmin = value;
  },
  setWarehouse: (id: string | null) => {
    warehouseId = id;
  },
  inWarehouse: () => superAdmin && warehouseId !== null && read<string>(BRANCH_KEY) === warehouseId,
  queryValue: () => {
    if (!superAdmin) return null;
    const value = read<string>(BRANCH_KEY);
    return value && value !== ALL_BRANCHES ? value : null;
  },
};
