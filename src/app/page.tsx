"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  ReferenceArea, Brush, Legend, ReferenceLine
} from 'recharts';
import { Settings, AlertTriangle, CheckCircle2, Activity, Zap, Database, X } from 'lucide-react';
import { calculateMMc, TrafficDataPoint } from '@/lib/queueingEngine';
import { STATIC_TRAFFIC_DATA } from '@/lib/staticTrafficData';

export default function Dashboard() {
  const [mu, setMu] = useState<number>(20);
  const [c, setC] = useState<number>(10);
  const [showDatasetModal, setShowDatasetModal] = useState(false);
  const [trafficData, setTrafficData] = useState<TrafficDataPoint[]>([]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setTrafficData(STATIC_TRAFFIC_DATA);
  }, []);

  const { chartData, aggMetrics } = useMemo(() => {
    if (!trafficData.length) return { chartData: [], aggMetrics: null };

    let totalWq = 0;
    let totalRho = 0;
    let crashes = 0;
    let maxWq = 0;
    let maxRho = 0; // Initialize tracking for peak utilization

    // Loop through the 1440-minute time-series data array
    const computed = trafficData.map(point => {
      // Calculate real-time instantaneous utilization and wait times based on state sliders
      const metrics = calculateMMc(point.arrivalRate, mu, c);
      const displayWq = metrics.isStable ? metrics.wq : null; // Use null for crashed periods so graph connects gaps
      
      if (!metrics.isStable) crashes++;
      else {
        totalWq += metrics.wq;
        maxWq = Math.max(maxWq, metrics.wq);
      }
      
      totalRho += metrics.rho;
      // Extract absolute highest peak percentage achieved
      maxRho = Math.max(maxRho, metrics.rho);

      return {
        ...point,
        wq: displayWq,
        lq: metrics.lq,
        serviceRate: mu,
        rho: metrics.rho,
        isStable: metrics.isStable,
        arrivalRate: Number(point.arrivalRate.toFixed(2))
      };
    });

    const stableCount = trafficData.length - crashes;
    return {
      chartData: computed,
      aggMetrics: {
        avgWq: stableCount > 0 ? totalWq / stableCount : Infinity,
        maxWq: crashes > 0 ? Infinity : maxWq,
        avgRho: totalRho / trafficData.length,
        maxRho, // Set true maximum peak
        isStable: crashes === 0,
        crashes
      }
    };
  }, [trafficData, mu, c]); // Dependency array properly handles state updates

  if (!isClient) return null;

  const formatTimeTick = (minute: number) => {
    const hours = Math.floor(minute / 60);
    const mins = minute % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      const getLiquidityRisk = (rho: number, isStable: boolean) => !isStable ? "MINIMAL" : (rho <= 0.25 ? "HIGH" : (rho <= 0.7 ? "MODERATE" : "LOW"));
      const getIdlingCosts = (rho: number, isStable: boolean) => !isStable ? "MINIMAL" : (rho <= 0.25 ? "HIGH" : (rho <= 0.7 ? "MODERATE" : "LOW"));

      const getSlippageRisk = (wq: number, isStable: boolean) => !isStable ? "CRITICAL" : (wq >= 0.5 ? "HIGH" : (wq >= 0.05 ? "MODERATE" : "LOW"));
      const getLatencyStatus = (wq: number, isStable: boolean) => !isStable ? "INFINITE" : (wq >= 0.5 ? "HIGH" : (wq >= 0.05 ? "MODERATE" : "OPTIMAL"));

      const liqRisk = getLiquidityRisk(data.rho, data.isStable);
      const slipRisk = getSlippageRisk(data.wq, data.isStable);
      const latStatus = getLatencyStatus(data.wq, data.isStable);
      const idleCosts = getIdlingCosts(data.rho, data.isStable);

      const colorMap: Record<string, string> = {
        "LOW": "text-[#00FF41]",
        "OPTIMAL": "text-[#00FF41]",
        "MINIMAL": "text-[#00FF41]",
        "MODERATE": "text-[#FFDD00]",
        "HIGH": "text-red-500",
        "CRITICAL": "text-red-500 font-bold",
        "INFINITE": "text-red-500 font-bold",
      };

      return (
        <div className="bg-[#000000] border border-[#FFDD00] p-4 text-sm shadow-[0_0_15px_rgba(255,221,0,0.3)] min-w-[260px]">
          <p className="font-mono text-[#FFFFFF] font-bold mb-3 uppercase tracking-wider border-b border-[#333] pb-2">
            {data.time} // {data.phase}
          </p>
          
          <div className="space-y-1.5 font-mono text-xs">
            <p className="text-[#888888] flex justify-between">
              <span>LOAD [λ]:</span> <span className="text-[#FFDD00]">{data.arrivalRate.toFixed(2)} tx/s</span>
            </p>
            {data.isStable ? (
              <>
                <p className="text-[#888888] flex justify-between">
                  <span>LATENCY [Wq]:</span> <span className="text-[#FFDD00]">{data.wq.toFixed(2)}s</span>
                </p>
                <p className="text-[#888888] flex justify-between">
                  <span>UTILIZATION [ρ]:</span> <span className="text-[#FFDD00]">{(data.rho * 100).toFixed(2)}%</span>
                </p>
              </>
            ) : (
              <p className="text-red-500 font-bold flex items-center justify-center gap-2 py-1 my-1 border border-red-500 bg-red-950/40">
                <AlertTriangle size={12} /> SYSTEM OVERLOAD
              </p>
            )}
            
            <div className="border-t border-[#333] pt-3 mt-3 space-y-2">
              <p className="text-[#FFFFFF] flex justify-between items-center">
                <span>LIQUIDITY RISK:</span> <span className={colorMap[liqRisk]}>{liqRisk}</span>
              </p>
              <p className="text-[#FFFFFF] flex justify-between items-center">
                <span>SLIPPAGE RISK:</span> <span className={colorMap[slipRisk]}>{slipRisk}</span>
              </p>
              <p className="text-[#FFFFFF] flex justify-between items-center">
                <span>TX LATENCY:</span> <span className={colorMap[latStatus]}>{latStatus}</span>
              </p>
              <p className="text-[#FFFFFF] flex justify-between items-center">
                <span>IDLING COSTS:</span> <span className={colorMap[idleCosts]}>{idleCosts}</span>
              </p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-screen p-4 flex flex-col gap-4 selection:bg-[#FFDD00] selection:text-black overflow-hidden">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-b border-[#1C1C1C] pb-3 shrink-0">
        <div>
          <h1 className="text-lg md:text-xl font-bold uppercase tracking-wider text-[#FFFFFF] flex items-center gap-2">
            <Zap className="text-[#FFDD00]" size={24} />
            M/M/c Queueing Simulator: Liquidity Risk & Market Slippage Engine
          </h1>
          <p className="text-[#888888] mt-1 font-mono text-xs tracking-widest uppercase">M/M/c Slippage & Load Simulation</p>
        </div>
        <button 
          onClick={() => setTrafficData(STATIC_TRAFFIC_DATA)}
          className="px-4 py-1.5 bg-[#1C1C1C] hover:bg-[#2A2A2A] text-[#FFDD00] border border-[#FFDD00] uppercase font-mono text-xs tracking-wider transition-all shadow-[0_0_10px_rgba(255,221,0,0.2)] hover:shadow-[0_0_20px_rgba(255,221,0,0.5)] flex items-center gap-2"
        >
          <Activity size={14} /> Re-Initialize Protocol
        </button>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">
        
        {/* Left Col: Controls & Metrics */}
        <div className="flex flex-col gap-4 lg:col-span-1 overflow-y-auto custom-scrollbar pr-1 pb-1">
          {/* Control Panel */}
          <div className="tech-panel p-4">
            <h2 className="text-xs font-mono uppercase tracking-widest text-[#FFFFFF] mb-4 flex items-center gap-2 border-b border-[#333333] pb-2">
              <Settings size={14} className="text-[#FFDD00]" />
              Core Parameters
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="flex justify-between items-center text-xs font-mono text-[#888888] uppercase mb-2 tracking-wider">
                  <span>Active Nodes [c]</span>
                  <input 
                    type="number" 
                    min="1" max="100" 
                    value={c}
                    onChange={(e) => setC(Number(e.target.value))}
                    className="bg-transparent text-[#FFDD00] text-sm font-bold text-right w-16 outline-none border-b border-transparent focus:border-[#FFDD00] hover:border-[#333333] transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </label>
                <input 
                  type="range" min="1" max="30" step="1" value={c}
                  onChange={(e) => setC(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="flex justify-between items-center text-xs font-mono text-[#888888] uppercase mb-2 tracking-wider">
                  <span>Node Capacity [u]</span>
                  <div className="flex items-center">
                    <input 
                      type="number" 
                      min="1" max="200" 
                      value={mu}
                      onChange={(e) => setMu(Number(e.target.value))}
                      className="bg-transparent text-[#FFDD00] text-sm font-bold text-right w-16 outline-none border-b border-transparent focus:border-[#FFDD00] hover:border-[#333333] transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-[#FFDD00] text-sm font-bold ml-1">tx/s</span>
                  </div>
                </label>
                <input 
                  type="range" min="5" max="50" step="1" value={mu}
                  onChange={(e) => setMu(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="tech-panel p-4 flex-1 flex flex-col">
            <h2 className="text-xs font-mono uppercase tracking-widest text-[#FFFFFF] mb-3 flex items-center gap-2 border-b border-[#333333] pb-2">
              <Activity size={14} className="text-[#FFDD00]" />
              Telemetry
            </h2>
            {aggMetrics && (
              <div className="flex flex-col gap-2 font-mono">
                <div className="flex flex-col gap-2 text-[10px] sm:text-[11px] leading-relaxed">
                  {!aggMetrics.isStable ? (
                    <>
                      <div className="p-2.5 border border-red-500/50 bg-[#0A0A0A] text-red-500 font-bold">
                        CRITICAL WARNING: System unstable (ρ ≥ 1) for {aggMetrics.crashes} minutes!
                      </div>
                      <div className="p-2.5 border border-red-500/50 bg-[#0A0A0A] text-red-500">
                        The current liquidity channels ({c}) are insufficient for peak traffic. Infinite market slippage risk detected.
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={`p-2.5 border border-[#1C1C1C] bg-[#0A0A0A] ${aggMetrics.maxWq > 2.0 ? "text-[#FF8C00]" : "text-[#00FF41]"}`}>
                        Avg Wait Time (W_q): {aggMetrics.avgWq.toFixed(4)}s
                      </div>
                      <div className={`p-2.5 border border-[#1C1C1C] bg-[#0A0A0A] ${aggMetrics.maxWq > 2.0 ? "text-[#FF8C00]" : "text-[#00FF41]"}`}>
                        Max Peak Wait Time: {aggMetrics.maxWq.toFixed(4)}s
                      </div>
                      <div className={`p-2.5 border border-[#1C1C1C] bg-[#0A0A0A] ${aggMetrics.maxWq > 2.0 ? "text-[#FF8C00]" : "text-[#00FF41]"}`}>
                        Avg System Utilization (ρ): {(aggMetrics.avgRho * 100).toFixed(2)}%
                      </div>
                      <div className={`p-2.5 border border-[#1C1C1C] bg-[#0A0A0A] ${aggMetrics.maxWq > 2.0 ? "text-[#FF8C00]" : "text-[#00FF41]"}`}>
                        {aggMetrics.maxWq > 2.0 ? "Warning: High Market Slippage Risk during peak surges." : "Stable: Wait times comfortably mitigating slippage risk."}
                      </div>
                    </>
                  )}
                </div>

                <button 
                  onClick={() => setShowDatasetModal(true)}
                  className="mt-2 mb-4 w-full py-2.5 border border-[#333333] hover:border-[#FFDD00] bg-[#000000] hover:bg-[#1C1C1C] transition-all text-[10px] font-mono text-[#FFFFFF] hover:text-[#FFDD00] uppercase tracking-widest flex items-center justify-center gap-2 shrink-0"
                >
                  <Database size={14} />
                  View Sample Dataset
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Interactive Chart */}
        <div className="tech-panel p-4 lg:col-span-3 flex flex-col h-full overflow-hidden">
          <div className="mb-3 flex justify-between items-end border-b border-[#333333] pb-2 shrink-0">
            <div>
              <h2 className="text-sm font-mono uppercase tracking-widest text-[#FFFFFF]">Slippage Exposure Vector</h2>
            </div>
            
            <div className="flex gap-3 text-[9px] font-mono uppercase tracking-widest text-[#888888]">
              <div className="flex items-center gap-1"><span className="w-2 h-2 border border-[#333]" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}></span> Off-Peak</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 bg-transparent border border-[#333]"></span> Normal</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}></span> Lunch</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2" style={{ backgroundColor: 'rgba(255,221,0,0.15)' }}></span> Payday</div>
            </div>
          </div>

          <div className="flex-1 w-full relative min-h-0">
            {/* Legend Overlay */}
            <div className="absolute top-4 right-4 bg-[#0A0A0A]/90 backdrop-blur-md border border-[#333333] p-3 z-10 font-mono text-[10px] uppercase tracking-wider shadow-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-4 h-[3px] rounded-full" style={{ backgroundColor: '#FFFFFF' }}></div>
                <span className="text-[#FFFFFF]">Queue Wait Time (Wq)</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-0 border-b-2 border-dashed border-red-500"></div>
                <span className="text-red-500">Critical Slippage Threshold (2s)</span>
              </div>
            </div>

            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="1 4" stroke="#333333" vertical={false} />
                
                <ReferenceArea x1={0} x2={360} fill="#FFFFFF" fillOpacity={0.03} /> 
                <ReferenceArea x1={660} x2={840} fill="#FFFFFF" fillOpacity={0.08} /> 
                <ReferenceArea x1={1080} x2={1260} fill="#FFDD00" fillOpacity={0.15} /> 
                <ReferenceLine y={2} stroke="#EF4444" strokeDasharray="4 4" strokeWidth={1} label={{ position: 'insideTopLeft', value: '2.0s', fill: '#EF4444', fontSize: 10, fontFamily: 'monospace' }} />
                
                <XAxis 
                  dataKey="minute" 
                  tickFormatter={formatTimeTick} 
                  stroke="#555555" 
                  ticks={[0, 360, 660, 840, 1080, 1260, 1439]}
                  tick={{fontFamily: 'monospace', fontSize: 10, fill: '#888888'}}
                  axisLine={{stroke: '#333333'}}
                  label={{ value: 'Time of Day (24H)', position: 'bottom', fill: '#888888', fontSize: 10, fontFamily: 'monospace' }}
                />
                <YAxis 
                  stroke="#555555" 
                  tick={{fontFamily: 'monospace', fontSize: 10, fill: '#888888'}}
                  axisLine={{stroke: '#333333'}}
                  domain={[0, 2.5]}
                  ticks={[0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5]}
                  tickFormatter={(val) => val.toFixed(2) + 's'}
                  allowDataOverflow={true}
                  label={{ value: 'Wait Time / Slippage Exposure (Seconds)', angle: -90, position: 'insideLeft', offset: 15, fill: '#888888', fontSize: 10, fontFamily: 'monospace', style: { textAnchor: 'middle' } }}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#FFDD00', strokeWidth: 1, strokeDasharray: '3 3' }} />
                
                <Line 
                  type="monotone" 
                  dataKey="wq" 
                  stroke="#FFFFFF" 
                  strokeWidth={1.5} 
                  dot={false}
                  activeDot={{ r: 4, fill: "#FFDD00", stroke: "#000", strokeWidth: 2 }}
                  isAnimationActive={false}
                  connectNulls={true}
                />

                <Line 
                  type="step" 
                  dataKey={(d) => d.isStable ? null : 3} 
                  stroke="#FF0000" 
                  strokeWidth={2} 
                  dot={false}
                  isAnimationActive={false}
                />

                <Brush 
                  dataKey="minute" 
                  height={24} 
                  stroke="#FFDD00" 
                  fill="#000000"
                  tickFormatter={formatTimeTick}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>

      {/* Dataset Modal */}
      {showDatasetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#000000]/80 backdrop-blur-sm p-4">
          <div className="bg-[#0A0A0A] border border-[#333333] w-full max-w-[95vw] max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center p-4 border-b border-[#333333]">
              <h3 className="text-sm font-mono text-[#FFFFFF] uppercase tracking-widest flex items-center gap-2">
                <Database size={16} className="text-[#FFDD00]" />
                Simulated Traffic Dataset (Snapshot)
              </h3>
              <button onClick={() => setShowDatasetModal(false)} className="text-[#888888] hover:text-[#FFFFFF] transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-0 overflow-auto custom-scrollbar flex-1 bg-[#000000]">
              <table className="w-full text-left text-sm font-mono text-[#CCCCCC] whitespace-nowrap">
                <thead className="sticky top-0 bg-[#1C1C1C] border-b border-[#333333] text-[#FFFFFF] shadow-md z-10">
                  <tr>
                    <th className="p-3 px-4 font-semibold border-r border-[#333333]">timestamp</th>
                    <th className="p-3 px-4 font-semibold border-r border-[#333333]">time_of_day</th>
                    <th className="p-3 px-4 font-semibold border-r border-[#333333]">scenario</th>
                    <th className="p-3 px-4 font-semibold">arrival_rate_lambda</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222222]">
                  {chartData.map((row, idx) => {
                    return (
                      <tr key={idx} className="hover:bg-[#111111] transition-colors">
                        <td className="p-3 px-4 text-[#888888] border-r border-[#222222]">2026-06-20 {row.time}:00</td>
                        <td className="p-3 px-4 text-[#888888] border-r border-[#222222]">{row.time}</td>
                        <td className="p-3 px-4 border-r border-[#222222]">{row.phase}</td>
                        <td className="p-3 px-4 text-[#FFDD00]">{row.arrivalRate}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-[#333333] text-xs text-center text-[#888888] font-mono uppercase tracking-wider">
              Showing all {chartData.length} generated traffic points
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
