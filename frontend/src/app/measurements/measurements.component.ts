import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from '../navbar/navbar.component';
import { SharedService } from '../services/shared.service';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { forkJoin, of, interval, Subscription } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import Chart from 'chart.js/auto';
import zoomPlugin from 'chartjs-plugin-zoom';
import 'chartjs-adapter-date-fns';

import { ApiService } from '../services/api.service';

Chart.register(zoomPlugin);

interface FieldItem {
  name: string;
  selected: boolean;
}

interface DeviceItem {
  name: string;
  selected: boolean;
}

/**
 * Each chart card (“slot”) now also includes:
 *  - `lastTimestamps`: a map from field name → Date of last‐seen point.
 *  - `hoveredPoint?`: the currently clicked/hovered point.
 */
interface ChartSlot {
  id: number;
  selectedDevice: string;
  fields: FieldItem[];
  chartInstance: any | null;
  barInstance: any | null;
  errorMessage: string;

  timeRange: string;
  customStart: string;

  lastTimestamps: { [field: string]: Date };

  hoveredPoint?: { time: Date; value: number };
}

@Component({
  selector: 'app-measurements',
  standalone: true,
  imports: [
    CommonModule,
    NavbarComponent,
    FormsModule,
    HttpClientModule
  ],
  templateUrl: './measurements.component.html',
  styleUrls: ['./measurements.component.css']
})
export class MeasurementsComponent implements OnInit, AfterViewInit, OnDestroy {
  // ────────────────────────────────────────────────
  // 1) Sidebar + KPI state
  // ────────────────────────────────────────────────
  isExpanded = true;
  nextUpdate = new Date();

  // ────────────────────────────────────────────────
  // 2) Global “Add Field” / Fields checklist
  // ────────────────────────────────────────────────
  fieldInput = '';
  fields: FieldItem[] = [];
  selectedTimeRange = '-7d';
  customStart = '';
  errorMessage = '';

  // ────────────────────────────────────────────────
  // 3) Global Devices checklist
  // ────────────────────────────────────────────────
  devices: DeviceItem[] = [];
  selectedDevices: string[] = [];

  // ────────────────────────────────────────────────
  // 4) KPI Cards
  // ────────────────────────────────────────────────
  kpis = [
    { label: 'Data Points', value: '--' },
    { label: 'Devices Online', value: '--' },
    { label: 'Voltage Peak', value: '--' },
    { label: 'Avg Temp', value: '--' },
    { label: 'Last Sync', value: '--' }
  ];
  private lineChart: any;

  // ────────────────────────────────────────────────
  // 5) Dynamic chart cards
  // ────────────────────────────────────────────────
  charts: ChartSlot[] = [];
  private nextChartId = 0;

  // ────────────────────────────────────────────────
  // 6) Polling / “realtime” state
  // ────────────────────────────────────────────────
  private pollSubscription: Subscription | null = null;
  private POLL_INTERVAL_MS = 1500; // 5 seconds
  // Map from "Field (Device)" → last‐seen timestamp
  private combinedLastTimestamps: { [key: string]: Date } = {};

  // ────────────────────────────────────────────────
  // For loading/storing from sessionStorage
  // ────────────────────────────────────────────────
  private _savedSelectedDeviceNames: string[] | null = null;
  private _savedChartsPlain: any[] | null = null;

  constructor(
    private shared: SharedService,
    private apiService: ApiService
  ) {}

