export interface TawkVisitorAttributes {
  name?: string;
  email?: string;
  hash?: string; // Optional HMAC for secure mode
  phone?: string;
  market?: 'KE' | 'INTL';
  currency?: 'KES' | 'USD';
  serviceInterest?: string;
  packageType?: string;
  budgetEstimate?: number | string;
  scrolled_75_percent?: boolean;
  current_path?: string;
  current_title?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface TawkAPI {
  onLoad?: () => void;
  onStatusChange?: (status: 'online' | 'away' | 'offline') => void;
  onChatStarted?: () => void;
  onChatEnded?: () => void;
  onPrechatSubmit?: (data: Record<string, string>) => void;
  onOfflineSubmit?: (data: Record<string, string>) => void;

  // Widget Actions
  maximize?: () => void;
  minimize?: () => void;
  toggle?: () => void;
  popup?: () => void;
  showWidget?: () => void;
  hideWidget?: () => void;

  // Metadata & Custom Events
  setAttributes?: (attributes: TawkVisitorAttributes, callback?: (error?: Error) => void) => void;
  addEvent?: (eventName: string, metadata?: Record<string, unknown>, callback?: (error?: Error) => void) => void;
  addTags?: (tags: string[], callback?: (error?: Error) => void) => void;
  removeTags?: (tags: string[], callback?: (error?: Error) => void) => void;

  // Status & Properties
  getStatus?: () => 'online' | 'away' | 'offline';
  isChatOngoing?: () => boolean;
}

declare global {
  interface Window {
    Tawk_API?: TawkAPI;
    Tawk_LoadStart?: Date;
  }
}
