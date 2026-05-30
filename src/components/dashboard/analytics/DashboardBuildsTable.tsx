import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    useReactTable,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    flexRender,
    ColumnDef,
    SortingState
} from '@tanstack/react-table';
import { BuildAssist, ProcessedBuildData, BuildData } from '../../../services/buildAssist';
import { getSetIconUrl } from '../../../services/setAssets';

interface DashboardBuildsTableProps {
    localBuildData: ProcessedBuildData | null;
}

export const DashboardBuildsTable: React.FC<DashboardBuildsTableProps> = React.memo(({
    localBuildData
}) => {
    const { t } = useTranslation();

    const rawBuilds = localBuildData?.rawBuilds || [];

    // Extract unique sets
    const uniqueSets = useMemo(() => {
        const sets = ['All'];
        rawBuilds.forEach(b => {
            Object.keys(b.sets || {}).forEach(k => {
                const cleanSet = k.replace('set_', '');
                if (cleanSet && !sets.includes(cleanSet)) {
                    sets.push(cleanSet);
                }
            });
        });
        return sets;
    }, [rawBuilds]);

    const allArtifacts = useMemo(() => BuildAssist.getArtifactList(), []);

    // Filter and search states
    const [selectedSet, setSelectedSet] = useState('All');
    const [artSearch, setArtSearch] = useState('');
    const [isArtDropdownOpen, setIsArtDropdownOpen] = useState(false);
    const [sorting, setSorting] = useState<SortingState>([
        { id: 'gs', desc: true } // Default sort by GS descending
    ]);

    const artDropdownRef = useRef<HTMLDivElement>(null);

    // Handle clicks outside of art dropdown
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (artDropdownRef.current && !artDropdownRef.current.contains(e.target as Node)) {
                setIsArtDropdownOpen(false);
            }
        };
        
        // Only add listener if dropdown is open to avoid unnecessary event handling
        if (isArtDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isArtDropdownOpen]);

    // Filter builds
    const filteredBuilds = useMemo(() => {
        return rawBuilds.filter(b => {
            if (selectedSet !== 'All') {
                const hasSet = Object.keys(b.sets || {}).some(k => k.replace('set_', '') === selectedSet);
                if (!hasSet) return false;
            }

            if (artSearch.trim() !== '') {
                const artName = BuildAssist.getArtifactName(b.artifactCode) || '';
                const searchLower = artSearch.toLowerCase();
                const matchesCode = b.artifactCode?.toLowerCase().includes(searchLower);
                const matchesName = artName.toLowerCase().includes(searchLower);
                if (!matchesCode && !matchesName) return false;
            }

            return true;
        });
    }, [rawBuilds, selectedSet, artSearch]);

    const filteredArtifacts = useMemo(() => {
        if (!artSearch.trim()) return [];
        return allArtifacts.filter(a => a.toLowerCase().includes(artSearch.toLowerCase()));
    }, [allArtifacts, artSearch]);



    // ── TanStack Columns ──
    const columns = useMemo<ColumnDef<BuildData>[]>(
        () => [
            {
                id: 'sets',
                header: t('heroDetails.filterBySet'),
                accessorFn: (row) => Object.keys(row.sets || {}).join(','),
                cell: (info) => {
                    const row = info.row.original;
                    return (
                        <div className="table-sets-cell">
                            {Object.keys(row.sets || {}).map((setKey) => {
                                const cleanSet = setKey.replace('set_', '');
                                return (
                                    <div key={setKey} className="table-set-badge">
                                        <img
                                            src={getSetIconUrl(cleanSet)}
                                            alt={cleanSet}
                                            className="table-set-icon"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    );
                },
                enableSorting: false,
            },
            {
                id: 'artifact',
                header: t('heroDetails.filterByArtifact'),
                accessorFn: (row) => BuildAssist.getArtifactName(row.artifactCode) || row.artifactCode || 'None',
                cell: (info) => (
                    <span className="table-artifact-cell" title={String(info.getValue())}>
                        {String(info.getValue())}
                    </span>
                ),
            },
            {
                accessorKey: 'atk',
                header: t('chart.statAttack'),
                cell: (info) => Math.round(Number(info.getValue())).toLocaleString(),
            },
            {
                accessorKey: 'def',
                header: t('chart.statDefense'),
                cell: (info) => Math.round(Number(info.getValue())).toLocaleString(),
            },
            {
                accessorKey: 'hp',
                header: t('chart.statHealth'),
                cell: (info) => Math.round(Number(info.getValue())).toLocaleString(),
            },
            {
                accessorKey: 'spd',
                header: t('chart.statSpeed'),
                cell: (info) => (
                    <span className="table-stat-cell highlight">
                        {Math.round(Number(info.getValue()))}
                    </span>
                ),
            },
            {
                accessorKey: 'chc',
                header: t('combat.critPct'),
                cell: (info) => `${Number(info.getValue()).toFixed(0)}%`,
            },
            {
                accessorKey: 'chd',
                header: t('combat.cDmg'),
                cell: (info) => `${Number(info.getValue()).toFixed(0)}%`,
            },
            {
                accessorKey: 'eff',
                header: t('combat.eff'),
                cell: (info) => `${Number(info.getValue()).toFixed(0)}%`,
            },
            {
                accessorKey: 'efr',
                header: t('combat.er'),
                cell: (info) => `${Number(info.getValue()).toFixed(0)}%`,
            },
            {
                accessorKey: 'gs',
                header: 'GS',
                cell: (info) => (
                    <span className="table-gs-cell">
                        {Math.round(Number(info.getValue() || 0))}
                    </span>
                ),
            },
            {
                accessorKey: 'createDate',
                header: t('heroDetails.sortDate'),
                cell: (info) => {
                    const val = info.getValue() as string | undefined;
                    return val ? (
                        <span className="table-date-cell">
                            {new Date(val).toLocaleDateString()}
                        </span>
                    ) : '-';
                },
            },
        ],
        [t]
    );

    const table = useReactTable({
        data: filteredBuilds,
        columns,
        state: {
            sorting,
        },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: {
            pagination: {
                pageSize: 10,
            }
        }
    });

    return (
        <div className="dashboard-card details-bottom-table-panel">
            <div className="panel-table-header">
                <h3 className="panel-table-title">{t('heroDetails.buildDetails')}</h3>

                <div className="filters-bar-unified">
                    <div className="filter-group">
                        <span className="filter-label">{t('heroDetails.filterBySet')}:</span>
                        <select
                            className="filter-select"
                            value={selectedSet}
                            onChange={(e) => setSelectedSet(e.target.value)}
                        >
                            {uniqueSets.map(set => (
                                <option key={set} value={set}>{set}</option>
                            ))}
                        </select>
                    </div>

                    <div className="filter-group" ref={artDropdownRef}>
                        <span className="filter-label">{t('heroDetails.filterByArtifact')}:</span>
                        <div className="art-search-wrapper">
                            <input
                                type="text"
                                className="art-search-input"
                                placeholder="Search artifact..."
                                value={artSearch}
                                onChange={(e) => {
                                    setArtSearch(e.target.value);
                                    setIsArtDropdownOpen(true);
                                }}
                                onFocus={() => setIsArtDropdownOpen(true)}
                            />
                            {artSearch && (
                                <button className="clear-search-btn" onClick={() => setArtSearch('')}>
                                    ✕
                                </button>
                            )}
                            {isArtDropdownOpen && filteredArtifacts.length > 0 && (
                                <div className="hero-dropdown-list art-dropdown-list">
                                    {filteredArtifacts.slice(0, 10).map(art => (
                                        <div
                                            key={art}
                                            className="hero-dropdown-item art-dropdown-item"
                                            onClick={() => {
                                                setArtSearch(art);
                                                setIsArtDropdownOpen(false);
                                            }}
                                        >
                                            {art}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="builds-table-container">
                <div className="builds-table-wrapper">
                    <table className="builds-table">
                        <thead>
                            {table.getHeaderGroups().map(headerGroup => (
                                <tr key={headerGroup.id}>
                                    {headerGroup.headers.map(header => (
                                        <th key={header.id} colSpan={header.colSpan}>
                                            {header.isPlaceholder ? null : (
                                                <div
                                                    {...{
                                                        className: header.column.getCanSort() ? 'cursor-pointer select-none' : '',
                                                        onClick: header.column.getToggleSortingHandler(),
                                                    }}
                                                >
                                                    {flexRender(header.column.columnDef.header, header.getContext())}
                                                    {{
                                                        asc: ' 🔼',
                                                        desc: ' 🔽',
                                                    }[header.column.getIsSorted() as string] ?? null}
                                                </div>
                                            )}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody>
                            {table.getRowModel().rows.length > 0 ? (
                                table.getRowModel().rows.map(row => (
                                    <tr key={row.id}>
                                        {row.getVisibleCells().map(cell => (
                                            <td key={cell.id}>
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={columns.length} style={{ textAlign: 'center', padding: '24px' }}>
                                        {t('heroDetails.noBuildsFound') || 'No builds stashed match criteria.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="table-pagination-controls-unified">
                    <button
                        className="pagination-btn-unified"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        ◀ Prev
                    </button>
                    <span className="pagination-info-text-unified">
                        Page <strong>{table.getState().pagination.pageIndex + 1}</strong> of{' '}
                        <strong>{table.getPageCount()}</strong>
                    </span>
                    <button
                        className="pagination-btn-unified"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        Next ▶
                    </button>
                </div>
            </div>
        </div>
    );
});
