import $ from "jquery";
import { type PlotOptions, plot, version } from "@kevinburke/flot";
import "@kevinburke/flot/jquery";

const options: PlotOptions = { series: { points: { errorbars: "xy" } } };
const corePlot = plot(document.createElement("div"), [[[1, 2]]], options);
const jqueryPlot = $.plot(document.createElement("div"), [[[1, 2]]], options);
const release: string = version;
corePlot.setData([]);
jqueryPlot.setData([]);
release.toUpperCase();
// @ts-expect-error version must not resolve to any
const invalid: number = version;
