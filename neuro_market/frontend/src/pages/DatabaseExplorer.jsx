import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  Database, 
  Table as TableIcon, 
  Search, 
  ChevronRight, 
  ChevronLeft, 
  ArrowUpDown, 
  Layers, 
  Info,
  ExternalLink,
  RefreshCcw,
  List as ListIcon
} from 'lucide-react';

const DatabaseExplorer = () => {
  const [schema, setSchema] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableData, setTableData] = useState({ rows: [], total_count: 0, columns: [] });
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc');
  const [view, setView] = useState('data'); // 'data' | 'structure' | 'relationships'

  const fetchSchema = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await axios.get('/admin/db/schema');
      setSchema(resp.data);
      if (resp.data.length > 0 && !selectedTable) {
        setSelectedTable(resp.data[0].table_name);
      }
    } catch (err) {
      console.error('Failed to fetch DB schema:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedTable]);

  const fetchTableData = useCallback(async (isSearch = false) => {
    setDataLoading(true);
    if (isSearch) setPage(1);
    try {
      const resp = await axios.get(`/admin/db/table/${selectedTable}/data`, {
        params: {
          page: isSearch ? 1 : page,
          page_size: pageSize,
          search: search || undefined,
          sort_by: sortBy || undefined,
          sort_order: sortOrder
        }
      });
      setTableData(resp.data);
    } catch (err) {
      console.error('Failed to fetch table data:', err);
    } finally {
      setDataLoading(false);
    }
  }, [page, pageSize, search, selectedTable, sortBy, sortOrder]);

  useEffect(() => {
    fetchSchema();
  }, [fetchSchema]);

  useEffect(() => {
    if (selectedTable) fetchTableData();
  }, [fetchTableData, selectedTable]);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const currentTableSchema = schema.find(t => t.table_name === selectedTable);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-160px)] gap-6 bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
      {/* Sidebar */}
      <div className="w-64 border-r border-slate-800 bg-slate-900/50 flex flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-500">
            <Database size={18} />
            <h2 className="font-black uppercase tracking-tight text-sm">Tables</h2>
          </div>
          <button onClick={fetchSchema} className="text-slate-500 hover:text-white transition-colors">
            <RefreshCcw size={14} />
          </button>
        </div>
        <div className="flex-grow overflow-y-auto p-2 space-y-1">
          {schema.map(table => (
            <button
              key={table.table_name}
              onClick={() => {
                setSelectedTable(table.table_name);
                setPage(1);
                setSearch('');
                setSortBy(null);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                selectedTable === table.table_name 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <TableIcon size={14} />
                <span className="truncate">{table.table_name}</span>
              </div>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                selectedTable === table.table_name ? 'bg-blue-500/50' : 'bg-slate-800'
              }`}>
                {table.row_count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-grow flex flex-col min-w-0 bg-slate-950">
        {selectedTable && currentTableSchema ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black text-white flex items-center gap-3">
                  {selectedTable}
                  <span className="text-xs font-normal text-slate-500 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                    {currentTableSchema.row_count} rows
                  </span>
                </h1>
              </div>

              <div className="flex items-center bg-slate-900 rounded-xl p-1 border border-slate-800">
                <button 
                  onClick={() => setView('data')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                    view === 'data' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Data
                </button>
                <button 
                  onClick={() => setView('structure')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                    view === 'structure' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Structure
                </button>
                <button 
                  onClick={() => setView('relationships')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                    view === 'relationships' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Relationships
                </button>
              </div>
            </div>

            {/* Toolbar */}
            {view === 'data' && (
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-900/20">
                <form 
                  onSubmit={(e) => { e.preventDefault(); fetchTableData(true); }}
                  className="relative flex-grow max-w-md group"
                >
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500" size={16} />
                  <input 
                    type="text"
                    placeholder={`Search in ${selectedTable}...`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all"
                  />
                </form>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-mono">
                    Page {page} of {Math.ceil(tableData.total_count / pageSize) || 1}
                  </span>
                  <div className="flex items-center bg-slate-900 rounded-lg border border-slate-800">
                    <button 
                      disabled={page === 1 || dataLoading}
                      onClick={() => setPage(p => p - 1)}
                      className="p-2 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <div className="w-px h-4 bg-slate-800"></div>
                    <button 
                      disabled={page >= Math.ceil(tableData.total_count / pageSize) || dataLoading}
                      onClick={() => setPage(p => p + 1)}
                      className="p-2 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Content Area */}
            <div className="flex-grow overflow-auto relative bg-slate-950">
              {dataLoading && (
                <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              )}

              {view === 'data' ? (
                <table className="w-full text-left border-collapse min-w-max">
                  <thead className="sticky top-0 z-20 bg-slate-900 shadow-sm">
                    <tr>
                      {tableData.columns.map(col => (
                        <th 
                          key={col}
                          onClick={() => handleSort(col)}
                          className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-800 cursor-pointer hover:bg-slate-800 transition-colors group"
                        >
                          <div className="flex items-center gap-2">
                            {col}
                            <ArrowUpDown size={12} className={`transition-colors ${sortBy === col ? 'text-blue-500' : 'text-slate-700 group-hover:text-slate-500'}`} />
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {tableData.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-900/40 transition-colors">
                        {tableData.columns.map(col => (
                          <td key={col} className="px-4 py-3 text-sm font-mono text-slate-300">
                            {row[col] === null ? (
                              <span className="text-slate-600 italic">null</span>
                            ) : typeof row[col] === 'boolean' ? (
                              <span className={row[col] ? 'text-emerald-500' : 'text-rose-500'}>
                                {row[col].toString()}
                              </span>
                            ) : (
                              row[col].toString()
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {tableData.rows.length === 0 && !dataLoading && (
                      <tr>
                        <td colSpan={tableData.columns.length} className="px-4 py-20 text-center text-slate-500">
                          <div className="flex flex-col items-center gap-2">
                            <Info size={32} />
                            <p>No data found in this table</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : view === 'structure' ? (
                <div className="p-6 space-y-8 max-w-4xl mx-auto">
                  <div className="card bg-slate-900/50 border-slate-800 p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <ListIcon size={18} className="text-blue-500" />
                      Columns & Types
                    </h3>
                    <div className="overflow-hidden rounded-xl border border-slate-800">
                      <table className="w-full text-left">
                        <thead className="bg-slate-800/50">
                          <tr>
                            <th className="px-4 py-2 text-[10px] font-black uppercase text-slate-500">Name</th>
                            <th className="px-4 py-2 text-[10px] font-black uppercase text-slate-500">Type</th>
                            <th className="px-4 py-2 text-[10px] font-black uppercase text-slate-500">Nullable</th>
                            <th className="px-4 py-2 text-[10px] font-black uppercase text-slate-500">Key</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {currentTableSchema.columns.map(col => (
                            <tr key={col.name} className="text-sm">
                              <td className="px-4 py-3 font-bold text-white">{col.name}</td>
                              <td className="px-4 py-3 font-mono text-blue-400">{col.type}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${col.nullable ? 'bg-slate-800 text-slate-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                  {col.nullable ? 'YES' : 'NO'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {col.primary_key && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                    PK
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 space-y-8 max-w-4xl mx-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Incoming */}
                    <div className="card bg-slate-900/50 border-slate-800 p-6">
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Layers size={18} className="text-emerald-500" />
                        Foreign Keys
                      </h3>
                      <div className="space-y-3">
                        {currentTableSchema.foreign_keys.map((fk, i) => (
                          <div key={i} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between group">
                            <div>
                              <p className="text-[10px] font-black text-slate-500 uppercase">Points to</p>
                              <p className="font-bold text-white group-hover:text-blue-400 transition-colors flex items-center gap-1">
                                {fk.referred_table}
                                <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                              </p>
                              <p className="text-xs font-mono text-slate-400">
                                {fk.constrained_columns[0]} → {fk.referred_columns[0]}
                              </p>
                            </div>
                            <button 
                              onClick={() => setSelectedTable(fk.referred_table)}
                              className="p-2 rounded-lg bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                            >
                              <ChevronRight size={16} />
                            </button>
                          </div>
                        ))}
                        {currentTableSchema.foreign_keys.length === 0 && (
                          <p className="text-sm text-slate-500 italic">No foreign keys defined</p>
                        )}
                      </div>
                    </div>

                    {/* Related Tables */}
                    <div className="card bg-slate-900/50 border-slate-800 p-6">
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <ExternalLink size={18} className="text-blue-500" />
                        Referenced By
                      </h3>
                      <div className="space-y-3">
                        {schema.filter(t => t.foreign_keys.some(fk => fk.referred_table === selectedTable)).map((t, i) => (
                          <div key={i} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between group">
                            <div>
                              <p className="text-[10px] font-black text-slate-500 uppercase">Referenced by</p>
                              <p className="font-bold text-white group-hover:text-blue-400 transition-colors">
                                {t.table_name}
                              </p>
                              <p className="text-xs font-mono text-slate-400">
                                {t.foreign_keys.find(fk => fk.referred_table === selectedTable).constrained_columns[0]} → {t.foreign_keys.find(fk => fk.referred_table === selectedTable).referred_columns[0]}
                              </p>
                            </div>
                            <button 
                              onClick={() => setSelectedTable(t.table_name)}
                              className="p-2 rounded-lg bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                            >
                              <ChevronRight size={16} />
                            </button>
                          </div>
                        ))}
                        {schema.filter(t => t.foreign_keys.some(fk => fk.referred_table === selectedTable)).length === 0 && (
                          <p className="text-sm text-slate-500 italic">No tables reference this table</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-grow flex items-center justify-center text-slate-500">
            <div className="text-center">
              <Database size={48} className="mx-auto mb-4 opacity-20" />
              <p>Select a table to begin exploring</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DatabaseExplorer;
