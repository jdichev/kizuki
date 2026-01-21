import { useEffect, useState, useRef } from "react";
import { HashRouter as Router, Routes, Route, NavLink } from "react-router-dom";

import Home from "./Home";
import FeedsMain from "./FeedsMain";
import ItemsPrompt from "./ItemsPrompt";
import FeedsList from "./FeedsList";
import FeedAdd from "./FeedAdd";
import FeedEdit from "./FeedEdit";

export default function App() {
  const navMenu = useRef<HTMLDivElement>(null);
  const [twoColLayout, setTwoColLayout] = useState(false);

  useEffect(() => {
    const hashChangeHandler = () => {
      setTwoColLayout(window.location.href.indexOf("feeds/") > -1);
    };

    window.addEventListener("hashchange", hashChangeHandler, false);
    return () => {
      window.removeEventListener("hashchange", hashChangeHandler);
    };
  });

  return (
    <div id="wrapper" className={twoColLayout ? "two-columns" : ""}>
      <Router>
        <div id="top-nav-brand">
          <NavLink to="/" className="text-decoration-none" />
        </div>

        <div className="main-content" id="top-nav-content">
          <div id="top-nav-menu" ref={navMenu} />

          <div id="top-nav-options"></div>
        </div>

        <div id="side-menu">
          <NavLink to="/feeds/read" className="text-decoration-none">
            <i className="bi bi-layout-text-sidebar-reverse"></i>
          </NavLink>

          <NavLink to="/feeds/prompt" className="text-decoration-none">
            <i className="bi bi-file-text"></i>
          </NavLink>

          <NavLink to="/feeds/list" className="text-decoration-none">
            <i className="bi bi-rss-fill"></i>
          </NavLink>

          <NavLink to="/feeds/add" className="text-decoration-none">
            <i className="bi bi-plus-square-fill"></i>
          </NavLink>
        </div>

        <Routes>
          <Route path="/" element={<Home />} />

          <Route path="/feeds/read" element={<FeedsMain topMenu={navMenu} />} />

          <Route
            path="/feeds/prompt"
            element={<ItemsPrompt topMenu={navMenu} />}
          />

          <Route path="/feeds/list" element={<FeedsList topMenu={navMenu} />} />

          <Route path="/feeds/add" element={<FeedAdd />} />

          <Route path="/feeds/edit/:feedId" element={<FeedEdit />} />
        </Routes>
      </Router>
    </div>
  );
}
