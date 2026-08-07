import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, inject } from '@angular/core';
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
 * 그리고 상위 화면의 구간 선택(1h~7d). toolbar의 Show as data-table이 차트의
 * 접근성 대체 표현을 담당하므로 별도 sr-only 요약을 손으로 만들지 않는다.
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
    <ibm-line-chart [data]="chartData" [options]="chartOptions" [height]="height"></ibm-line-chart>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    :host ::ng-deep .cds--cc--chart-wrapper { font-family: inherit; }
  `],
})
export class PgTimeseries implements OnChanges, AfterViewInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly guardedOverflowTriggers = new WeakSet<Element>();
  private overflowTriggerObserver?: MutationObserver;
  private readonly keepOverflowTriggerClickInsideChart = (event: Event): void => event.stopPropagation();
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

  chartData: ChartTabularData = [];
  chartOptions: LineChartOptions = this.buildOptions();

  /**
   * Carbon 1.27.18은 overflow trigger의 click 처리 중 document.body에 닫기
   * listener를 등록한다. Shadow DOM 안에서는 같은 click이 body까지 계속 전파되어
   * 메뉴가 열린 직후 다시 닫힌다. trigger click만 host 경계에서 멈추면 바깥 클릭
   * 닫기와 menu item 실행은 그대로 유지된다.
   */
  ngAfterViewInit(): void {
    this.guardOverflowTriggers();
    this.overflowTriggerObserver = new MutationObserver(() => this.guardOverflowTriggers());
    this.overflowTriggerObserver.observe(this.host.nativeElement, { childList: true, subtree: true });
  }

  ngOnDestroy(): void {
    this.overflowTriggerObserver?.disconnect();
  }

  private guardOverflowTriggers(): void {
    for (const trigger of this.host.nativeElement.querySelectorAll('.cds--overflow-menu__trigger')) {
      if (this.guardedOverflowTriggers.has(trigger)) continue;
      // target capture에서 전파만 멈춘다. 같은 target의 Carbon click handler는 그대로 실행된다.
      trigger.addEventListener('click', this.keepOverflowTriggerClickInsideChart, true);
      this.guardedOverflowTriggers.add(trigger);
    }
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
          { type: ToolbarControlTypes.SHOW_AS_DATATABLE, title: '표로 보기' },
          { type: ToolbarControlTypes.EXPORT_CSV, title: 'CSV 내려받기' },
        ],
      },
      height: this.height,
      accessibility: { svgAriaLabel: this.ariaLabel },
      data: { loading: false },
    } as LineChartOptions;
  }
}
