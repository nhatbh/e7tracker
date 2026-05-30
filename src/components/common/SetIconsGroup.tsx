/**
 * Reusable Component for Rendering Gear Set Icons
 * Handles set name parsing, icon URL generation, and chase detection
 */

import React from 'react';
import { getSetIconUrl } from '../../services/setAssets';

interface SetIconsGroupProps {
    setName: string;
    className?: string;
    iconClassName?: string;
}

/**
 * Renders a group of gear set icons from a set name string.
 * Automatically handles:
 * - Splitting set names by ' / ' delimiter
 * - Trimming whitespace from each set part
 * - Chase detection (applies 'no-scale' class to chase sets)
 * 
 * @example
 * // Renders 2 icons for "Speed / Crit"
 * <SetIconsGroup setName="Speed / Crit" />
 * 
 * @example
 * // With custom classes
 * <SetIconsGroup setName="Rage / Immunity" className="badge-set-icons" iconClassName="badge-set-icon" />
 */
export const SetIconsGroup: React.FC<SetIconsGroupProps> = ({
    setName,
    className = '',
    iconClassName = 'set-legend-icon'
}) => {
    return (
        <div className={`set-icons-group ${className}`.trim()}>
            {setName.split(' / ').map((setPart: string) => {
                const cleanPart = setPart.trim();
                const isNoScale = cleanPart.toLowerCase() === 'chase' || cleanPart.toLowerCase() === 'set_chase' || cleanPart.toLowerCase() === 'opener';
                return (
                    <img
                        key={cleanPart}
                        src={getSetIconUrl(cleanPart)}
                        alt={cleanPart}
                        className={`${iconClassName} ${isNoScale ? 'no-scale' : ''}`}
                    />
                );
            })}
        </div>
    );
};
