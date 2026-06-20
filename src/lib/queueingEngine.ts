// M/M/c Queueing Model implementation in TypeScript

const factorial = (n: number): number => {
  if (n === 0 || n === 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
};

export interface QueueMetrics {
  wq: number;
  lq: number;
  rho: number;
  p0: number;
  isStable: boolean;
}

export const calculateMMc = (lam: number, mu: number, c: number): QueueMetrics => {
  if (mu === 0 || c === 0) {
    return { wq: Infinity, lq: Infinity, rho: 0, p0: 0, isStable: false };
  }

  const rho = lam / (c * mu);
  
  // System is unstable (demand > capacity)
  if (rho >= 1) {
    return { wq: Infinity, lq: Infinity, rho, p0: 0, isStable: false };
  }

  // Calculate P0 (probability of 0 transactions in system)
  let sumP0 = 0;
  for (let n = 0; n < c; n++) {
    sumP0 += Math.pow(lam / mu, n) / factorial(n);
  }
  
  const lastTerm = Math.pow(lam / mu, c) / (factorial(c) * (1 - rho));
  const p0 = 1 / (sumP0 + lastTerm);

  // Calculate Lq (average length of queue)
  const lq = (p0 * Math.pow(lam / mu, c) * rho) / (factorial(c) * Math.pow(1 - rho, 2));

  // Calculate Wq (average waiting time in queue)
  const wq = lam > 0 ? lq / lam : 0;

  return { wq, lq, rho, p0, isStable: true };
};

// Data Generator: Generate 24-hour cycle of traffic (1440 minutes)
export interface TrafficDataPoint {
  time: string;
  minute: number;
  arrivalRate: number; // lambda
  phase: string;
}

export const generateTrafficData = (): TrafficDataPoint[] => {
  const data: TrafficDataPoint[] = [];
  
  for (let min = 0; min < 1440; min++) {
    const hours = Math.floor(min / 60);
    const minutes = min % 60;
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    
    let baseLam = 0;
    let phase = "";
    
    if (min < 360) {
      // 00:00 - 06:00: Off-Peak Hours
      baseLam = 15;
      phase = "Off-Peak";
    } else if (min < 660) {
      // 06:00 - 11:00: Normal Traffic
      baseLam = 40;
      phase = "Normal";
    } else if (min < 840) {
      // 11:00 - 14:00: Lunch Rush
      baseLam = 90;
      phase = "Lunch Rush";
    } else if (min < 1080) {
      // 14:00 - 18:00: Normal Traffic
      baseLam = 50;
      phase = "Normal";
    } else if (min < 1260) {
      // 18:00 - 21:00: Payday Congestion Surge
      const surgeProgress = (min - 1080) / 180; // 0 to 1
      baseLam = 50 + 110 * Math.sin(surgeProgress * Math.PI);
      phase = "Payday Surge";
    } else {
      // 21:00 - 24:00: Evening Decline
      const declineProgress = (min - 1260) / 180;
      baseLam = 50 - 35 * declineProgress;
      phase = "Evening Decline";
    }
    
    // Add noise
    let u1 = Math.random();
    let u2 = Math.random();
    while(u1 === 0) u1 = Math.random();
    let z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    
    let lam = baseLam + (z0 * (baseLam * 0.15)); // 15% noise std dev
    lam = Math.max(0.1, lam); // floor at 0.1
    
    data.push({
      time: timeStr,
      minute: min,
      arrivalRate: lam,
      phase
    });
  }
  
  return data;
};
