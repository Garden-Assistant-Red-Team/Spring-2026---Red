import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase"; // <-- change this if needed
import "./NavBar.css";

export default function NavBar() {
  const navigate = useNavigate();

  const [toolsOpen, setToolsOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const [user, setUser] = useState(null);

  const toolsRef = useRef(null);
  const resourcesRef = useRef(null);
  const profileRef = useRef(null);

  // Firebase: keep user in sync
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsub();
  }, []);

  // Close menus if you click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (toolsRef.current && !toolsRef.current.contains(e.target)) setToolsOpen(false);
      if (resourcesRef.current && !resourcesRef.current.contains(e.target)) setResourcesOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setProfileOpen(false);
    navigate("/");
  };

  return (
    <nav className="nav">
      <div className="navLeft">
        <Link to="/" className="brand">Garden Assistant</Link>

        <Link to="/" className="navLink">Home</Link>
        <Link to="/about" className="navLink">About</Link>
        <Link to="/garden" className="navLink">My Garden</Link>

        {/* Tools Dropdown */}
        <div className="dropdown" ref={toolsRef}>
          <button
            className="dropBtn"
            onClick={() => {
              setToolsOpen((v) => !v);
              setResourcesOpen(false);
              setProfileOpen(false);
            }}
            type="button"
          >
            Tools
          </button>

          {toolsOpen && (
            <div className="dropdownMenu">
              <Link to="/tools/reminders" className="dropdownItem" onClick={() => setToolsOpen(false)}>
                Reminders
              </Link>
              <Link to="/tools/recommendations" className="dropdownItem" onClick={() => setToolsOpen(false)}>
                Plant Recommendation
              </Link>
              <Link to="/tools/symptoms" className="dropdownItem" onClick={() => setToolsOpen(false)}>
                Symptom Assessment
              </Link>
              <Link to="/tools/weather" className="dropdownItem" onClick={() => setToolsOpen(false)}>
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
              setProfileOpen(false);
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

      {/* Right side */}
      <div className="navRight">
        {!user ? (
          <>
            <Link to="/login" className="navLink">Login</Link>
            <Link to="/signup" className="navLink">Sign Up</Link>
          </>
        ) : (
          <div className="dropdown" ref={profileRef}>
            <button
              className="dropBtn"
              onClick={() => {
                setProfileOpen((v) => !v);
                setToolsOpen(false);
                setResourcesOpen(false);
              }}
              type="button"
            >
              My Profile
            </button>

            {profileOpen && (
              <div className="dropdownMenu dropdownMenuRight">
                <div className="dropdownHeader">
                  Signed in as<br />
                  <strong>{user.email}</strong>
                </div>

                <Link to="/profile" className="dropdownItem" onClick={() => setProfileOpen(false)}>
                  Profile
                </Link>
                <Link to="/profile/settings" className="dropdownItem" onClick={() => setProfileOpen(false)}>
                  Settings
                </Link>
                <Link to="/profile/notifications" className="dropdownItem" onClick={() => setProfileOpen(false)}>
                  Notifications
                </Link>

                <button className="dropdownItem logoutItem" onClick={handleLogout} type="button">
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}