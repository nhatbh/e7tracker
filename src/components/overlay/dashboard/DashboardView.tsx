import React from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardTierList } from './DashboardTierList';
import './DashboardView.css';

interface DashboardViewProps {
    isActive: boolean;
    onClose: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ isActive, onClose }) => {
    const { t } = useTranslation();

    if (!isActive) return null;

    return (
        <div className="dashboard-overlay">
            <div className="dashboard-content">
                <div className="dashboard-header">
                    <h2>{t('dashboard.title', 'Meta Tier List')}</h2>
                    <button onClick={onClose} className="close-btn">✕</button>
                </div>
                <DashboardTierList />
            </div>
        </div>
    );
};
