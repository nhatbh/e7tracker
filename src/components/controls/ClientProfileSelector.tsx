import React from 'react';
import { useClientProfile } from '../../context/ClientProfileContext';
import './ClientProfileSelector.css';

export const ClientProfileSelector: React.FC = () => {
  const { profiles, activeProfile, isAutoDetected, changeProfile } = useClientProfile();

  const handleProfileChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const profileId = e.target.value;
    if (profileId) {
      changeProfile(profileId);
    }
  };

  return (
    <div className="client-profile-selector">
      <label htmlFor="client-profile-select">Game Client:</label>
      <div className="profile-select-wrapper">
        <select
          id="client-profile-select"
          value={activeProfile.id}
          onChange={handleProfileChange}
          className="profile-select"
        >
          {profiles
            .filter((p) => p.enabled)
            .map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
        </select>
        {isAutoDetected && <span className="auto-badge">AUTO</span>}
      </div>
      <div className="profile-info">
        <small>
          {isAutoDetected
            ? 'Auto-detected'
            : 'Manually selected'}
        </small>
      </div>
    </div>
  );
};
