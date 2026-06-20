"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  ReferenceArea, Brush 
} from 'recharts';
import { Settings, AlertTriangle, CheckCircle2, Activity, Zap } from 'lucide-react';
import { calculateMMc, generateTrafficData, TrafficDataPoint } from '@/lib/queueingEngine';

export default function Dashboard() {
  const [mu, setMu] = useState<number>(20);
  const [c, setC] = useState<number>(10);
  const [trafficData, setTrafficData] = useState<TrafficDataPoint[]>([]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setTrafficData(generateTrafficData());
  }, []);

  const { chartData, aggMetrics } = useMemo(() => {
    if (!trafficData.length) return { chartData: [], aggMetrics: null };

    let totalWq = 0;
    let maxWq = 0;
    let totalRho = 0;
    let crashes = 0;

    const computed = trafficData.map(point => {
      const metrics = calculateMMc(point.arrivalRate, mu, c);
      const displayWq = metrics.isStable ? metrics.wq : 3; // Visual cap
      
      if (!metrics.isStable) crashes++;
      else {
        totalWq += metrics.wq;
        maxWq = Math.max(maxWq, metrics.wq);
      }
      totalRho += metrics.rho;

      return {
        ...point,
        wq: displayWq,
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
        isStable: crashes === 0,
        crashes
      }
    };
  }, [trafficData, mu, c]);

  if (!isClient) return null;

  const formatTimeTick = (minute: number) => {
    const hours = Math.floor(minute / 60);
    const mins = minute % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      // Dynamic logic to strictly match Paper Sections 8 & 9 findings
      // Liquidity Risk / Idling Costs: HIGH when capital is unutilized (low rho)
      const getLiquidityRisk = (rho: number, isStable: boolean) => !isStable ? "MINIMAL" : (rho <= 0.25 ? "HIGH" : (rho <= 0.7 ? "MODERATE" : "LOW"));
      const getIdlingCosts = (rho: number, isStable: boolean) => !isStable ? "MINIMAL" : (rho <= 0.25 ? "HIGH" : (rho <= 0.7 ? "MODERATE" : "LOW"));

      // Slippage Risk / Tx Latency: HIGH when wait times (wq) are high or system crashes
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
          onClick={() => setTrafficData(generateTrafficData())}
          className="px-4 py-1.5 bg-[#1C1C1C] hover:bg-[#2A2A2A] text-[#FFDD00] border border-[#FFDD00] uppercase font-mono text-xs tracking-wider transition-all shadow-[0_0_10px_rgba(255,221,0,0.2)] hover:shadow-[0_0_20px_rgba(255,221,0,0.5)] flex items-center gap-2"
        >
          <Activity size={14} /> Re-Initialize Protocol
        </button>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">
        
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
              <div className="flex flex-col gap-3 font-mono">
                <div className="bg-[#0A0A0A] p-3 border border-[#1C1C1C]">
                  <p className="text-[10px] text-[#888888] uppercase tracking-wider mb-1">Mean Latency [Wq]</p>
                  <p className="text-lg text-[#FFFFFF]">
                    {aggMetrics.isStable ? `${aggMetrics.avgWq.toFixed(2)}s` : 'INFINITE'}
                  </p>
                </div>
                
                <div className="bg-[#0A0A0A] p-3 border border-[#1C1C1C]">
                  <p className="text-[10px] text-[#888888] uppercase tracking-wider mb-1">Peak Utilization [ρ]</p>
                  <p className="text-lg text-[#FFFFFF]">
                    {(aggMetrics.avgRho * 100).toFixed(2)}%
                  </p>
                </div>

                <div className={`mt-1 p-3 border ${aggMetrics.isStable ? 'bg-[#000000] border-[#00FF41] shadow-[0_0_10px_rgba(0,255,65,0.2)]' : 'bg-red-950/40 border-red-500'}`}>
                  <p className="text-[10px] opacity-70 uppercase tracking-widest mb-1">Network State</p>
                  <div className="flex items-center gap-2">
                    {aggMetrics.isStable ? <CheckCircle2 size={16} className="text-[#00FF41]" /> : <AlertTriangle size={16} className="text-red-500" />}
                    <span className={`text-base font-bold tracking-wider ${aggMetrics.isStable ? 'text-[#00FF41]' : 'text-red-500'}`}>
                      {aggMetrics.isStable ? 'OPTIMAL' : 'CRITICAL FAILURE'}
                    </span>
                  </div>
                </div>
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
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="1 4" stroke="#333333" vertical={false} />
                
                {/* Partitions with strict palette */}
                <ReferenceArea x1={0} x2={360} fill="#FFFFFF" fillOpacity={0.03} /> {/* Off-Peak */}
                <ReferenceArea x1={660} x2={840} fill="#FFFFFF" fillOpacity={0.08} /> {/* Lunch */}
                <ReferenceArea x1={1080} x2={1260} fill="#FFDD00" fillOpacity={0.15} /> {/* Payday */}
                
                <XAxis 
                  dataKey="minute" 
                  tickFormatter={formatTimeTick} 
                  stroke="#555555" 
                  minTickGap={50}
                  tick={{fontFamily: 'monospace', fontSize: 10, fill: '#888888'}}
                  axisLine={{stroke: '#333333'}}
                />
                <YAxis 
                  stroke="#555555" 
                  tick={{fontFamily: 'monospace', fontSize: 10, fill: '#888888'}}
                  axisLine={{stroke: '#333333'}}
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
                />

                {/* Red line for instability indicator */}
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
                  tick={{fontFamily: 'monospace', fontSize: 9, fill: '#888888'}}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
