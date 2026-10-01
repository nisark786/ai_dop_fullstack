import { create } from 'zustand';

export type UserRole = 'Admin' | 'Reviewer' | 'Viewer';

export interface ToastNotification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppState {
  currentRole: UserRole;
  isCopilotOpen: boolean;
  toast: ToastNotification | null;

  setRole: (role: UserRole) => void;
  setCopilotOpen: (open: boolean) => void;
  toggleCopilot: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  hideToast: () => void;
  reset: () => void;
}

const initialAppState = {
  currentRole: 'Admin' as UserRole,
  isCopilotOpen: false,
  toast: null as ToastNotification | null,
};

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useAppStore = create<AppState>()((set) => ({
  ...initialAppState,

  setRole: (role) => set({ currentRole: role }),
  setCopilotOpen: (open) => set({ isCopilotOpen: open }),
  toggleCopilot: () => set((state) => ({ isCopilotOpen: !state.isCopilotOpen })),

  showToast: (message, type = 'success') => {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    const id = `${Date.now()}-${Math.random()}`;
    set({ toast: { id, message, type } });

    // Auto-dismiss after 4 seconds
    toastTimer = setTimeout(() => {
      set((state) => (state.toast?.id === id ? { toast: null } : state));
      toastTimer = null;
    }, 4000);
  },

  hideToast: () => {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    set({ toast: null });
  },

  reset: () => {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    set(initialAppState);
  },
}));
