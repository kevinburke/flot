/*
Axis label plugin for flot

Derived from:
Axis Labels Plugin for flot.
http://github.com/markrcote/flot-axislabels

Original code is Copyright (c) 2010 Xuan Luo.
Original code was released under the GPLv3 license by Xuan Luo, September 2010.
Original code was rereleased under the MIT license by Xuan Luo, April 2012.

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

import { plugins } from './plugin-registry.js';

/** @typedef {'bottom' | 'top' | 'left' | 'right'} AxisPosition */

/**
 * @typedef {Object} AxisBox
 * @property {number} left
 * @property {number} top
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {Object} AxisLabelAxis
 * @property {'x' | 'y'} direction
 * @property {number} n
 * @property {boolean} show
 * @property {number} labelHeight
 * @property {number} labelWidth
 * @property {{ centerX: number, centerY: number }} boxPosition
 * @property {AxisBox} box
 * @property {{ axisLabel?: string, axisLabelPadding?: number, position: AxisPosition }} options
 */

/**
 * @typedef {Object} AxisLabelSurface
 * @property {(layer: string, text: string, font: string) => { width: number, height: number }} getTextInfo
 * @property {(classes: string) => SVGGElement} getSVGLayer
 * @property {(
 *   layer: string,
 *   x: number,
 *   y: number,
 *   text: string,
 *   font: string,
 *   angle?: number,
 *   width?: number,
 *   halign?: 'left' | 'center' | 'right',
 *   valign?: 'top' | 'middle' | 'bottom',
 *   transforms?: SVGTransform[]
 * ) => void} addText
 * @property {(layer: string, x: number, y: number, text: string, font: string) => void} removeText
 * @property {() => void} render
 */

