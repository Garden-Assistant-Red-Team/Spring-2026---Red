import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./NavBar.css";

export default function NavBar() {
  const [toolsOpen, setToolsOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);

  const toolsRef = useRef(null);
  const resourcesRef = useRef(null);

  // Close menus if you click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (toolsRef.current && !toolsRef.current.contains(e.target)) setToolsOpen(false);
      if (resourcesRef.current && !resourcesRef.current.contains(e.target)) setResourcesOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="nav">
      <div className="navLeft">
        <Link to="/" className="brand">
  Garden Assistant
</Link>

<Link to="/" className="navLink">
  Home
</Link>


        <Link to="/about" className="navLink">
          About
        </Link>

        <Link to="/garden" className="navLink">My Garden</Link>

        {/* Tools Dropdown */}
        <div className="dropdown" ref={toolsRef}>
          <button
            className="dropBtn"
            onClick={() => {
              setToolsOpen((v) => !v);
              setResourcesOpen(false);
            }}
            type="button"
          >
            Tools
          </button>

          {toolsOpen && (
            <div className="dropdownMenu">

              <Link
                to="/tools/reminders"
                className="dropdownItem"
                onClick={() => setToolsOpen(false)}
              >
                Reminders
              </Link>
              <Link
                to="/tools/recommendations"
                className="dropdownItem"
                onClick={() => setToolsOpen(false)}
              >
                Plant Recommendation
              </Link>

              <Link
                to="/tools/symptoms"
                className="dropdownItem"
                onClick={() => setToolsOpen(false)}
              >
                Symptom Assessment
              </Link>
              
              <Link
  to="/tools/weather"
  className="dropdownItem"
  onClick={() => setToolsOpen(false)}
>
  Weather
</Link>


            </div>
          )}
        </div>

        {/* Resources Dropdown */}
        <div className="dropdown" ref={resourcesRef}>
          <button
            className="dropBtn"
            onClick={() => {
              setResourcesOpen((v) => !v);
              setToolsOpen(false);
            }}
            type="button"
          >
            Resources
          </button>

          {resourcesOpen && (
            <div className="dropdownMenu">
              <Link to="/resources" className="dropdownItem" onClick={() => setResourcesOpen(false)}>
                Guides
              </Link>
              <Link to="/resources" className="dropdownItem" onClick={() => setResourcesOpen(false)}>
                Glossary
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="navRight">

  <Link to="/login" className="navLink">
    Login
  </Link>

  <Link to="/signup" className="navLink">
    Sign Up
  </Link>

</div>

    </nav>
  );
}
