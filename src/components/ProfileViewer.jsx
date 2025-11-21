"use client";

import { ProfileCard } from "ethereum-identity-kit";
import "ethereum-identity-kit/css";

function ProfileViewer({ addressOrName, type, onClose }) {
  return (
    <div className="profile-content">
      <div className="profile-card-wrapper">
        <div className="card-container">
          <ProfileCard
            className="efp-profile-card"
            addressOrName={addressOrName}
          />
          <a
            href={`https://efp.app/${addressOrName}`}
            target="_blank"
            rel="noopener noreferrer"
            className="floating-btn"
          >
            View on EFP
          </a>
        </div>
      </div>
    </div>
  );
}

export default ProfileViewer;
