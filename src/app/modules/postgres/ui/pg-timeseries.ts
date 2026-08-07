import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { LineChartComponent } from '@carbon/charts-angular';
import { ScaleTypes, ToolbarControlTypes, ZoomBarTypes } from '@carbon/charts';
import type { ChartTabularData, LineChartOptions } from '@carbon/charts';

export interface PgSeries {
  label: string;
  /** timestamps와 같은 길이. 결측은 NaN으로 두고 0으로 대체하지 않는다. */
  data: number[];
  color: string;
}

/**
 * PostgreSQL 시계열 차트 — Carbon Charts 단일 렌더러.
 *
 * 확대/축소는 세 경로로 제공한다: zoom bar 드래그, toolbar의 Zoom in/out·Reset,
 * 그리고 상위 화면의 구간 선택(1h~7d). Carbon 1.27.18의 Shadow DOM overflow
 * mouse 회귀를 피하기 위해 표 보기와 CSV는 플러그인 소유 native details로 제공한다.
 *
 * options 아이덴티티는 구조 입력이 바뀔 때만 새로 만든다. 15초 폴링마다 새 options를
 * 넘기면 wrapper가 model.setOptions()를 호출해 사용자가 잡아둔 줌 도메인이 풀린다.
 * data만 교체하면 model.setData()로 in-place 갱신돼 줌이 유지된다.
 */
@Component({
  selector: 'pg-timeseries',
  standalone: true,
  imports: [CommonModule, LineChartComponent],
  template: `
    <div class="pg-chart-utility">
      <details #utilityMenu>
        <summary aria-label="More options" title="More options">⋮</summary>
        <div class="pg-chart-menu" role="menu">
          <button type="button" role="menuitem" (click)="showTable = !showTable; utilityMenu.open = false">
            {{ showTable ? '차트로 보기' : '표로 보기' }}
          </button>
          <button type="button" role="menuitem" (click)="downloadCsv(); utilityMenu.open = false">CSV 내려받기</button>
        </div>
      </details>
    </div>
    <ibm-line-chart [data]="chartData" [options]="chartOptions" [height]="height"></ibm-line-chart>
    @if (showTable) {
      <div class="pg-chart-table-wrap">
        <table class="table table-compact" [attr.aria-label]="ariaLabel + ' data table'">
          <thead><tr><th>시각</th>@for (item of series; track item.label) { <th>{{ item.label }}</th> }</tr></thead>
          <tbody>
            @for (timestamp of timestamps; track timestamp; let index = $index) {
              <tr><td>{{ formatTimestamp(timestamp) }}</td>@for (item of series; track item.label) { <td>{{ formatValue(item.data[index]) }}</td> }</tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    :host ::ng-deep .cds--cc--chart-wrapper { font-family: inherit; }
    .pg-chart-utility { display: flex; justify-content: flex-end; height: 28px; position: relative; z-index: 5; }
    details { position: relative; }
    summary { cursor: pointer; list-style: none; width: 28px; height: 28px; display: grid; place-items: center; font-size: 20px; }
    summary::-webkit-details-marker { display: none; }
    .pg-chart-menu { position: absolute; right: 0; top: 30px; min-width: 132px; padding: 4px 0; background: #fff; border: 1px solid #c8c8c8; box-shadow: 0 2px 8px rgb(0 0 0 / 18%); }
    .pg-chart-menu button { display: block; width: 100%; border: 0; background: transparent; padding: 7px 12px; text-align: left; cursor: pointer; }
    .pg-chart-menu button:hover, .pg-chart-menu button:focus { background: #eef6ff; }
    .pg-chart-table-wrap { max-height: 280px; overflow: auto; border-top: 1px solid #d8d8d8; }
    .pg-chart-table-wrap table { margin: 0; width: 100%; }
  `],
})
export class PgTimeseries implements OnChanges {
  /** epoch 초. Prometheus query_range가 돌려준 표본 시각 그대로. */
  @Input() timestamps: number[] = [];
  @Input() series: PgSeries[] = [];
  @Input() valueTitle = '';
  @Input() height = '260px';
  @Input() ariaLabel = 'PostgreSQL time series';
  /**
   * 0을 축에 포함할지. 비율·지연처럼 좁은 대역에서 움직이는 지표는 false여야
   * 변화가 보인다. Carbon 기본값이 true라 명시적으로 꺼야 한다.
   */
  @Input() includeZero = false;
  @Input() showZoomBar = true;
  showTable = false;

