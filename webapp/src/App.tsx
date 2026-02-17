import { useEffect, useState, useRef, useCallback } from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  NavLink,
  useLocation,
} from "react-router-dom";

import Home from "./Home";
import FeedCategoriesMain from "./FeedCategoriesMain";
import ItemCategoriesMain from "./ItemCategoriesMain";
import FeedsList from "./FeedsList";
import FeedAdd from "./FeedAdd";
import FeedEdit from "./FeedEdit";
import ItemCategoryEdit from "./ItemCategoryEdit";
import ItemCategoryList from "./ItemCategoryList";
import Settings from "./Settings";
import { useSidebarDivider } from "./hooks/useSidebarDivider";
import {
  SIDEBAR_MENU_HIDE_REQUEST_EVENT,
  SIDEBAR_MENU_VISIBILITY_EVENT,
  SIDEBAR_VISIBILITY_MODE,
  type SidebarMenuHideRequestDetail,
  type SidebarMenuVisibilityDetail,
} from "./utils/sidebarMenuVisibility";

export default function App() {
  return (
    <Router>
      <AppLayout />
    </Router>
  );
}

function AppLayout() {
  const location = useLocation();
  const navMenu = useRef<HTMLDivElement>(null);
  const navOptions = useRef<HTMLDivElement>(null);
  const sidebarMenuFocusedBeforeClick = useRef(false);
  const [twoColLayout, setTwoColLayout] = useState(false);
  const [isSidebarMenuExplicitlyHidden, setSidebarMenuExplicitlyHidden] =
    useState(false);
  const [isSidebarMenuTemporarilyShown, setSidebarMenuTemporarilyShown] =
    useState(false);
  const dividerRef = useSidebarDivider();

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

      if (
        customEvent.detail?.mode === SIDEBAR_VISIBILITY_MODE.temporaryClear
      ) {
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

  const onSideMenuClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, targetPath: string) => {
      if (location.pathname === targetPath) {
        e.preventDefault();
        const sidebarMenuElement = document.getElementById("sidebar-menu");
        const shouldSelectFirstItem =
          sidebarMenuFocusedBeforeClick.current ||
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
        return;
      }

      sidebarMenuFocusedBeforeClick.current = false;
      setSidebarMenuExplicitlyHidden(false);
      setSidebarMenuTemporarilyShown(false);
    },
    [isSidebarMenuExplicitlyHidden, location.pathname]
  );

  const onSideMenuMouseDown = useCallback(() => {
    const sidebarMenuElement = document.getElementById("sidebar-menu");
    sidebarMenuFocusedBeforeClick.current =
      !!sidebarMenuElement &&
      !!document.activeElement &&
      sidebarMenuElement.contains(document.activeElement);
  }, []);

  return (
    <div
      id="wrapper"
      className={`${twoColLayout ? "two-columns" : ""} ${
        isSidebarMenuHidden ? "sidebar-menu-hidden" : ""
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

      <div id="side-menu">
        <NavLink
          to="/feeds/read"
          className="text-decoration-none"
          onMouseDown={onSideMenuMouseDown}
          onClick={(e) => onSideMenuClick(e, "/feeds/read")}
        >
          <i className="bi bi-layout-text-sidebar-reverse"></i>
        </NavLink>

        <NavLink
          to="/feeds/items"
          className="text-decoration-none"
          onMouseDown={onSideMenuMouseDown}
          onClick={(e) => onSideMenuClick(e, "/feeds/items")}
        >
          <i className="bi bi-collection"></i>
        </NavLink>

        <NavLink
          to="/feeds/list"
          className="text-decoration-none"
          onMouseDown={onSideMenuMouseDown}
          onClick={(e) => onSideMenuClick(e, "/feeds/list")}
        >
          <i className="bi bi-rss-fill"></i>
        </NavLink>

        <NavLink
          to="/feeds/add"
          className="text-decoration-none"
          onMouseDown={onSideMenuMouseDown}
          onClick={(e) => onSideMenuClick(e, "/feeds/add")}
        >
          <i className="bi bi-plus-square-fill"></i>
        </NavLink>

        <NavLink
          to="/settings"
          className="text-decoration-none"
          onMouseDown={onSideMenuMouseDown}
          onClick={(e) => onSideMenuClick(e, "/settings")}
        >
          <i className="bi bi-gear-fill"></i>
        </NavLink>
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

        <Route path="/feeds/edit/:feedId" element={<FeedEdit />} />

        <Route path="/item-categories/list" element={<ItemCategoryList />} />

        <Route
          path="/item-categories/edit/:categoryId"
          element={<ItemCategoryEdit />}
        />

        <Route path="/item-categories/new" element={<ItemCategoryEdit />} />

        <Route path="/settings" element={<Settings />} />
      </Routes>
    </div>
  );
}
