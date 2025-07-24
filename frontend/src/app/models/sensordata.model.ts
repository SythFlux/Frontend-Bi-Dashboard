/**
 * A class that represent that test data
 */
export interface SensorData {
  id: number;
  sensor: string;
  location: string;
  temperature: number;
  humidity: number;
  LDR: number;
  Rain: number;
  Vbat: number;
  Tbat: number;
  Currentpanel: number;
  Voltpanel: number;
  Powerpanel: number;
  reading_time: string;
}
