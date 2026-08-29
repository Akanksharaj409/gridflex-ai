import React from 'react';
import {
  BatteryIcon,
  DemandIcon,
  GridIcon,
  SolarIcon,
  WindIcon,
  ZapIcon,
} from './icons';
import { fmt } from './ui';

/**
 * EnergyFlowVisual - Visual Topology Diagram
 * Displays real-time power flow between Solar/Wind -> Renewables -> Demand -> Battery & Grid
 */
export function EnergyFlowVisual({
  solarKw = 0,
  windKw = 0,
  renewableKw = 0,
  demandKw = 0,
  batteryChargeKw = 0,
  batteryDischargeKw = 0,
  gridImportKw = 0,
  batterySocPct = 0,
}) {
  const isBatteryDischarging = batteryDischargeKw > 1;
  const isBatteryCharging = batteryChargeKw > 1;

  return (
    <div className="card energy-flow-card">
      <div className="card-head">
        <div>
          <h3>
            <ZapIcon size={18} color="var(--accent-solar)" />
            Live Energy Flow Topology
          </h3>
          <div className="sub">Real-time directional power distribution across neighborhood grid</div>
        </div>
        <div className="badge normal">LIVE DISPATCH</div>
      </div>

      <div className="energy-flow-grid">
        {/* Step 1: Generation Sources */}
        <div className="flow-column">
          <div className="flow-node solar-node">
            <div className="node-icon-box">
              <SolarIcon size={20} color="var(--accent-solar)" />
            </div>
            <div className="node-details">
              <span className="node-title">Solar Gen</span>
              <span className="node-val">{fmt.kw(solarKw)}</span>
            </div>
          </div>

          <div className="flow-node wind-node">
            <div className="node-icon-box">
              <WindIcon size={20} color="var(--accent-wind)" />
            </div>
            <div className="node-details">
              <span className="node-title">Wind Gen</span>
              <span className="node-val">{fmt.kw(windKw)}</span>
            </div>
          </div>
        </div>

        {/* Vector Connector 1 */}
        <div className="flow-vector active">
          <div className="vector-line">
            <div className="particle-pulse solar" />
          </div>
          <span className="vector-label">{fmt.kw(renewableKw)}</span>
        </div>

        {/* Step 2: Renewable Hub & Demand */}
        <div className="flow-column center-hub">
          <div className="flow-hub-card">
            <div className="hub-header">
              <span className="hub-badge">LOCAL GENERATION</span>
              <div className="hub-kw">{fmt.kw(renewableKw)}</div>
            </div>
            <div className="hub-subtitle">Total Clean Output</div>
          </div>

          {/* Direct Flow to Demand */}
          <div className="flow-connector-down">
            <div className="vertical-pulse" />
          </div>

          <div className="flow-node demand-node">
            <div className="node-icon-box">
              <DemandIcon size={22} color="var(--accent-demand)" />
            </div>
            <div className="node-details">
              <span className="node-title">Community Demand</span>
              <span className="node-val">{fmt.kw(demandKw)}</span>
            </div>
          </div>
        </div>

        {/* Vector Connector 2 */}
        <div className="flow-vector active">
          <div className="vector-line">
            <div className="particle-pulse grid" />
          </div>
          <span className="vector-label">Buffer Balancing</span>
        </div>

        {/* Step 3: Storage & Grid Import */}
        <div className="flow-column">
          <div className={`flow-node battery-node ${isBatteryDischarging ? 'discharging' : isBatteryCharging ? 'charging' : ''}`}>
            <div className="node-icon-box">
              <BatteryIcon size={20} color="var(--accent-battery)" />
            </div>
            <div className="node-details">
              <span className="node-title">Community Battery</span>
              <span className="node-val">{batterySocPct.toFixed(0)}% SOC</span>
              <span className="node-sub">
                {isBatteryCharging
                  ? `+${fmt.kw(batteryChargeKw)} charging`
                  : isBatteryDischarging
                    ? `-${fmt.kw(batteryDischargeKw)} dispatch`
                    : 'Idle / Standby'}
              </span>
            </div>
          </div>

          <div className={`flow-node grid-node ${gridImportKw > 0 ? 'drawing' : ''}`}>
            <div className="node-icon-box">
              <GridIcon size={20} color="var(--accent-grid)" />
            </div>
            <div className="node-details">
              <span className="node-title">Substation Grid</span>
              <span className="node-val">{fmt.kw(gridImportKw)}</span>
              <span className="node-sub">{gridImportKw > 0 ? 'Grid Import' : 'Zero Import'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