  ngOnInit() {
    // Load persisted state (fields, timeRange/customStart, selectedDevices, chart slots)
    this.loadState();

    // Keep sidebar state in sync
    this.shared.sidebarExpanded$.subscribe(exp => this.isExpanded = exp);

    // 1) Fetch all devices initially
    this.apiService.getAllDevices()
      .pipe(
        catchError(err => {
          console.error('Error fetching devices', err);
          this.errorMessage = 'Failed to load device list.';
          return of<any[]>([]);
        })
      )
      .subscribe(devs => {
        // Build devices list; apply saved selections if present, else default to selected
        this.devices = devs.map(d => ({
          name: d.name,
          selected: this._savedSelectedDeviceNames
            ? this._savedSelectedDeviceNames.includes(d.name)
            : true
        }));
        // Populate selectedDevices array
        this.selectedDevices = this.devices
          .filter(d => d.selected)
          .map(d => d.name);

        // Reconstruct chart‐slots from saved plain objects, if any
        if (this._savedChartsPlain) {
          this.charts = this._savedChartsPlain.map(sc => ({
            id: sc.id,
            selectedDevice: sc.selectedDevice,
            fields: sc.fields.map((f: any) => ({ name: f.name, selected: f.selected })),
            chartInstance: null,
            barInstance: null,
            errorMessage: '',
            timeRange: sc.timeRange,
            customStart: sc.customStart,
            lastTimestamps: {}
          }));
          // Ensure nextChartId is one greater than max existing ID
          const maxId = this.charts.reduce((acc, c) => Math.max(acc, c.id), -1);
          this.nextChartId = maxId + 1;
        } else {
          this.charts = [];
          this.nextChartId = 0;
        }

        // After devices and charts are reconstructed, do a full fetch for the combined chart
        this.combinedLastTimestamps = {};
        this.refreshCombined(/* initial = */ true);

        // After combined is drawn, also refresh each individual card
        this.charts.forEach(c => {
          this.refreshCard(c, true);
        });
      });

    // 2) Start polling every POLL_INTERVAL_MS to append only new points
    this.pollSubscription = interval(this.POLL_INTERVAL_MS).subscribe(() => {
      // If no fields or no devices selected, skip
      const activeFields = this.fields.filter(f => f.selected).map(f => f.name);
      const activeDevs = this.selectedDevices;
      if (!activeFields.length || !activeDevs.length) {
        return;
      }
      // If the chart doesn't exist yet, do a full load
      const isInitial = !this.lineChart;
      this.refreshCombined(isInitial);

      // For each card, do the same incremental vs full logic
      this.charts.forEach(card => {
        const cardNeedsFull = !card.chartInstance;
        this.refreshCard(card, cardNeedsFull);
      });
    });
  }

  ngAfterViewInit() {
    // Draw a placeholder “no-data” grid in the main canvas until real data arrives
    this.drawGridChart('mainChart');
  }

  ngOnDestroy() {
    // Clean up polling
    if (this.pollSubscription) {
      this.pollSubscription.unsubscribe();
    }
  }

  // ────────────────────────────────────────────────
  // 7) Sidebar toggle
  // ────────────────────────────────────────────────
  toggleSidebar() {
    this.isExpanded = !this.isExpanded;
    this.shared.setSidebarExpanded(this.isExpanded);
  }

  // ────────────────────────────────────────────────
  // 8) Global “Add Field” logic
  // ────────────────────────────────────────────────
  addField() {
    const name = this.fieldInput.trim();
    if (!name || this.fields.find(f => f.name === name)) return;

    // (a) Add to global array
    this.fields.push({ name, selected: true });
    this.fieldInput = '';

    // (b) Add to each existing card
    this.charts.forEach(c => {
      c.fields.push({ name, selected: true });
      // Mark this field as “untouched” so next poll will do a full fetch for it
      c.lastTimestamps[name] = undefined as any;
    });

    // (c) Clear combinedLastTimestamps so next refresh is “full”
    this.combinedLastTimestamps = {};
    // (d) Do a full refresh of combined + each card
    this.refreshCombined(true);
    this.charts.forEach(c => this.refreshCard(c, true));

    // Save updated state
    this.saveState();
  }

  removeGlobalField(field: FieldItem) {
    this.fields = this.fields.filter(f => f !== field);
    // Remove from each card’s field list & lastTimestamps map
    this.charts.forEach(c => {
      c.fields = c.fields.filter(f => f.name !== field.name);
      delete c.lastTimestamps[field.name];
    });
    // If that field was part of combinedLastTimestamps, clear and reload
    this.combinedLastTimestamps = {};
    this.refreshCombined(true);
    this.charts.forEach(c => this.refreshCard(c, true));

    // Save updated state
    this.saveState();
  }

