import $ = require("jquery");
import flot = require("@kevinburke/flot");
import "@kevinburke/flot/jquery";

const options: flot.PlotOptions = { series: { points: { errorbars: "xy" } } };
const corePlot = flot.plot(document.createElement("div"), [[[1, 2]]], options);
const jqueryPlot = $.plot(document.createElement("div"), [[[1, 2]]], options);
const release: string = flot.version;
corePlot.setData([]);
jqueryPlot.setData([]);
release.toUpperCase();
// @ts-expect-error version must not resolve to any
const invalid: number = flot.version;
