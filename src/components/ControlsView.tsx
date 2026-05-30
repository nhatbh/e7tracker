import React from 'react';
import { useTranslation } from 'react-i18next';
import { ClientProfileSelector } from './controls/ClientProfileSelector';
import { useCacheManager } from '../context/CacheManager';
import './ControlsView.css';

export interface WindowInfo {
    hwnd: number;
    title: string;
}

interface ControlsViewProps {

}

export const ControlsView: React.FC<ControlsViewProps> = ({

}) => {
    const { t } = useTranslation();
    const { purgeAllCache } = useCacheManager();

    return (
        <main className="controls-container">
            <div className="controls-header">
                <h1>{t('controls.title', 'Controls View')}</h1>
            </div>
            
            <div className="controls-section">
                <h2>{t('controls.client', 'Game Client')}</h2>
                <ClientProfileSelector />
            </div>

            <div className="controls-section">
                <h2>{t('controls.cache', 'Cache')}</h2>
                <button 
                    className="controls-btn-danger"
                    onClick={() => purgeAllCache()}
                >
                    {t('controls.purgeCache', 'Purge All Cache')}
                </button>
            </div>

            <div className="controls-section">
                <p>{t('controls.refactoring', 'Refactoring in progress...')}</p>
            </div>
        </main>
    );
};