/**
 * @typedef {Object} AxisLabelPlot
 * @property {{
 *   processOptions: Array<(plot: AxisLabelPlot, options: { axisLabels: { show: boolean } }) => void>,
 *   axisReserveSpace: Array<(plot: AxisLabelPlot, axis: AxisLabelAxis) => void>,
 *   draw: Array<(plot: AxisLabelPlot) => void>,
 *   shutdown: Array<() => void>
 * }} hooks
 * @property {() => HTMLElement} getPlaceholder
 * @property {() => AxisLabelSurface} getSurface
 * @property {() => Record<string, AxisLabelAxis>} getAxes
 */

    "use strict";

    var options = {
        axisLabels: {
            show: true
        }
    };

	class AxisLabel {
	/**
	 * @param {string} axisName
	 * @param {AxisPosition} position
	 * @param {number} padding
	 * @param {HTMLElement} placeholder
	 * @param {string} axisLabel
	 * @param {AxisLabelSurface} surface
	 */
	constructor(axisName, position, padding, placeholder, axisLabel, surface) {
        this.axisName = axisName;
        this.position = position;
        this.padding = padding;
        this.placeholder = placeholder;
        this.axisLabel = axisLabel;
        this.surface = surface;
        this.width = 0;
        this.height = 0;
        this.elem = null;
    }

	calculateSize() {
        var axisId = this.axisName + 'Label',
            layerId = axisId + 'Layer',
            className = axisId + ' axisLabels';

        var info = this.surface.getTextInfo(layerId, this.axisLabel, className);
        this.labelWidth = info.width;
        this.labelHeight = info.height;

        if (this.position === 'left' || this.position === 'right') {
            this.width = this.labelHeight + this.padding;
            this.height = 0;
        } else {
            this.width = 0;
            this.height = this.labelHeight + this.padding;
        }
    }

	/** @param {number} degrees @param {number} x @param {number} y @param {SVGSVGElement} svgLayer */
	transforms(degrees, x, y, svgLayer) {
		/** @type {SVGTransform[]} */
		var transforms = [];
		/** @type {SVGTransform} */
		var translate;
		/** @type {SVGTransform} */
		var rotate;
        if (x !== 0 || y !== 0) {
            translate = svgLayer.createSVGTransform();
            translate.setTranslate(x, y);
            transforms.push(translate);
        }
        if (degrees !== 0) {
            rotate = svgLayer.createSVGTransform();
            var centerX = Math.round(this.labelWidth / 2),
                centerY = 0;
            rotate.setRotate(degrees, centerX, centerY);
            transforms.push(rotate);
        }

        return transforms;
    }

	/** @param {AxisBox} box */
	calculateOffsets(box) {
        var offsets = {
            x: 0,
            y: 0,
            degrees: 0
        };
        if (this.position === 'bottom') {
            offsets.x = box.left + box.width / 2 - this.labelWidth / 2;
            offsets.y = box.top + box.height - this.labelHeight;
        } else if (this.position === 'top') {
            offsets.x = box.left + box.width / 2 - this.labelWidth / 2;
            offsets.y = box.top;
        } else if (this.position === 'left') {
            offsets.degrees = -90;
            offsets.x = box.left - this.labelWidth / 2;
            offsets.y = box.height / 2 + box.top;
        } else if (this.position === 'right') {
            offsets.degrees = 90;
            offsets.x = box.left + box.width - this.labelWidth / 2;
            offsets.y = box.height / 2 + box.top;
        }
        offsets.x = Math.round(offsets.x);
        offsets.y = Math.round(offsets.y);

        return offsets;
    }

	cleanup() {
        var axisId = this.axisName + 'Label',
            layerId = axisId + 'Layer',
            className = axisId + ' axisLabels';
        this.surface.removeText(layerId, 0, 0, this.axisLabel, className);
    }

	/** @param {AxisBox} box */
	draw(box) {
		var axisId = this.axisName + 'Label',
            layerId = axisId + 'Layer',
            className = axisId + ' axisLabels',
            offsets = this.calculateOffsets(box),
			style = {
                position: 'absolute',
                bottom: '',
                right: '',
                display: 'inline-block',
				'white-space': 'nowrap'
			};

        var layer = this.surface.getSVGLayer(layerId);
		var svgLayer = layer.ownerSVGElement;
		if (!svgLayer) {
			throw new Error('Axis label layer is not attached to an SVG element.');
		}
		var transforms = this.transforms(offsets.degrees, offsets.x, offsets.y, svgLayer);

        this.surface.addText(layerId, 0, 0, this.axisLabel, className, undefined, undefined, undefined, undefined, transforms);
        this.surface.render();
		Object.assign(layer.style, style);
    }
	}

	/** @param {AxisLabelPlot} plot */
	function init(plot) {
		plot.hooks.processOptions.push(function(plot, options) {
            if (!options.axisLabels.show) {
                return;
            }

			/** @type {Record<string, AxisLabel>} */
			var axisLabels = {};
            var defaultPadding = 2; // padding between axis and tick labels

			plot.hooks.axisReserveSpace.push(function(plot, axis) {
                var opts = axis.options;
                var axisName = axis.direction + axis.n;

                axis.labelHeight += axis.boxPosition.centerY;
                axis.labelWidth += axis.boxPosition.centerX;

                if (!opts || !opts.axisLabel || !axis.show) {
                    return;
                }

                var padding = opts.axisLabelPadding === undefined
                    ? defaultPadding
                    : opts.axisLabelPadding;

                var axisLabel = axisLabels[axisName];
                if (!axisLabel) {
                    axisLabel = new AxisLabel(axisName,
                        opts.position, padding,
                        plot.getPlaceholder(), opts.axisLabel, plot.getSurface());
                    axisLabels[axisName] = axisLabel;
                }

                axisLabel.calculateSize();

                // Incrementing the sizes of the tick labels.
                axis.labelHeight += axisLabel.height;
                axis.labelWidth += axisLabel.width;
            });

            // TODO - use the drawAxis hook
			plot.hooks.draw.push(function(plot) {
                var axes = plot.getAxes();
                Object.keys(axes).forEach(function(flotAxisName) {
                    var axis = axes[flotAxisName];
                    var opts = axis.options;
                    if (!opts || !opts.axisLabel || !axis.show) {
                        return;
                    }

                    var axisName = axis.direction + axis.n;
                    axisLabels[axisName].draw(axis.box);
                });
            });

			plot.hooks.shutdown.push(function() {
                for (var axisName in axisLabels) {
                    axisLabels[axisName].cleanup();
                }
            });
        });
    };

    plugins.push({
        init: init,
        options: options,
        name: 'axisLabels',
        version: '3.0'
    });
