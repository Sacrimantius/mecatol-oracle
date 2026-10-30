import { runSimulation } from '../engine/simulate';
import type { SimulationInput } from '../engine/types';

self.onmessage = (event: MessageEvent<SimulationInput>) => {
  self.postMessage(runSimulation(event.data));
};
