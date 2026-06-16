import React, { useState, useEffect, useRef } from 'react';
import { Coord, ToolType, CellNode, GridMatrix, SimulationResult, FluidColor } from './types';

const GRID_WIDTH = 6;
const GRID_HEIGHT = 5;

export const HydroGrid: React.FC = () => {
  const [grid, setGrid] = useState<GridMatrix>([]);
  const [activeTool, setActiveTool] = useState<ToolType>('PIPE');
  const [simResult, setSimResult] = useState<SimulationResult>({ status: 'IDLE', message: '' });
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  
  const simIntervalRef = useRef<any>(null);

  useEffect(() => {
    resetGrid();
    return () => stopSimulation();
  }, []);

  const resetGrid = () => {
    stopSimulation();
    setCurrentFrame(0);
    setSimResult({ status: 'IDLE', message: '' });

    const initialGrid: GridMatrix = [];
    for (let y = 0; y < GRID_HEIGHT; y++) {
      const row: CellNode[] = [];
      for (let x = 0; x < GRID_WIDTH; x++) {
        let type: CellNode['type'] = 'EMPTY';
        
        if (x === 0 && y === 1) type = 'SOURCE_BLUE';
        if (x === 0 && y === 3) type = 'SOURCE_RED';
        if (x === 5 && y === 2) type = 'COLLECTOR';

        row.push({
          x, y, type,
          valveDirection: 'RIGHT',
          inputBuffer: { color: null, pressure: 0 },
          outputBuffer: { color: null, pressure: 0 },
          currentFluid: null,
          currentPressure: 0
        });
      }
      initialGrid.push(row);
    }
    setGrid(initialGrid);
  };

  const handleCellClick = (x: number, y: number) => {
    if (simResult.status === 'RUNNING') return;

    setGrid((prevGrid) => {
      return prevGrid.map((row) =>
        row.map((cell) => {
          if (cell.x !== x || cell.y !== y) return cell;
          if (['SOURCE_BLUE', 'SOURCE_RED', 'COLLECTOR'].includes(cell.type)) return cell;

          if (activeTool === 'ERASER') {
            return { ...cell, type: 'EMPTY', currentFluid: null, currentPressure: 0 };
          } else if (activeTool === 'VALVE') {
            const nextDir = cell.type === 'VALVE' && cell.valveDirection === 'RIGHT' ? 'DOWN' : 'RIGHT';
            return { ...cell, type: 'VALVE', valveDirection: nextDir };
          } else if (activeTool) {
            return { ...cell, type: activeTool as any };
          }
          return cell;
        })
      );
    });
  };

  const stopSimulation = () => {
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
  };

  const runSimulationStep = () => {
    setGrid((prevGrid) => {
      const nextGrid: GridMatrix = prevGrid.map(row => 
        row.map(cell => ({
          ...cell,
          inputBuffer: { color: null, pressure: 0 },
          outputBuffer: { color: null, pressure: 0 }
        }))
      );

      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          const cell = nextGrid[y][x];
          if (cell.type === 'SOURCE_BLUE') {
            cell.outputBuffer = { color: 'BLUE', pressure: 1 };
          } else if (cell.type === 'SOURCE_RED') {
            if (currentFrame % 4 < 2) {
              cell.outputBuffer = { color: 'RED', pressure: 1 };
            }
          }
        }
      }

      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          const cell = nextGrid[y][x];
          if (cell.outputBuffer.pressure > 0) {
            const targets = getTargetOutputs(cell, nextGrid);
            targets.forEach(targetPos => {
              const targetCell = nextGrid[targetPos.y][targetPos.x];
              mixIntoBuffer(targetCell.inputBuffer, cell.outputBuffer);
            });
          }
        }
      }

      let localStatus: SimulationResult['status'] = 'RUNNING';
      let localMessage = '';

      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          const cell = nextGrid[y][x];
          
          if (cell.inputBuffer.pressure > 2) {
            localStatus = 'BLOWOUT';
            localMessage = `System Blowout at Node (${cell.x}, ${cell.y})! Pressure reached critical index: ${cell.inputBuffer.pressure}`;
          }

          cell.currentFluid = cell.inputBuffer.color;
          cell.currentPressure = cell.inputBuffer.pressure;

          if (cell.type === 'DELAY') {
            if (cell.hasDelayCharge) {
              cell.outputBuffer = { color: cell.currentFluid, pressure: cell.currentPressure };
              cell.hasDelayCharge = false;
            } else if (cell.currentPressure > 0) {
              cell.hasDelayCharge = true;
              cell.outputBuffer = { color: null, pressure: 0 };
            }
          } else if (cell.type !== 'EMPTY') {
            cell.outputBuffer = { color: cell.currentFluid, pressure: cell.currentPressure };
          }

          if (cell.type === 'COLLECTOR' && cell.currentFluid !== null) {
            if (cell.currentFluid === 'PURPLE') {
              localStatus = 'SUCCESS';
              localMessage = 'Success: Perfect Purple Emulsion Stable!';
            } else {
              localStatus = 'BLOWOUT';
              localMessage = `System Contaminated! Collector received pure ${cell.currentFluid} instead of Purple.`;
            }
          }
        }
      }

      if (localStatus !== 'RUNNING') {
        setSimResult({ status: localStatus, message: localMessage });
        stopSimulation();
      }

      return nextGrid;
    });

    setCurrentFrame(prev => prev + 1);
  };

  const startSimulation = () => {
    if (simIntervalRef.current) return;
    setSimResult({ status: 'RUNNING', message: 'Simulation initialized...' });
    simIntervalRef.current = setInterval(runSimulationStep, 400);
  };

  const getTargetOutputs = (cell: CellNode, currentGrid: GridMatrix): Coord[] => {
    const validTargets: Coord[] = [];
    const pushIfValid = (x: number, y: number) => {
      if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
        const tgt = currentGrid[y][x];
        if (tgt.type !== 'EMPTY') validTargets.push({ x, y });
      }
    };

    if (cell.type === 'SOURCE_BLUE' || cell.type === 'SOURCE_RED' || cell.type === 'PIPE' || cell.type === 'DELAY') {
      pushIfValid(cell.x + 1, cell.y);
    } else if (cell.type === 'VALVE') {
      if (cell.valveDirection === 'RIGHT') pushIfValid(cell.x + 1, cell.y);
      if (cell.valveDirection === 'DOWN') pushIfValid(cell.x, cell.y + 1);
    }
    return validTargets;
  };

  const mixIntoBuffer = (buffer: { color: FluidColor; pressure: number }, source: { color: FluidColor; pressure: number }) => {
    buffer.pressure += source.pressure;
    if (!buffer.color) {
      buffer.color = source.color;
    } else if ((buffer.color === 'BLUE' && source.color === 'RED') || (buffer.color === 'RED' && source.color === 'BLUE')) {
      buffer.color = 'PURPLE';
    }
  };

  return (
    <div style={{ padding: '24px', background: '#0f172a', color: '#f8fafc', fontFamily: 'monospace', borderRadius: '12px' }}>
      <h2 style={{ margin: '0 0 16px 0', color: '#38bdf8' }}>HYDRO-LOGIC COMPONENT CONFIG</h2>
      
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {(['PIPE', 'VALVE', 'DELAY', 'ERASER'] as ToolType[]).map((tool) => (
          <button
            key={tool}
            onClick={() => setActiveTool(tool)}
            style={{
              padding: '8px 16px',
              background: activeTool === tool ? '#38bdf8' : '#334155',
              color: activeTool === tool ? '#0f172a' : '#f8fafc',
              border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'
            }}
          >
            {tool}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={startSimulation} disabled={simResult.status === 'RUNNING'} style={btnStyle('#22c55e')}>RUN STEP-BY-STEP</button>
        <button onClick={stopSimulation} disabled={simResult.status !== 'RUNNING'} style={btnStyle('#e11d48')}>PAUSE</button>
        <button onClick={resetGrid} style={btnStyle('#64748b')}>RESET LEVEL</button>
        <div style={{ fontSize: '14px', color: '#94a3b8' }}>Frame Count: <span style={{ color: '#f59e0b' }}>{currentFrame}</span></div>
      </div>

      {simResult.message && (
        <div style={{
          padding: '12px', borderRadius: '6px', marginBottom: '16px', fontWeight: 'bold',
          background: simResult.status === 'SUCCESS' ? '#065f46' : simResult.status === 'BLOWOUT' ? '#991b1b' : '#1e293b'
        }}>
          {simResult.message}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${GRID_WIDTH}, 80px)`, gap: '6px' }}>
        {grid.map((row) =>
          row.map((cell) => {
            let bg = '#1e293b';
            let label = '';
            if (cell.type === 'SOURCE_BLUE') { bg = '#1d4ed8'; label = 'IN BLUE'; }
            if (cell.type === 'SOURCE_RED') { bg = '#b91c1c'; label = `IN RED\n\${currentFrame % 4 < 2 ? '⚡' : '💤'}`; }
            if (cell.type === 'COLLECTOR') { bg = cell.currentFluid === 'PURPLE' ? '#6b21a8' : '#475569'; label = 'SINK'; }
            if (cell.type === 'PIPE') { bg = '#334155'; label = 'PIPE'; }
            if (cell.type === 'VALVE') { bg = '#0d9488'; label = `VALVE\n(\${cell.valveDirection})`; }
            if (cell.type === 'DELAY') { bg = '#b45309'; label = `DELAY\n\${cell.hasDelayCharge ? '[X]' : '[ ]'}`; }

            return (
              <div
                key={`${cell.x}-${cell.y}`}
                onClick={() => handleCellClick(cell.x, cell.y)}
                style={{
                  width: '80px', height: '80px', backgroundColor: bg, borderRadius: '6px',
                  display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                  cursor: 'pointer', position: 'relative', fontSize: '11px', textAlign: 'center',
                  border: cell.currentPressure > 0 ? '3px solid #a855f7' : '1px solid #475569',
                  whiteSpace: 'pre-line'
                }}
              >
                <div style={{ fontWeight: 'bold' }}>{label}</div>
                {cell.currentPressure > 0 && (
                  <div style={{
                    position: 'absolute', bottom: '4px', right: '4px', background: '#000',
                    padding: '2px 4px', borderRadius: '3px', fontSize: '9px', color: '#a855f7'
                  }}>
                    P:{cell.currentPressure}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

const btnStyle = (color: string) => ({
  padding: '10px 16px',
  background: color,
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontWeight: 'bold' as const
});
