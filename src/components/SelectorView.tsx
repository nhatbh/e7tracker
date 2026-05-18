import React from 'react';
import { useTranslation } from 'react-i18next';

interface SelectorViewProps {
    containerRef: React.RefObject<HTMLDivElement | null>;
    currentRect: { x: number; y: number; w: number; h: number };
    handleMouseDown: (e: React.MouseEvent) => void;
    handleMouseMove: (e: React.MouseEvent) => void;
    handleMouseUp: () => Promise<void>;
}

export const SelectorView: React.FC<SelectorViewProps> = ({
    containerRef,
    currentRect,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp
}) => {
    const { t } = useTranslation();

    return (
        <main
            className="selector-view"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            ref={containerRef}
        >
            <div className="selection-guide">
                <span className="selection-guide-dot"></span>
                {t('selector.guide')}
            </div>

            {(currentRect.w > 0 || currentRect.h > 0) && (
                <div
                    className="selection-rect"
                    style={{
                        left: currentRect.x,
                        top: currentRect.y,
                        width: currentRect.w,
                        height: currentRect.h,
                    }}
                >
                    <div className="selection-label">
                        x: {((currentRect.x / (containerRef.current?.clientWidth || 1)) * 100).toFixed(1)}%
                        {" "}y: {((currentRect.y / (containerRef.current?.clientHeight || 1)) * 100).toFixed(1)}%
                        {" "}w: {((currentRect.w / (containerRef.current?.clientWidth || 1)) * 100).toFixed(1)}%
                        {" "}h: {((currentRect.h / (containerRef.current?.clientHeight || 1)) * 100).toFixed(1)}%
                    </div>
                </div>
            )}
        </main>
    );
};
