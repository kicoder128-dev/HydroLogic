export type Coord = { x: number; y: number };

export type ToolType = 'PIPE' | 'VALVE' | 'DELAY' | 'ERASER' | null;

export type FluidColor = 'BLUE' | 'RED' | 'PURPLE' | null;

export interface CellNode {
  x: number;
  y: number;
  type: 'EMPTY' | 'SOURCE_BLUE' | 'SOURCE_RED' | 'PIPE' | 'VALVE' | 'DELAY' | 'COLLECTOR';
  valveDirection: 'RIGHT' | 'DOWN';
  inputBuffer: {
    color: FluidColor;
    pressure: number;
  };
  outputBuffer: {
    color: FluidColor;
    pressure: number;
  };
  currentFluid: FluidColor;
  currentPressure: number;
  hasDelayCharge?: boolean;
}

export type GridMatrix = CellNode[][];

export interface SimulationResult {
  status: 'RUNNING' | 'SUCCESS' | 'BLOWOUT' | 'IDLE';
  message: string;
}