  onGlobalFieldToggle() {
    // Sync each card’s selection to global
    this.charts.forEach(c => {
      c.fields.forEach(cf => {
        const globalF = this.fields.find(gf => gf.name === cf.name);
        if (globalF) {
          cf.selected = globalF.selected;
        }
      });
      // Whenever fields toggle, force a full refresh of that card
      c.lastTimestamps = {};
      this.refreshCard(c, true);
    });
    // For the combined chart, clear timestamps and do a full refresh
    this.combinedLastTimestamps = {};
    this.refreshCombined(true);

    // Save updated state
    this.saveState();
  }

  // ────────────────────────────────────────────────
  // 9) Global “Devices on Chart” toggle
  // ────────────────────────────────────────────────
  onGlobalDeviceToggle() {
    this.selectedDevices = this.devices
      .filter(d => d.selected)
      .map(d => d.name);

    // Changing devices means combined dataset keys have changed → clear timestamps
    this.combinedLastTimestamps = {};
    this.refreshCombined(true);

    // Save updated state
    this.saveState();
  }

  // ────────────────────────────────────────────────
  // 10) Global time-range change
  // ────────────────────────────────────────────────
  onTimeRangeChange() {
    // The full time‐range changed, so flush all combined timestamps and reload full
    this.combinedLastTimestamps = {};
    this.refreshCombined(true);
    // And flush + reload each card completely
    this.charts.forEach(c => {
      c.lastTimestamps = {};
      this.refreshCard(c, true);
    });

    // Save updated state
    this.saveState();
  }