  chartData: ChartTabularData = [];
  chartOptions: LineChartOptions = this.buildOptions();

  formatTimestamp(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleString('ko-KR');
  }

  formatValue(value: number | undefined): string {
    return Number.isFinite(value) ? String(value) : '—';
  }

  downloadCsv(): void {
    const header = ['timestamp', ...this.series.map((item) => item.label)];
    const rows = this.timestamps.map((timestamp, index) => [
      new Date(timestamp * 1000).toISOString(),
      ...this.series.map((item) => Number.isFinite(item.data[index]) ? String(item.data[index]) : ''),
    ]);
    const csv = [header, ...rows].map((row) => row.map((value) => this.csvCell(value)).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${this.ariaLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'postgresql-chart'}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private csvCell(value: string): string {
    return `"${value.replace(/"/g, '""')}"`;
  }

  ngOnChanges(changes: SimpleChanges): void {
    // 구조 입력이 바뀔 때만 options를 갈아끼운다(줌 도메인 보존).
    const structural = ['valueTitle', 'ariaLabel', 'includeZero', 'showZoomBar', 'height'];
    const colorsChanged = !!changes['series'] && this.seriesSignature(changes['series'].previousValue) !== this.seriesSignature(this.series);
    if (structural.some((key) => key in changes) || colorsChanged) {
      this.chartOptions = this.buildOptions();
    }
    if ('series' in changes || 'timestamps' in changes) {
      this.chartData = this.buildData();
    }
  }

  /** 계열 구성(이름·색)만 추린 서명. 값 변화로는 options를 흔들지 않는다. */
  private seriesSignature(series: PgSeries[] | undefined): string {
    return (series ?? []).map((item) => `${item.label}:${item.color}`).join('|');
  }

  private buildData(): ChartTabularData {
    const rows: ChartTabularData = [];
    for (const item of this.series) {
      for (let index = 0; index < this.timestamps.length; index++) {
        const value = item.data[index];
        rows.push({
          group: item.label,
          date: new Date(this.timestamps[index] * 1000),
          // 결측은 null — Carbon이 선을 끊는다. 0으로 채우면 없는 관측을 지어내는 것이다.
          value: Number.isFinite(value) ? value : null,
        });
      }
    }
    return rows;
  }

  private buildOptions(): LineChartOptions {
    const scale: Record<string, string> = {};
    for (const item of this.series) scale[item.label] = item.color;
    return {
      axes: {
        bottom: { mapsTo: 'date', scaleType: ScaleTypes.TIME },
        left: { mapsTo: 'value', title: this.valueTitle, scaleType: ScaleTypes.LINEAR, includeZero: this.includeZero },
      },
      // 관측되지 않은 값을 만들어내지 않는 직선 보간. spline은 희소 표본에서 overshoot한다.
      curve: 'curveLinear',
      points: { enabled: false },
      color: { scale },
      legend: { enabled: this.series.length > 1, clickable: this.series.length > 1 },
      // ruler tooltip — 커서의 x 위치에서 전 계열 값을 한 번에 읽는다(Grafana의 공유 crosshair).
      // 점 하나를 픽셀 단위로 맞춰야 값이 보이던 이전 구현의 결함을 여기서 없앤다.
      tooltip: { enabled: true, alwaysShowRulerTooltip: this.series.length > 1 },
      zoomBar: { top: { enabled: this.showZoomBar, type: ZoomBarTypes.GRAPH_VIEW } },
      toolbar: {
        enabled: true,
        numberOfIcons: 3,
        controls: [
          { type: ToolbarControlTypes.ZOOM_IN, title: '시간 구간 확대' },
          { type: ToolbarControlTypes.ZOOM_OUT, title: '시간 구간 축소' },
          { type: ToolbarControlTypes.RESET_ZOOM, title: '선택 구간 전체 보기' },
        ],
      },
      height: this.height,
      accessibility: { svgAriaLabel: this.ariaLabel },
      data: { loading: false },
    } as LineChartOptions;
  }
}
