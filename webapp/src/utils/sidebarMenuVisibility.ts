export const SIDEBAR_MENU_VISIBILITY_EVENT = "sidebar-menu-visibility" as const;
export const SIDEBAR_MENU_HIDE_REQUEST_EVENT =
  "sidebar-menu-hide-request" as const;

export const SIDEBAR_VISIBILITY_MODE = {
  temporaryShow: "temporary-show",
  temporaryClear: "temporary-clear",
} as const;

export type SidebarVisibilityMode =
  (typeof SIDEBAR_VISIBILITY_MODE)[keyof typeof SIDEBAR_VISIBILITY_MODE];

export type SidebarMenuVisibilityDetail = {
  hidden?: boolean;
  mode?: SidebarVisibilityMode;
};

export type SidebarMenuHideRequestDetail = {
  shouldSelectFirstItem?: boolean;
};