  // ────────────────────────────────────────────────
  // 11) “Combined” chart: full vs. incremental refresh
  // ────────────────────────────────────────────────
  private refreshCombined(initial: boolean) {
    this.errorMessage = '';

    const activeFields = this.fields.filter(f => f.selected).map(f => f.name);
    const activeDevices = this.selectedDevices;
    if (activeFields.length === 0 || activeDevices.length === 0) {
      // No filters → clear chart and state
      this.combinedLastTimestamps = {};
      if (this.lineChart) {
        this.lineChart.destroy();
        this.lineChart = null;
      }
      this.drawGridChart('mainChart');
      return;
    }

    // If this is the first time or forced initial, perform a full load:
    if (initial || !this.lineChart) {
      // Build all (field × device) calls
      const calls = activeFields.flatMap(fieldName =>
        activeDevices.map(devName =>
          this.apiService.getMeasurements(fieldName, devName,
            this.selectedTimeRange === 'custom' ? this.customStart : this.selectedTimeRange
          ).pipe(
            map(data => ({ field: `${fieldName} (${devName})`, rawField: fieldName, data })),
            catchError(_ => {
              this.errorMessage = `Field "${fieldName}" or device "${devName}" returned no data.`;
              return of({ field: `${fieldName} (${devName})`, rawField: fieldName, data: [] });
            })
          )
        )
      );

      forkJoin(calls).subscribe(results => {
        const datasets = results
          .filter(r => (r as any).data.length > 0)
          .map(r => {
            const rec = r as { field: string; rawField: string; data: any[] };
            return {
              label: rec.field,
              points: rec.data.map(d => ({
                time: new Date(d.time),
                value: (d as any)[rec.rawField]
              }))
            };
          });

        if (!datasets.length) {
          // Nothing returned → placeholder
          if (this.lineChart) {
            this.lineChart.destroy();
            this.lineChart = null;
          }
          this.drawGridChart('mainChart');
          // Clear any timestamps because no real data
          this.combinedLastTimestamps = {};
          return;
        }

        // Prepare Chart.js datasets
        const colors = ['#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8'];
        const chartDatasets = datasets.map((s, i) => ({
          label: s.label,
          data: s.points.map(p => ({ x: p.time, y: p.value })),
          borderColor: colors[i % colors.length],
          backgroundColor: 'transparent',
          spanGaps: true,
          pointRadius: 3,
          pointHoverRadius: 5,
          showLine: true
        }));

        const config: any = {
          type: 'line',
          data: { datasets: chartDatasets },
          options: {
            responsive: true,
            interaction: { mode: 'nearest', intersect: true },
            scales: {
              x: {
                type: 'time',
                time: { tooltipFormat: 'PPpp' },
                title: { display: true, text: 'Time' }
              },
              y: {
                title: { display: true, text: 'Value' }
              }
            },
            plugins: {
              tooltip: {
                callbacks: { label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.y}` }
              },
              legend: { position: 'top' },
              zoom: {
                // Remove minRange limit so zoom can be arbitrarily tight
                zoom: {
                  wheel: { enabled: true },
                  pinch: { enabled: true },
                  mode: 'xy'
                },
                pan: {
                  enabled: true,
                  mode: 'xy',
                  bounds: 'chart',
                  threshold: 5
                }
              }
            }
          }
        };

        // Destroy existing chart if present
        if (this.lineChart) {
          this.lineChart.destroy();
          this.lineChart = null;
        }

        // Create new chart
        const canvas = document.getElementById('mainChart') as HTMLCanvasElement;
        this.lineChart = new Chart(canvas, config);

        // Update KPIs from the first dataset
        const firstPoints = datasets[0].points;
        this.kpis[0].value = firstPoints.length.toString();
        this.kpis[2].value = Math.max(...firstPoints.map(p => p.value)).toFixed(1);
        this.kpis[4].value = firstPoints.slice(-1)[0].time.toLocaleTimeString();

        // Record last‐seen timestamp for each dataset
        this.combinedLastTimestamps = {};
        datasets.forEach(s => {
          const lastTs = s.points[s.points.length - 1].time;
          this.combinedLastTimestamps[s.label] = lastTs;
        });
      });
    } else {
      // ────────────────────────────────────────────────
      // Incremental refresh: fetch only new points since last timestamp
      // ────────────────────────────────────────────────
      activeFields.forEach(fieldName => {
        activeDevices.forEach(devName => {
          const key = `${fieldName} (${devName})`;
          const lastTs = this.combinedLastTimestamps[key];

          if (!lastTs) {
            // Either newly added field/device or chart was just created; do a “mini‐full” fetch for that one
            this.apiService.getMeasurements(
              fieldName,
              devName,
              this.selectedTimeRange === 'custom' ? this.customStart : this.selectedTimeRange
            ).pipe(
              catchError(_ => {
                this.errorMessage = `Field "${fieldName}" or device "${devName}" returned no data.`;
                return of<any[]>([]);
              })
            ).subscribe(data => {
              if (!data.length) return;
              // Build a tiny dataset for just this key
              const points = data.map(d => ({
                time: new Date(d.time),
                value: (d as any)[fieldName]
              }));
              const lastPoint = points[points.length - 1];
              this.combinedLastTimestamps[key] = lastPoint.time;

              // Add a new dataset to the existing chart
              const dsIndex = this.lineChart.data.datasets.length;
              const color = ['#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8'][dsIndex % 5];
              this.lineChart.data.datasets.push({
                label: key,
                data: points.map(p => ({ x: p.time, y: p.value })),
                borderColor: color,
                backgroundColor: 'transparent',
                spanGaps: true,
                pointRadius: 3,
                pointHoverRadius: 5,
                showLine: true
              });
              this.lineChart.update();
            });
          } else {
            // Fetch data points strictly newer than lastTs
            const sinceStr = lastTs.toISOString();
            this.apiService.getMeasurements(fieldName, devName, sinceStr)
              .pipe(
                catchError(_ => {
                  // If error, just skip
                  return of<any[]>([]);
                })
              )
              .subscribe(data => {
                if (!data.length) return;

                // Map returned rows → { time, value }
                const allPoints = data.map(d => ({
                  time: new Date(d.time),
                  value: (d as any)[fieldName] as number
                }));
                // Drop anything ≤ lastTs
                const newPoints = allPoints.filter(p => p.time.getTime() > lastTs.getTime());
                if (!newPoints.length) {
                  return;
                }

                // Update last timestamp
                const freshest = newPoints[newPoints.length - 1].time;
                this.combinedLastTimestamps[key] = freshest;

                // Find dataset index in chart and append
                const dsIdx = this.lineChart.data.datasets.findIndex((ds: any) => ds.label === key);
                if (dsIdx >= 0) {
                  newPoints.forEach(p => {
                    (this.lineChart.data.datasets[dsIdx].data as any[]).push({ x: p.time, y: p.value });
                  });
                  this.lineChart.update();
                }
              });
          }
        });
      });
    }
  }

  private drawGridChart(id: string) {
    const c = document.getElementById(id) as HTMLCanvasElement;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.strokeStyle = '#ddd';
    for (let i = 1; i < 5; i++) {
      const y = (c.height / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(c.width, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#aaa';
    ctx.font = '14px sans-serif';
    ctx.fillText('No data or please select filters', 10, c.height / 2);
  }

  // ────────────────────────────────────────────────
  // 12) Add / Remove / Redraw single cards
  // ────────────────────────────────────────────────
  addChart() {
    const newId = this.nextChartId++;
    const copiedFields: FieldItem[] = this.fields.map(f => ({ name: f.name, selected: f.selected }));
    const newSlot: ChartSlot = {
      id: newId,
      selectedDevice: '',
      fields: copiedFields,
      chartInstance: null,
      barInstance: null,
      errorMessage: '',
      timeRange: this.selectedTimeRange,
      customStart: '',
      lastTimestamps: {}  // initialize empty so first fetch is “full”
    };
    this.charts.push(newSlot);

    // Draw placeholders immediately
    setTimeout(() => {
      this.drawSingleGridPlaceholder(`chart-${newId}`);
      this.drawSingleBarPlaceholder(`bar-chart-${newId}`);
    });

    // Save updated state
    this.saveState();
  }

  removeChart(chartId: number) {
    const idx = this.charts.findIndex(c => c.id === chartId);
    if (idx === -1) return;
    const slot = this.charts[idx];
    if (slot.chartInstance) {
      slot.chartInstance.destroy();
    }
    if (slot.barInstance) {
      slot.barInstance.destroy();
    }
    this.charts.splice(idx, 1);

    // Save updated state
    this.saveState();
  }

  onCardDeviceOrFieldChange(c: ChartSlot) {
    // Changing device or fields → flush that card’s timestamps and do full redraw
    c.lastTimestamps = {};
    this.refreshCard(c, true);

    // Save updated state
    this.saveState();
  }

  onCardTimeRangeChange(c: ChartSlot) {
    // Changing time-range → flush that card’s timestamps and do full redraw
    c.lastTimestamps = {};
    this.refreshCard(c, true);

    // Save updated state
    this.saveState();
  }

  private refreshCard(c: ChartSlot, initial: boolean) {
    c.errorMessage = '';

    const chosenFields = c.fields.filter(f => f.selected).map(f => f.name);
    if (!c.selectedDevice || chosenFields.length === 0) {
      // Nothing selected → clear chart(s) and draw placeholders
      c.lastTimestamps = {};
      if (c.chartInstance) {
        c.chartInstance.destroy();
        c.chartInstance = null;
      }
      if (c.barInstance) {
        c.barInstance.destroy();
        c.barInstance = null;
      }
      this.drawSingleGridPlaceholder(`chart-${c.id}`);
      this.drawSingleBarPlaceholder(`bar-chart-${c.id}`);
      return;
    }

    // If initial or no existing chart → full load for this card
    if (initial || !c.chartInstance) {
      const calls = chosenFields.map(fieldName =>
        this.apiService.getMeasurements(
          fieldName,
          c.selectedDevice,
          c.timeRange === 'custom' ? c.customStart : c.timeRange
        ).pipe(
          map(data => ({ field: fieldName, data })),
          catchError(_ => of({ field: fieldName, data: [] }))
        )
      );

      forkJoin(calls).subscribe(results => {
        const datasets = results
          .filter(r => (r as any).data.length > 0)
          .map(r => {
            const rec = r as { field: string; data: any[] };
            return {
              label: rec.field,
              points: rec.data.map(d => ({
                time: new Date(d.time),
                value: (d as any)[rec.field]
              }))
            };
          });

        if (!datasets.length) {
          c.errorMessage = `No data for "${c.selectedDevice}" with those fields.`;
          if (c.chartInstance) {
            c.chartInstance.destroy();
            c.chartInstance = null;
          }
          if (c.barInstance) {
            c.barInstance.destroy();
            c.barInstance = null;
          }
          this.drawSingleGridPlaceholder(`chart-${c.id}`);
          this.drawSingleBarPlaceholder(`bar-chart-${c.id}`);
          // Clear timestamps
          c.lastTimestamps = {};
          return;
        }

        // Build line datasets
        const colors = ['#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8'];
        const chartDatasets = datasets.map((s, i) => ({
          label: s.label,
          data: s.points.map(p => ({ x: p.time, y: p.value })),
          borderColor: colors[i % colors.length],
          backgroundColor: 'transparent',
          spanGaps: true,
          pointRadius: 3,
          pointHoverRadius: 5,
          showLine: true
        }));

        const lineConfig: any = {
          type: 'line',
          data: { datasets: chartDatasets },
          options: {
            responsive: true,
            interaction: { mode: 'nearest', intersect: true },
            scales: {
              x: {
                type: 'time',
                time: { tooltipFormat: 'PPpp' },
                title: { display: true, text: 'Time' }
              },
              y: {
                title: { display: true, text: 'Value' }
              }
            },
            plugins: {
              tooltip: {
                callbacks: { label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.y}` }
              },
              legend: { position: 'top' },
              zoom: {
                // Remove minRange limit so zoom can be arbitrarily tight
                zoom: {
                  wheel: { enabled: true },
                  pinch: { enabled: true },
                  mode: 'x'
                },
                pan: {
                  enabled: true,
                  mode: 'x',
                  bounds: 'chart',
                  threshold: 5
                }
              }
            }
          }
        };

        // Destroy existing if any
        if (c.chartInstance) {
          c.chartInstance.destroy();
          c.chartInstance = null;
        }

        // Create new line chart
        const canvasEl = document.getElementById(`chart-${c.id}`) as HTMLCanvasElement;
        c.chartInstance = new Chart(canvasEl, lineConfig);

        // Build bar chart (latest values)
        const latestLabels = datasets.map(s => s.label);
        const latestValues = datasets.map(s => s.points[s.points.length - 1].value);
        const barConfig: any = {
          type: 'bar',
          data: {
            labels: latestLabels,
            datasets: [
              {
                label: 'Latest Value',
                data: latestValues,
                backgroundColor: colors.slice(0, latestLabels.length)
              }
            ]
          },
          options: {
            responsive: true,
            scales: {
              x: {
                title: { display: true, text: 'Field (Device)' }
              },
              y: {
                title: { display: true, text: 'Value' }
              }
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: { label: (ctx: any) => `Value: ${ctx.parsed.y}` }
              }
            }
          }
        };

        if (c.barInstance) {
          c.barInstance.destroy();
          c.barInstance = null;
        }
        const barCanvas = document.getElementById(`bar-chart-${c.id}`) as HTMLCanvasElement;
        c.barInstance = new Chart(barCanvas, barConfig);

        // Record last‐seen timestamp for each field
        c.lastTimestamps = {};
        datasets.forEach(s => {
          const lastT = s.points[s.points.length - 1].time;
          c.lastTimestamps[s.label] = lastT;
        });
      });
    } else {
      // ────────────────────────────────────────────────
      // Incremental refresh for this card
      // ────────────────────────────────────────────────
      chosenFields.forEach(fieldName => {
        const lastTs = c.lastTimestamps[fieldName];
        if (!lastTs) {
          // Newly added field or just created card: do a full fetch for that field
          this.apiService.getMeasurements(
            fieldName,
            c.selectedDevice,
            c.timeRange === 'custom' ? c.customStart : c.timeRange
          ).pipe(
            catchError(_ => of<any[]>([]))
          ).subscribe(data => {
            if (!data.length) return;
            const points = data.map(d => ({
              time: new Date(d.time),
              value: (d as any)[fieldName]
            }));
            const lastPoint = points[points.length - 1];
            c.lastTimestamps[fieldName] = lastPoint.time;

            // Add a new dataset to the line chart
            const dsIndex = c.chartInstance.data.datasets.length;
            const color = ['#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8'][dsIndex % 5];
            c.chartInstance.data.datasets.push({
              label: fieldName,
              data: points.map(p => ({ x: p.time, y: p.value })),
              borderColor: color,
              backgroundColor: 'transparent',
              spanGaps: true,
              pointRadius: 3,
              pointHoverRadius: 5,
              showLine: true
            });
            c.chartInstance.update();

            // If barInstance exists, update its labels/data if that field is the only one selected
            if (c.barInstance && chosenFields.length === 1) {
              c.barInstance.data.labels = [fieldName];
              c.barInstance.data.datasets[0].data = [lastPoint.value];
              c.barInstance.data.datasets[0].backgroundColor = [color];
              c.barInstance.update();
            }
          });
        } else {
          // Fetch only new points since lastTs
          const sinceStr = lastTs.toISOString();
          this.apiService.getMeasurements(fieldName, c.selectedDevice, sinceStr)
            .pipe(catchError(_ => of<any[]>([])))
            .subscribe(data => {
              if (!data.length) return;

              // Convert and drop anything ≤ lastTs
              const allPts = data.map(d => ({
                time: new Date(d.time),
                value: (d as any)[fieldName] as number
              }));
              const trulyNew = allPts.filter(p => p.time.getTime() > lastTs.getTime());
              if (!trulyNew.length) {
                return;
              }

              // Advance to the very last timestamp
              const freshest = trulyNew[trulyNew.length - 1].time;
              c.lastTimestamps[fieldName] = freshest;

              // Line‐chart update:
              const dsIdx = c.chartInstance.data.datasets.findIndex((ds: any) => ds.label === fieldName);
              if (dsIdx >= 0) {
                trulyNew.forEach(p => {
                  (c.chartInstance.data.datasets[dsIdx].data as any[]).push({ x: p.time, y: p.value });
                });
                c.chartInstance.update();
              }

              // Update bar chart: show just the very latest value for that field
              if (c.barInstance) {
                const latestValue = trulyNew[trulyNew.length - 1].value;
                const barColor = (c.chartInstance.data.datasets[dsIdx].borderColor as string) || '#007bff';
                c.barInstance.data.labels = [fieldName];
                c.barInstance.data.datasets[0].data = [latestValue];
                c.barInstance.data.datasets[0].backgroundColor = [barColor];
                c.barInstance.update();
              }
            });
        }
      });
    }
  }

  private drawSingleGridPlaceholder(canvasId: string) {
    const c = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.strokeStyle = '#ddd';
    for (let i = 1; i < 5; i++) {
      const y = (c.height / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(c.width, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#aaa';
    ctx.font = '14px sans-serif';
    ctx.fillText('Please select a device & fields', 10, c.height / 2);
  }

  private drawSingleBarPlaceholder(canvasId: string) {
    const c = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#ddd';
    ctx.font = '14px sans-serif';
    ctx.fillText('No data', 10, c.height / 2);
  }

  globalFieldsLabel(): string {
    if (!this.fields.length) return 'No fields';
    const count = this.fields.filter(f => f.selected).length;
    return count ? `Selected (${count})` : 'No fields';
  }

  globalDevicesLabel(): string {
    if (!this.devices.length) return 'No devices';
    const count = this.devices.filter(d => d.selected).length;
    return count ? `Selected (${count})` : 'No devices';
  }

  cardFieldsLabel(c: ChartSlot): string {
    if (!c.fields.length) return 'No fields';
    const count = c.fields.filter(f => f.selected).length;
    return count ? `Selected (${count})` : 'No fields';
  }

  // ────────────────────────────────────────────────
  // Helpers: Persist and restore component state using sessionStorage
  // ────────────────────────────────────────────────
  private loadState() {
    // Load saved fields
    const savedFields = sessionStorage.getItem('measurements_fields');
    if (savedFields) {
      try {
        this.fields = JSON.parse(savedFields);
      } catch {
        this.fields = [];
      }
    }

    // Load saved global time range & custom start
    const savedTimeRange = sessionStorage.getItem('measurements_selectedTimeRange');
    if (savedTimeRange) {
      this.selectedTimeRange = savedTimeRange;
    }
    const savedCustomStart = sessionStorage.getItem('measurements_customStart');
    if (savedCustomStart) {
      this.customStart = savedCustomStart;
    }

    // Load saved selected device names (for later use when API returns device list)
    const savedSelectedDevices = sessionStorage.getItem('measurements_selectedDevices');
    if (savedSelectedDevices) {
      try {
        this._savedSelectedDeviceNames = JSON.parse(savedSelectedDevices);
      } catch {
        this._savedSelectedDeviceNames = null;
      }
    }

    // Load saved chart slots (plain objects)
    const savedCharts = sessionStorage.getItem('measurements_charts');
    if (savedCharts) {
      try {
        this._savedChartsPlain = JSON.parse(savedCharts);
      } catch {
        this._savedChartsPlain = null;
      }
    }
  }

  private saveState() {
    // Save global fields
    sessionStorage.setItem('measurements_fields', JSON.stringify(this.fields));

    // Save global time range & custom start
    sessionStorage.setItem('measurements_selectedTimeRange', this.selectedTimeRange);
    sessionStorage.setItem('measurements_customStart', this.customStart);

    // Save selected devices by name
    const selDevNames = this.devices.filter(d => d.selected).map(d => d.name);
    sessionStorage.setItem('measurements_selectedDevices', JSON.stringify(selDevNames));

    // Save chart slots (only serializable props)
    const plainCharts = this.charts.map(c => ({
      id: c.id,
      selectedDevice: c.selectedDevice,
      fields: c.fields.map(f => ({ name: f.name, selected: f.selected })),
      timeRange: c.timeRange,
      customStart: c.customStart
    }));
    sessionStorage.setItem('measurements_charts', JSON.stringify(plainCharts));
  }

  /**
   * Clears all data on a given card:
   *   - Destroys its line chart and bar chart.
   *   - Resets placeholders.
   */
  clearCardData(c: ChartSlot) {
    // Destroy existing chart instances if they exist
    if (c.chartInstance) {
      c.chartInstance.destroy();
      c.chartInstance = null;
    }
    if (c.barInstance) {
      c.barInstance.destroy();
      c.barInstance = null;
    }

    // Clear hoveredPoint (so UI text resets)
    delete c.hoveredPoint;

    // Clear lastTimestamps so refreshCard would reload fresh if needed—but we want no data,
    // so skip calling refreshCard. Instead, draw placeholders:
    c.lastTimestamps = {};

    // Draw placeholders on the two canvases:
    this.drawSingleGridPlaceholder(`chart-${c.id}`);
    this.drawSingleBarPlaceholder(`bar-chart-${c.id}`);
  }

  /**
   * Downloads a CSV “sheet” for a given card’s current data:
   *   Columns: Field, Timestamp (ISO), Value
   *   - If the chart has multiple datasets, we flatten them into rows.
   *   - Initiates a download of “chart-<id>-data.csv”.
   */
  downloadCardSheet(c: ChartSlot) {
  if (!c.chartInstance) {
    return;
  }
  const chart: Chart = c.chartInstance;

  // 1) CSV header: Field;Date;Time;Value
  let csv = 'Field;Date;Time;Value\n';

  // 2) Build each row
  chart.data.datasets.forEach(ds => {
    const fieldName: string = ds.label ?? 'unknown';
    (ds.data as any[]).forEach(pt => {
      const dt = new Date(pt.x);

      // Day and month as two-digit numbers
      const day   = String(dt.getDate()).padStart(2, '0');
      const month = String(dt.getMonth() + 1).padStart(2, '0');

      // Combined DD-MM
      const datePart = `${day}-${month}`;

      // Time as HH:MM:SS
      const hours   = String(dt.getHours()).padStart(2, '0');
      const minutes = String(dt.getMinutes()).padStart(2, '0');
      const seconds = String(dt.getSeconds()).padStart(2, '0');
      const timePart = `${hours}:${minutes}:${seconds}`;

      const value = pt.y;

      // Wrap fieldName in quotes if needed
      const safeField = `"${fieldName.replace(/"/g, '""')}"`;

      // One row example: "humidity";04-06;15:24:37;27
      csv += `${safeField};${datePart};${timePart};${value}\n`;
    });
  });

  // 3) Create a Blob and trigger download, using the actual device name
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  // Use selectedDevice as filename (fall back to "device" if empty)
  const deviceName = c.selectedDevice || 'device';
  const filename = `${deviceName}_data.csv`;

  if ((navigator as any).msSaveBlob) {
    (navigator as any).msSaveBlob(blob, filename);
  } else {
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}


}
