import React, { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

export const LogsView: React.FC = () => {
    const [logs, setLogs] = useState<string[]>([]);
    const [autoscroll, setAutoscroll] = useState(true);
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const fetchedLogs = await invoke<string[]>('get_rust_logs');
                setLogs(fetchedLogs);
            } catch (e) {
                console.error(e);
            }
        };

        // Fetch immediately, then poll
        fetchLogs();
        const interval = setInterval(fetchLogs, 500);

        return () => clearInterval(interval);
    }, []);

    // Auto-scroll to bottom on new logs
    useEffect(() => {
        if (autoscroll) {
            endRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, autoscroll]);

    return (
        <main style={{
            background: '#0a0a0f',
            color: '#00ffcc',
            fontFamily: 'Consolas, monospace',
            padding: '16px',
            height: '100vh',
            overflowY: 'auto',
            fontSize: '12px',
            lineHeight: '1.5',
            boxSizing: 'border-box'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 16px 0', borderBottom: '1px solid #333', paddingBottom: '8px' }}>
                <h3 style={{ margin: 0, color: '#fff' }}>Rust Backend Logs</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', userSelect: 'none' }}>
                        Autoscroll
                    </span>
                    <label style={{
                        position: 'relative',
                        display: 'inline-block',
                        width: '28px',
                        height: '16px',
                        cursor: 'pointer'
                    }}>
                        <input 
                            type="checkbox" 
                            checked={autoscroll}
                            onChange={(e) => setAutoscroll(e.target.checked)}
                            style={{ opacity: 0, width: 0, height: 0 }}
                        />
                        <span style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: autoscroll ? '#00ffcc' : 'rgba(255,255,255,0.15)',
                            transition: '0.2s',
                            borderRadius: '16px',
                            boxShadow: autoscroll ? '0 0 6px rgba(0, 255, 204, 0.3)' : 'none'
                        }}>
                            <span style={{
                                position: 'absolute',
                                height: '10px',
                                width: '10px',
                                left: '3px',
                                bottom: '3px',
                                backgroundColor: '#fff',
                                transition: '0.2s',
                                borderRadius: '50%',
                                transform: autoscroll ? 'translateX(12px)' : 'translateX(0)'
                            }}></span>
                        </span>
                    </label>
                </div>
            </div>
            {logs.length === 0 ? (
                <div style={{ color: '#888' }}>Waiting for logs...</div>
            ) : (
                logs.map((log, i) => {
                    const isError = log.includes('[ERROR]') || log.includes('Error') || log.includes('Warning');
                    const isInfo = log.includes('[INFO]') || log.includes('Loaded');
                    
                    let color = '#00ffcc';
                    if (isError) color = '#ff4757';
                    else if (isInfo) color = '#2ed573';
                    
                    return (
                        <div key={i} style={{ 
                            padding: '2px 0',
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            wordBreak: 'break-all',
                            color: color
                        }}>
                            {log}
                        </div>
                    );
                })
            )}
            <div ref={endRef} />
        </main>
    );
};
