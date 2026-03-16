import { useEffect, useState, useRef, useCallback } from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  NavLink,
  useLocation,
  useNavigate,
} from "react-router-dom";

import Home from "./Home";
import FeedCategoriesMain from "./FeedCategoriesMain";
import ItemCategoriesMain from "./ItemCategoriesMain";
import FeedsList from "./FeedsList";
import FeedAdd from "./FeedAdd";
import FeedOpmlOps from "./FeedOpmlOps";
import FeedEdit from "./FeedEdit";
import ItemCategoryEdit from "./ItemCategoryEdit";
import ItemCategoryList from "./ItemCategoryList";
import FeedCategoryList from "./FeedCategoryList";
import FeedCategoryEdit from "./FeedCategoryEdit";
import Settings from "./Settings";
import ItemsSearch from "./ItemsSearch";
import { useSidebarDivider } from "./hooks/useSidebarDivider";
import {
  SIDEBAR_MENU_HIDE_REQUEST_EVENT,
  SIDEBAR_MENU_VISIBILITY_EVENT,
  SIDEBAR_VISIBILITY_MODE,
  type SidebarMenuHideRequestDetail,
  type SidebarMenuVisibilityDetail,
} from "./utils/sidebarMenuVisibility";

const SIDE_MENU_ITEMS = [
  { path: "/feeds/read", iconClass: "bi bi-layout-text-sidebar-reverse" },
  { path: "/feeds/items", iconClass: "bi bi-collection" },
  { path: "/feeds/list", iconClass: "bi bi-rss-fill" },
  { path: "/feeds/add", iconClass: "bi bi-plus-square-fill" },
  { path: "/settings", iconClass: "bi bi-gear-fill" },
] as const;

