/**
 * An interface that represent that measurements table
 */
export interface Measurements {
  measurement_id: number;
  time: string;
  device_id: number;
  voltage: number;
  temperature: number;
  amperage: number;
  motor1: number;
  motor2: number;
}
