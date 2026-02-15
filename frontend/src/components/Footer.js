import React from "react";
import "./Footer.css";

export default function Footer() {
  return (
    <footer className="site-footer">
      {/* Footer content */}
      <div className="footer-inner">
        © {new Date().getFullYear()} Garden Assistant. All rights reserved.
      </div>
    </footer>
  );
}