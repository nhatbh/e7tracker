import React, { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

export const LogsView: React.FC = () => {
    const [logs, setLogs] = useState<string[]>([]);
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
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

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
            <h3 style={{ margin: '0 0 16px 0', color: '#fff', borderBottom: '1px solid #333', paddingBottom: '8px' }}>Rust Backend Logs</h3>
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
