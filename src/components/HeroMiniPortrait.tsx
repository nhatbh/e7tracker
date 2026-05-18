import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { CombatData } from '../services/combatData';

interface HeroMiniPortraitProps {
    heroName?: string;
    heroCode?: string;
    size?: number;
    className?: string;
    style?: React.CSSProperties;
}

export const HeroMiniPortrait: React.FC<HeroMiniPortraitProps> = React.memo(({
    heroName,
    heroCode,
    size = 16,
    className = '',
    style
}) => {
    const [portraitUrl, setPortraitUrl] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        const fetchPortrait = async () => {
            let targetCode = heroCode || '';
            if (!targetCode && heroName) {
                const meta = CombatData.getMetadata();
                const matched = meta?.hero_list.find(h => h.hero_name.toLowerCase() === heroName.toLowerCase());
                if (matched) {
                    targetCode = matched.hero;
                }
            }

            if (!targetCode) return;

            try {
                const base64Data = await invoke<string>("get_or_download_portrait", { heroCode: targetCode });
                if (isMounted) {
                    setPortraitUrl(base64Data);
                }
            } catch (e) {
                // Fallback silently to text avatar
            }
        };

        fetchPortrait();
        return () => {
            isMounted = false;
        };
    }, [heroName, heroCode]);

    const displayInitials = (heroName || 'H').substring(0, 2).toUpperCase();

    if (portraitUrl) {
        return (
            <img
                src={portraitUrl}
                alt={heroName || 'Hero'}
                className={`mini-portrait-img ${className}`}
                style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    borderRadius: '4px',
                    objectFit: 'cover',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    ...style
                }}
            />
        );
    }

    return (
        <div
            className={`mini-portrait-placeholder ${className}`}
            style={{
                width: `${size}px`,
                height: `${size}px`,
                borderRadius: '4px',
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                color: '#38bdf8',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: `${size * 0.45}px`,
                fontWeight: 800,
                userSelect: 'none',
                ...style
            }}
        >
            {displayInitials}
        </div>
    );
});

export const getLegitMatchups = (list: any[]) => {
    if (!list) return [];
    const minCount = 10;
    let filtered = list.filter(item => item.count >= minCount);
    if (filtered.length === 0) {
        filtered = list.filter(item => item.count >= 5);
    }
    if (filtered.length === 0) {
        filtered = list.filter(item => item.count >= 2);
    }
    return filtered.sort((a, b) => b.win_rate - a.win_rate);
};
