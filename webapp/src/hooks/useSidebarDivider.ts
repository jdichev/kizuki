import { useEffect, useRef } from "react";

const STORAGE_KEY = "sidebar-divider-pos";
const DEFAULT_POS = 220;
const MIN_POS = 220;
const MAX_POS = 320;

export function useSidebarDivider() {
  const dividerRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startPos = useRef(0);

  // Load position from localStorage and set up divider
  useEffect(() => {
    const savedPos = localStorage.getItem(STORAGE_KEY);
    let initialPos = DEFAULT_POS;

    if (savedPos) {
      const pos = parseInt(savedPos, 10);
      if (!isNaN(pos) && pos >= MIN_POS && pos <= MAX_POS) {
        initialPos = pos;
      }
    }

    setSidebarWidth(initialPos);
  }, []);

  const setSidebarWidth = (pos: number) => {
    document.documentElement.style.setProperty(
      "--sidebar-divider-pos",
      `${pos}px`
    );
  };

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;

      isResizing.current = true;
      startX.current = e.clientX;
      const dividerPos = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--sidebar-divider-pos"
        ),
        10
      );
      startPos.current = dividerPos;

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;

      const delta = e.clientX - startX.current;
      let newPos = startPos.current + delta;

      // Constrain to min/max
      newPos = Math.max(MIN_POS, Math.min(MAX_POS, newPos));

      setSidebarWidth(newPos);
    };

    const handleMouseUp = () => {
      if (!isResizing.current) return;

      isResizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      // Save position to localStorage
      const dividerPos = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--sidebar-divider-pos"
        ),
        10
      );
      localStorage.setItem(STORAGE_KEY, dividerPos.toString());
    };

    const divider = dividerRef.current;
    if (divider) {
      divider.addEventListener("mousedown", handleMouseDown);
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      if (divider) {
        divider.removeEventListener("mousedown", handleMouseDown);
      }
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  return dividerRef;
}
