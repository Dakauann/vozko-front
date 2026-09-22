import { init, use as registerCharts } from "echarts/core";
import { BarChart, ScatterChart, TreemapChart } from "echarts/charts";
import { GridComponent, PolarComponent, TooltipComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";

registerCharts([BarChart, ScatterChart, TreemapChart, GridComponent, PolarComponent, TooltipComponent, SVGRenderer]);

export { init };
