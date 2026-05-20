import React from 'react';
import { createPortal } from 'react-dom';

interface CustomDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    type: 'alert' | 'confirm';
    onClose: (confirmed: boolean) => void;
}

export const CustomDialog: React.FC<CustomDialogProps> = ({
    isOpen,
    title,
    message,
    type,
    onClose
}) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="custom-sandbox-dialog-overlay">
            <div className="dialog-overlay-backdrop" onClick={() => onClose(false)}></div>
            <div className="custom-sandbox-dialog-card calc-card">
                <div className="dialog-header">
                    <span className="dialog-title-accent"></span>
                    <h4>{title}</h4>
                </div>
                <div className="dialog-body">
                    <p>{message}</p>
                </div>
                <div className="dialog-actions">
                    {type === 'confirm' && (
                        <button className="dialog-btn cancel" onClick={() => onClose(false)}>
                            Cancel
                        </button>
                    )}
                    <button className="dialog-btn confirm" onClick={() => onClose(true)}>
                        OK
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