function getStatusLabel(pathname: string) {
  if (pathname === "/") {
    return "Home";
  }

  if (pathname.startsWith("/feeds/read")) {
    return "Feed Categories";
  }

  if (pathname.startsWith("/feeds/items")) {
    return "Items categorized by AI";
  }

  if (pathname.startsWith("/feeds/list")) {
    return "Feeds List";
  }

  if (pathname.startsWith("/feeds/add")) {
    return "Add Feed";
  }

  if (pathname.startsWith("/feeds/opml")) {
    return "OPML Import / Export";
  }

  if (pathname.startsWith("/feeds/edit")) {
    return "Edit Feed";
  }

  if (pathname.startsWith("/item-categories/list")) {
    return "Item Categories";
  }

  if (pathname.startsWith("/item-categories/edit")) {
    return "Edit Item Category";
  }

  if (pathname.startsWith("/item-categories/new")) {
    return "New Item Category";
  }

  if (pathname.startsWith("/feed-categories/list")) {
    return "Feed Categories";
  }

  if (pathname.startsWith("/feed-categories/edit")) {
    return "Edit Feed Category";
  }

  if (pathname.startsWith("/feed-categories/new")) {
    return "New Feed Category";
  }

  if (pathname.startsWith("/items/search")) {
    return "Search Items";
  }

  if (pathname.startsWith("/settings")) {
    return "Settings";
  }

  return "Ready";
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

export default function App() {
  return (
    <Router>
      <AppLayout />
    </Router>
  );
}

function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const navMenu = useRef<HTMLDivElement>(null);
  const navOptions = useRef<HTMLDivElement>(null);
  const sidebarMenuFocusedBeforeClick = useRef(false);
  const [twoColLayout, setTwoColLayout] = useState(false);
  const [isSidebarMenuExplicitlyHidden, setSidebarMenuExplicitlyHidden] =
    useState(false);
  const [isSidebarMenuTemporarilyShown, setSidebarMenuTemporarilyShown] =
    useState(false);
  const [showAltNavHints, setShowAltNavHints] = useState(false);
  const dividerRef = useSidebarDivider();
  const statusLabel = getStatusLabel(location.pathname);

  const isSidebarMenuHidden =
    isSidebarMenuExplicitlyHidden && !isSidebarMenuTemporarilyShown;

  useEffect(() => {
    setTwoColLayout(location.pathname.indexOf("/feeds/") > -1);
  }, [location.pathname]);

  useEffect(() => {
    setSidebarMenuExplicitlyHidden(false);
    setSidebarMenuTemporarilyShown(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleSidebarMenuVisibility = (event: Event) => {
      const customEvent = event as CustomEvent<SidebarMenuVisibilityDetail>;

      if (customEvent.detail?.mode === SIDEBAR_VISIBILITY_MODE.temporaryShow) {
        setSidebarMenuTemporarilyShown(true);
        return;
      }

      if (customEvent.detail?.mode === SIDEBAR_VISIBILITY_MODE.temporaryClear) {
        setSidebarMenuTemporarilyShown(false);
        return;
      }

      if (typeof customEvent.detail?.hidden === "boolean") {
        setSidebarMenuExplicitlyHidden(customEvent.detail.hidden);
        if (!customEvent.detail.hidden) {
          setSidebarMenuTemporarilyShown(false);
        }
      }
    };

    window.addEventListener(
      SIDEBAR_MENU_VISIBILITY_EVENT,
      handleSidebarMenuVisibility as EventListener
    );

    return () => {
      window.removeEventListener(
        SIDEBAR_MENU_VISIBILITY_EVENT,
        handleSidebarMenuVisibility as EventListener
      );
    };
  }, []);

  const toggleSidebarMenu = useCallback(() => {
    const sidebarMenuElement = document.getElementById("main-sidebar");
    const shouldSelectFirstItem =
      sidebarMenuFocusedBeforeClick.current ||
      (!!sidebarMenuElement &&
        !!document.activeElement &&
        sidebarMenuElement.contains(document.activeElement)) ||
      (!!sidebarMenuElement &&
        sidebarMenuElement.getAttribute("data-activenav") === "true");

    const nextExplicitHidden = !isSidebarMenuExplicitlyHidden;
    setSidebarMenuExplicitlyHidden(nextExplicitHidden);

    if (nextExplicitHidden) {
      const detail: SidebarMenuHideRequestDetail = {
        shouldSelectFirstItem,
      };

      window.dispatchEvent(
        new CustomEvent(SIDEBAR_MENU_HIDE_REQUEST_EVENT, {
          detail,
        })
      );
    }

    sidebarMenuFocusedBeforeClick.current = false;
    setSidebarMenuTemporarilyShown(false);
  }, [isSidebarMenuExplicitlyHidden]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const altDigitMatch = event.code.match(/^(?:Digit|Numpad)([1-5])$/);
      const isAltDigitShortcut =
        event.altKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        !!altDigitMatch;

      if (event.key === "Alt" || event.altKey) {
        setShowAltNavHints(true);
      }

      if (isAltDigitShortcut) {
        if (isTypingTarget(event.target)) {
          return;
        }

        const shortcutNumber = Number(altDigitMatch?.[1]);
        const targetIndex = shortcutNumber - 1;
        const targetItem = SIDE_MENU_ITEMS[targetIndex];

        if (!targetItem) {
          return;
        }

        event.preventDefault();
        sidebarMenuFocusedBeforeClick.current = false;
        setSidebarMenuExplicitlyHidden(false);
        setSidebarMenuTemporarilyShown(false);
        navigate(targetItem.path);
        return;
      }

      const isToggleShortcut =
        event.code === "KeyB" &&
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey;

      if (!isToggleShortcut) {
        return;
      }

      const sidebarMenuElement = document.getElementById("main-sidebar");
      if (!sidebarMenuElement) {
        return;
      }

      event.preventDefault();
      toggleSidebarMenu();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Alt") {
        setShowAltNavHints(false);
      }
    };

    const handleWindowBlur = () => {
      setShowAltNavHints(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [navigate, toggleSidebarMenu]);

  const onSideMenuClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, targetPath: string) => {
      if (location.pathname === targetPath) {
        e.preventDefault();
        toggleSidebarMenu();
        return;
      }

      sidebarMenuFocusedBeforeClick.current = false;
      setSidebarMenuExplicitlyHidden(false);
      setSidebarMenuTemporarilyShown(false);
    },
    [location.pathname, toggleSidebarMenu]
  );

  const onSideMenuMouseDown = useCallback(() => {
    const sidebarMenuElement = document.getElementById("main-sidebar");
    sidebarMenuFocusedBeforeClick.current =
      !!sidebarMenuElement &&
      !!document.activeElement &&
      sidebarMenuElement.contains(document.activeElement);
  }, []);

  return (
    <div
      id="wrapper"
      className={`${twoColLayout ? "two-columns" : ""} ${
        isSidebarMenuHidden ? "main-sidebar-hidden" : ""
      }`.trim()}
    >
      <div id="top-nav-home"></div>

      <div id="top-nav-brand">
        <NavLink to="/" className="text-decoration-none" />
      </div>

      <div className="main-content" id="top-nav-content">
        <div id="top-nav-menu" ref={navMenu} />

        <div id="top-nav-options" ref={navOptions}></div>
      </div>

      <div id="main-nav" className={showAltNavHints ? "show-shortcuts" : ""}>
        {SIDE_MENU_ITEMS.map((item, index) => (
          <NavLink
            key={item.path}
            to={item.path}
            className="text-decoration-none"
            onMouseDown={onSideMenuMouseDown}
            onClick={(e) => onSideMenuClick(e, item.path)}
          >
            <i className={item.iconClass}></i>
            <span className="main-nav-shortcut-hint" aria-hidden="true">
              {index + 1}
            </span>
          </NavLink>
        ))}
      </div>

      <div id="sidebar-divider" ref={dividerRef} />

      <Routes>
        <Route path="/" element={<Home />} />

        <Route
          path="/feeds/read"
          element={
            <FeedCategoriesMain topMenu={navMenu} topOptions={navOptions} />
          }
        />

        <Route
          path="/feeds/items"
          element={
            <ItemCategoriesMain topMenu={navMenu} topOptions={navOptions} />
          }
        />

        <Route path="/feeds/list" element={<FeedsList topMenu={navMenu} />} />

        <Route path="/feeds/add" element={<FeedAdd />} />

        <Route path="/feeds/opml" element={<FeedOpmlOps />} />

        <Route path="/feeds/edit/:feedId" element={<FeedEdit />} />

        <Route path="/item-categories/list" element={<ItemCategoryList />} />

        <Route
          path="/item-categories/edit/:categoryId"
          element={<ItemCategoryEdit />}
        />

        <Route path="/item-categories/new" element={<ItemCategoryEdit />} />

        <Route path="/feed-categories/list" element={<FeedCategoryList />} />

        <Route
          path="/feed-categories/edit/:categoryId"
          element={<FeedCategoryEdit />}
        />

        <Route path="/feed-categories/new" element={<FeedCategoryEdit />} />

        <Route path="/items/search" element={<ItemsSearch />} />

        <Route path="/settings" element={<Settings />} />
      </Routes>

      <footer id="app-status-bar" role="status" aria-live="polite">
        <div className="status-bar-section status-bar-left">
          <span className="status-bar-item">
            <i className="bi bi-rss-fill" aria-hidden="true"></i>
            Kizuki
          </span>
          <span className="status-bar-item">
            <i className="bi bi-hash" aria-hidden="true"></i>
            {statusLabel}
          </span>
        </div>

        <div className="status-bar-section status-bar-right">
          <span className="status-bar-item">
            <i className="bi bi-shield-check" aria-hidden="true"></i>
            Ready
          </span>
        </div>
      </footer>
    </div>
  );
}
